import type {
  LanguageModelV2,
  LanguageModelV2FunctionTool,
  LanguageModelV2CallOptions,
  LanguageModelV2FinishReason,
  LanguageModelV2StreamPart,
  LanguageModelV2TextPart,
  LanguageModelV2FilePart,
  LanguageModelV2ToolResultPart,
  ProviderV2,
} from "@ai-sdk/provider";
import { generateId, withoutTrailingSlash } from "@ai-sdk/provider-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OllamaModelId = string;

export interface OllamaProviderSettings {
  /** Ollama base URL. Defaults to http://localhost:11434 */
  baseURL?: string;
  /** Extra headers to send on every request. */
  headers?: Record<string, string>;
}

export interface OllamaModelSettings {
  /** Override the base URL per-model. */
  baseURL?: string;
  /** Default max tokens for this model. */
  maxTokens?: number;
  /** Temperature (0-2). */
  temperature?: number;
  /** Top-p nucleus sampling. */
  topP?: number;
}

// ---------------------------------------------------------------------------
// Ollama wire-format helpers
// ---------------------------------------------------------------------------

type OllamaRole = "system" | "user" | "assistant" | "tool";

interface OllamaMessage {
  role: OllamaRole;
  content: string;
  tool_calls?: OllamaToolCall[];
}

interface OllamaToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

interface OllamaTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: unknown;
  };
}

/**
 * Extended content part type that supports image parts.
 * AI SDK may pass `type: 'image'` with `image` and `mimeType` properties.
 */
interface ExtendedImagePart {
  type: 'image';
  image: string | Uint8Array | URL;
  mimeType?: string;
}

/**
 * Union type for user content parts that may include extended image parts.
 */
type ExtendedContentPart = LanguageModelV2TextPart | LanguageModelV2FilePart | ExtendedImagePart;

interface OllamaRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  tools?: OllamaTool[];
  options?: {
    temperature?: number;
    top_p?: number;
    stop?: string | string[];
    num_predict?: number;
    seed?: number;
  };
}

interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

// ---------------------------------------------------------------------------
// Message conversion: AI SDK → Ollama wire format
// ---------------------------------------------------------------------------

function convertMessages(
  prompt: LanguageModelV2CallOptions["prompt"]
): OllamaMessage[] {
  const messages: OllamaMessage[] = [];

  for (const msg of prompt) {
    switch (msg.role) {
      case "system": {
        messages.push({ role: "system", content: msg.content });
        break;
      }

      case "user": {
        let text = "";
        for (const part of msg.content as ExtendedContentPart[]) {
          if (part.type === "text") {
            text += part.text;
          } else if (part.type === "image") {
            // Ollama supports images via base64 in multimodal models
            const imagePart = part as ExtendedImagePart;
            const url =
              imagePart.image instanceof URL
                ? imagePart.image.toString()
                : typeof imagePart.image === "string"
                  ? imagePart.image
                  : `data:${imagePart.mimeType ?? "image/jpeg"};base64,${Buffer.from(imagePart.image).toString("base64")}`;
            text += `\n![image](${url})`;
          }
        }
        messages.push({ role: "user", content: text });
        break;
      }

      case "assistant": {
        let text = "";
        const toolCalls: OllamaToolCall[] = [];

        for (const part of msg.content) {
          if (part.type === "text") {
            text += part.text;
          } else if (part.type === "tool-call") {
            toolCalls.push({
              function: {
                name: part.toolName,
                arguments:
                  typeof part.input === "string"
                    ? JSON.parse(part.input)
                    : (part.input as Record<string, unknown>),
              },
            });
          }
        }

        const ollamaMsg: OllamaMessage = {
          role: "assistant",
          content: text,
        };
        if (toolCalls.length > 0) ollamaMsg.tool_calls = toolCalls;
        messages.push(ollamaMsg);
        break;
      }

      case "tool": {
        for (const part of msg.content as LanguageModelV2ToolResultPart[]) {
          messages.push({
            role: "tool",
            content:
              typeof part.output === "string"
                ? part.output
                : JSON.stringify(part.output),
          });
        }
        break;
      }
    }
  }

  return messages;
}

// ---------------------------------------------------------------------------
// finish_reason conversion
// ---------------------------------------------------------------------------

function toFinishReason(raw: string | null): LanguageModelV2FinishReason {
  switch (raw) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "tool_calls":
      return "tool-calls";
    case "content_filter":
      return "content-filter";
    default:
      return "other";
  }
}

// ---------------------------------------------------------------------------
// Build Ollama request body from AI SDK call options
// ---------------------------------------------------------------------------

function buildRequestBody(
  modelId: string,
  options: LanguageModelV2CallOptions,
  modelSettings: OllamaModelSettings
): OllamaRequest {
  const body: OllamaRequest = {
    model: modelId,
    messages: convertMessages(options.prompt),
    stream: false,
  };

  const opts: OllamaRequest["options"] = {};

  if (options.maxOutputTokens != null) opts.num_predict = options.maxOutputTokens;
  else if (modelSettings.maxTokens != null) opts.num_predict = modelSettings.maxTokens;

  if (options.temperature != null) opts.temperature = options.temperature;
  else if (modelSettings.temperature != null) opts.temperature = modelSettings.temperature;

  if (options.topP != null) opts.top_p = options.topP;
  else if (modelSettings.topP != null) opts.top_p = modelSettings.topP;

  if (options.stopSequences?.length) opts.stop = options.stopSequences;
  if (options.seed != null) opts.seed = options.seed;

  if (Object.keys(opts).length > 0) {
    body.options = opts;
  }

  // Tools
  if (options.tools?.length) {
    body.tools = options.tools
      .filter((t): t is LanguageModelV2FunctionTool => t.type === "function")
      .map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));
  }

  return body;
}

