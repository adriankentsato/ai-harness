import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2FinishReason,
  LanguageModelV2FunctionTool,
  LanguageModelV2StreamPart,
  LanguageModelV2Content,
  ProviderV2,
} from "@ai-sdk/provider";
import { generateId, loadApiKey, withoutTrailingSlash } from "@ai-sdk/provider-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NvidiaModelId =
  | "meta/llama-3.3-70b-instruct"
  | "meta/llama-3.1-8b-instruct"
  | "mistralai/mistral-7b-instruct-v0.3"
  | "mistralai/mixtral-8x7b-instruct-v0.1"
  | "microsoft/phi-3-mini-128k-instruct"
  | "nvidia/llama-3.1-nemotron-70b-instruct"
  | "google/gemma-2-9b-it"
  | (string & {}); // allow arbitrary model strings

export interface NvidiaProviderSettings {
  /** NVIDIA NIM API key. Defaults to NVIDIA_API_KEY env var. */
  apiKey?: string;
  /** Base URL for the NVIDIA NIM API. Defaults to https://integrate.api.nvidia.com/v1 */
  baseURL?: string;
  /** Extra headers to send on every request. */
  headers?: Record<string, string>;
}

export interface NvidiaModelSettings {
  /** Override the base URL per-model (e.g. for self-hosted NIM). */
  baseURL?: string;
  /** Default max tokens for this model. */
  maxTokens?: number;
  /** Temperature (0-2). */
  temperature?: number;
  /** Top-p nucleus sampling. */
  topP?: number;
}

// ---------------------------------------------------------------------------
// OpenAI-wire-format helpers (NVIDIA NIM is OpenAI-compatible)
// ---------------------------------------------------------------------------

type OAIRole = "system" | "user" | "assistant" | "tool";

interface OAIMessage {
  role: OAIRole;
  content: string | OAIContentPart[] | null;
  tool_calls?: OAIToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface OAIContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

interface OAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OAITool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: unknown;
  };
}

interface OAIRequest {
  model: string;
  messages: OAIMessage[];
  stream?: boolean;
  tools?: OAITool[];
  tool_choice?: "auto" | "none" | "required";
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string | string[];
  seed?: number;
  response_format?: { type: "text" | "json_object" };
}

interface OAIChoice {
  index: number;
  message: {
    role: string;
    content: string | null;
    tool_calls?: OAIToolCall[];
  };
  finish_reason: string;
}

interface OAIResponse {
  id: string;
  model: string;
  choices: OAIChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OAIStreamDelta {
  role?: string;
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: "function";
    function?: { name?: string; arguments?: string };
  }>;
}

interface OAIStreamChunk {
  id: string;
  choices: Array<{
    index: number;
    delta: OAIStreamDelta;
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ---------------------------------------------------------------------------
// Message conversion: AI SDK → OpenAI wire format
// ---------------------------------------------------------------------------

function convertMessages(
  prompt: LanguageModelV2CallOptions["prompt"]
): OAIMessage[] {
  const messages: OAIMessage[] = [];

  for (const msg of prompt) {
    switch (msg.role) {
      case "system": {
        messages.push({ role: "system", content: msg.content });
        break;
      }

      case "user": {
        const parts: OAIContentPart[] = [];
        for (const part of msg.content) {
          if (part.type === "text") {
            parts.push({ type: "text", text: part.text });
          } else if ((part as any).type === "image") {
            const imagePart = part as any;
            const url =
              imagePart.image instanceof URL
                ? imagePart.image.toString()
                : `data:${imagePart.mimeType ?? "image/jpeg"};base64,${
                    typeof imagePart.image === "string"
                      ? imagePart.image
                      : Buffer.from(imagePart.image).toString("base64")
                  }`;
            parts.push({ type: "image_url", image_url: { url } });
          }
          // file parts are not supported by NIM; skip silently
        }
        messages.push({
          role: "user",
          content: parts.length === 1 && parts[0].type === "text"
            ? (parts[0].text ?? "")
            : parts,
        });
        break;
      }

      case "assistant": {
        const textParts: string[] = [];
        const toolCalls: OAIToolCall[] = [];

        for (const part of msg.content) {
          if (part.type === "text") {
            textParts.push(part.text);
          } else if (part.type === "tool-call") {
            toolCalls.push({
              id: part.toolCallId,
              type: "function",
              function: {
                name: part.toolName,
                arguments:
                  typeof part.input === "string"
                    ? part.input
                    : JSON.stringify(part.input),
              },
            });
          }
        }

        const oaiMsg: OAIMessage = {
          role: "assistant",
          content: textParts.join("") || null,
        };
        if (toolCalls.length > 0) oaiMsg.tool_calls = toolCalls;
        messages.push(oaiMsg);
        break;
      }

      case "tool": {
        for (const part of msg.content) {
          const toolResult = part as any;
          messages.push({
            role: "tool",
            tool_call_id: part.toolCallId,
            content:
              typeof toolResult.result === "string"
                ? toolResult.result
                : JSON.stringify(toolResult.result),
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
// Build OAI request body from AI SDK call options
// ---------------------------------------------------------------------------

function buildRequestBody(
  modelId: string,
  options: LanguageModelV2CallOptions,
  modelSettings: NvidiaModelSettings,
  stream: boolean
): OAIRequest {

  const body: OAIRequest = {
    model: modelId,
    messages: convertMessages(options.prompt),
    stream,
  };

  // Tokens / sampling
  if (options.maxOutputTokens != null)
    body.max_tokens = options.maxOutputTokens;
  else if (modelSettings.maxTokens != null)
    body.max_tokens = modelSettings.maxTokens;

  if (options.temperature != null) body.temperature = options.temperature;
  else if (modelSettings.temperature != null)
    body.temperature = modelSettings.temperature;

  if (options.topP != null) body.top_p = options.topP;
  else if (modelSettings.topP != null) body.top_p = modelSettings.topP;

  if (options.stopSequences?.length) body.stop = options.stopSequences;
  if (options.seed != null) body.seed = options.seed;

  // Tools
  if (options.tools?.length) {
    body.tools = options.tools
      .filter((t): t is LanguageModelV2FunctionTool => t.type === "function")
      .map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));

    if (options.toolChoice?.type === "none") body.tool_choice = "none";
    else if (options.toolChoice?.type === "required")
      body.tool_choice = "required";
    else if (options.toolChoice?.type === "tool")
      // NIM doesn't support forced single-tool; fall back to auto
      body.tool_choice = "auto";
    else body.tool_choice = "auto";
  }

  // Structured output / JSON mode
  if (options.responseFormat?.type === "json") {
    body.response_format = { type: "json_object" };
  }

  return body;
}

// ---------------------------------------------------------------------------
// NvidiaLanguageModel — implements LanguageModelV2
// ---------------------------------------------------------------------------

export class NvidiaLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2" as const;
  readonly provider = "nvidia-nim";
  readonly modelId: NvidiaModelId;
  readonly defaultObjectGenerationMode = "json" as const;
  readonly supportsImageUrls = true;
  readonly supportedUrls = { "image/*": [] };

  private readonly baseURL: string;
  private readonly apiKey: string | undefined;
  private readonly defaultHeaders: Record<string, string>;
  private readonly modelSettings: NvidiaModelSettings;

  constructor(
    modelId: NvidiaModelId,
    providerSettings: NvidiaProviderSettings,
    modelSettings: NvidiaModelSettings = {}
  ) {
    this.modelId = modelId;
    this.baseURL =
      withoutTrailingSlash(
        modelSettings.baseURL ??
          providerSettings.baseURL ??
          "https://integrate.api.nvidia.com/v1"
      ) ?? "https://integrate.api.nvidia.com/v1";

    this.apiKey = loadApiKey({
      apiKey: providerSettings.apiKey,
      environmentVariableName: "NVIDIA_API_KEY",
      description: "NVIDIA NIM",
    });

    this.defaultHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
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
    const body = buildRequestBody(
      this.modelId,
      options,
      this.modelSettings,
      false
    );

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: this.defaultHeaders,
      body: JSON.stringify(body),
      signal: options.abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown error");
      throw new Error(
        `NVIDIA NIM API error ${response.status}: ${errorText}`
      );
    }

    const json = await response.json() as OAIResponse;
    const choice = json.choices[0];

    const content: Array<LanguageModelV2Content> = [];

    // Text content
    if (choice.message.content) {
      content.push({
        type: "text",
        text: choice.message.content,
      });
    }

    // Tool calls
    for (const tc of choice.message.tool_calls ?? []) {
      content.push({
        type: "tool-call",
        toolCallId: tc.id,
        toolName: tc.function.name,
        input: tc.function.arguments,
      });
    }

    return {
      content,
      finishReason: toFinishReason(choice.finish_reason),
      usage: {
        inputTokens: json.usage?.prompt_tokens ?? 0,
        outputTokens: json.usage?.completion_tokens ?? 0,
        totalTokens: json.usage?.total_tokens ?? ((json.usage?.prompt_tokens ?? 0) + (json.usage?.completion_tokens ?? 0)),
      },
      warnings: [],
    };
  }

  // -------------------------------------------------------------------------
  // doStream — SSE streaming
  // -------------------------------------------------------------------------

  async doStream(
    options: LanguageModelV2CallOptions
  ): Promise<Awaited<ReturnType<LanguageModelV2["doStream"]>>> {
    const body = buildRequestBody(
      this.modelId,
      options,
      this.modelSettings,
      true
    );

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: this.defaultHeaders,
      body: JSON.stringify(body),
      signal: options.abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown error");
      throw new Error(
        `NVIDIA NIM API error ${response.status}: ${errorText}`
      );
    }

    if (!response.body) {
      throw new Error("NVIDIA NIM: response body is null");
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
              if (!trimmed || !trimmed.startsWith("data:")) continue;

              const data = trimmed.slice(5).trim();
              if (data === "[DONE]") {
                controller.close();
                return;
              }

              let chunk: OAIStreamChunk;
              try {
                chunk = JSON.parse(data);
              } catch {
                continue;
              }

              for (const choice of chunk.choices) {
                const delta = choice.delta;

                // Text delta
                if (delta.content) {
                  enqueue({ type: "text-delta", id: generateId(), delta: delta.content });
                }

                // Finish
                if (choice.finish_reason) {
                  enqueue({
                    type: "finish",
                    finishReason: toFinishReason(choice.finish_reason),
                    usage: {
                      inputTokens: chunk.usage?.prompt_tokens ?? 0,
                      outputTokens: chunk.usage?.completion_tokens ?? 0,
                      totalTokens: chunk.usage?.total_tokens ?? ((chunk.usage?.prompt_tokens ?? 0) + (chunk.usage?.completion_tokens ?? 0)),
                    },
                  });
                }
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
      stream,
    };
  }
}

// ---------------------------------------------------------------------------
// NvidiaProvider — implements ProviderV2
// ---------------------------------------------------------------------------

export interface NvidiaProvider extends ProviderV2 {
  (modelId: NvidiaModelId, settings?: NvidiaModelSettings): NvidiaLanguageModel;
}

export function createNvidia(
  providerSettings: NvidiaProviderSettings = {}
): NvidiaProvider {
  const createModel = (
    modelId: NvidiaModelId,
    modelSettings: NvidiaModelSettings = {}
  ) => new NvidiaLanguageModel(modelId, providerSettings, modelSettings);

  const provider = function (
    modelId: NvidiaModelId,
    settings?: NvidiaModelSettings
  ) {
    return createModel(modelId, settings);
  } as NvidiaProvider;

  return provider;
}

/** Pre-built default instance — reads NVIDIA_API_KEY from env. */
export const nvidia = createNvidia();