// ---------------------------------------------------------------------------
// OllamaLanguageModel — implements LanguageModelV2
// ---------------------------------------------------------------------------

export class OllamaLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2" as const;
  readonly provider = "ollama";
  readonly modelId: OllamaModelId;
  readonly defaultObjectGenerationMode = "json" as const;
  readonly supportsImageUrls = true;
  readonly supportedUrls = { "image/*": [] };

  private readonly baseURL: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly modelSettings: OllamaModelSettings;

  constructor(
    modelId: OllamaModelId,
    providerSettings: OllamaProviderSettings,
    modelSettings: OllamaModelSettings = {}
  ) {
    this.modelId = modelId;
    this.baseURL =
      withoutTrailingSlash(
        modelSettings.baseURL ??
        providerSettings.baseURL ??
        "http://localhost:11434"
      ) ?? "http://localhost:11434";

    this.defaultHeaders = {
      "Content-Type": "application/json",
      ...providerSettings.headers,
    };

    this.modelSettings = modelSettings;
  }

  // -------------------------------------------------------------------------
  // doGenerate — non-streaming
  // -------------------------------------------------------------------------

  async doGenerate(
    options: LanguageModelV2CallOptions
  ): Promise<Awaited<ReturnType<LanguageModelV2["doGenerate"]>>> {
    const body = buildRequestBody(this.modelId, options, this.modelSettings);

    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: "POST",
      headers: this.defaultHeaders,
      body: JSON.stringify(body),
      signal: options.abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown error");
      throw new Error(
        `Ollama API error ${response.status}: ${errorText}`
      );
    }

    const json = (await response.json()) as OllamaResponse;

    const content: Array<{ type: string; text?: string; toolCallId?: string; toolName?: string; input?: string }> = [];

    // Text content
    if (json.message?.content) {
      content.push({
        type: "text",
        text: json.message.content,
      });
    }

    // Tool calls
    for (const tc of json.message?.tool_calls ?? []) {
      content.push({
        type: "tool-call",
        toolCallId: generateId(),
        toolName: tc.function.name,
        input: JSON.stringify(tc.function.arguments),
      });
    }

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: content as any,
      finishReason: toFinishReason(json.done ? "stop" : null),
      usage: {
        inputTokens: json.prompt_eval_count ?? 0,
        outputTokens: json.eval_count ?? 0,
        totalTokens:
          (json.prompt_eval_count ?? 0) + (json.eval_count ?? 0),
      },
      warnings: [],
    };
  }

  // -------------------------------------------------------------------------
  // doStream — streaming (Ollama returns NDJSON lines)
  // -------------------------------------------------------------------------

  async doStream(
    options: LanguageModelV2CallOptions
  ): Promise<Awaited<ReturnType<LanguageModelV2["doStream"]>>> {
    const body = buildRequestBody(this.modelId, options, this.modelSettings);
    body.stream = true;

    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: "POST",
      headers: this.defaultHeaders,
      body: JSON.stringify(body),
      signal: options.abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown error");
      throw new Error(
        `Ollama API error ${response.status}: ${errorText}`
      );
    }

    if (!response.body) {
      throw new Error("Ollama: response body is null");
    }

    const rawBody = response.body;

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      async start(controller) {
        const reader = rawBody
          .pipeThrough(new TextDecoderStream())
          .getReader();

        let buffer = "";

        const enqueue = (part: LanguageModelV2StreamPart) =>
          controller.enqueue(part);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += value;
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;

              let chunk: OllamaResponse;
              try {
                chunk = JSON.parse(trimmed);
              } catch {
                continue;
              }

              // Text delta
              if (chunk.message?.content) {
                enqueue({
                  type: "text-delta",
                  id: generateId(),
                  delta: chunk.message.content,
                });
              }

              // Send finish event when done flag is set
              if (chunk.done) {
                enqueue({
                  type: "finish",
                  finishReason: toFinishReason("stop"),
                  usage: {
                    inputTokens: chunk.prompt_eval_count ?? 0,
                    outputTokens: chunk.eval_count ?? 0,
                    totalTokens:
                      (chunk.prompt_eval_count ?? 0) +
                      (chunk.eval_count ?? 0),
                  },
                });
              }
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          reader.releaseLock();
        }
      },
    });

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stream: stream as any,
    };
  }
}

// ---------------------------------------------------------------------------
// OllamaProvider — implements ProviderV2
// ---------------------------------------------------------------------------

export interface OllamaProvider extends ProviderV2 {
  (modelId: OllamaModelId, settings?: OllamaModelSettings): OllamaLanguageModel;
}

export function createOllama(
  providerSettings: OllamaProviderSettings = {}
): OllamaProvider {
  const createModel = (
    modelId: OllamaModelId,
    modelSettings: OllamaModelSettings = {}
  ) => new OllamaLanguageModel(modelId, providerSettings, modelSettings);

  const provider = function (
    modelId: OllamaModelId,
    settings?: OllamaModelSettings
  ) {
    return createModel(modelId, settings);
  } as OllamaProvider;

  return provider;
}

/** Pre-built default instance — reads OLLAMA_BASE_URL from env if set. */
export const ollama = createOllama();
