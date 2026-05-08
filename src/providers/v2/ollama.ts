import {
  AIProvider,
  type Message,
  type CompletionOptions,
  type CompletionResult,
  type StreamChunk,
  type ModelInfo,
} from "../../types/index";
import { createOllama } from "../../models/ollama.js";

export class OllamaProvider extends AIProvider {
  readonly name = "ollama";
  readonly defaultModel = "llama3.1";

  private baseUrl: string;
  private timeoutMs: number;
  private ollamaProvider: ReturnType<typeof createOllama>;

  constructor(config: { baseUrl?: string; timeout?: number } = {}) {
    super();
    this.baseUrl = config.baseUrl || "http://localhost:11434";
    this.timeoutMs = config.timeout || 60000;
    this.ollamaProvider = createOllama({
      baseURL: this.baseUrl,
    });
  }

  validateConfig(): boolean {
    return true;
  }

  async fetchModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const data = (await response.json()) as {
        models: Array<{
          name: string;
          model: string;
          size?: number;
          parameter_size?: string;
          quantization_level?: string;
        }>;
      };

      return data.models.map((m) => ({
        id: m.name,
        name: m.name,
        description: `${m.parameter_size || "Unknown"} ${m.quantization_level || ""}`.trim(),
      }));
    } catch {
      return [];
    }
  }

  async complete(
    messages: Message[],
    options: CompletionOptions = {}
  ): Promise<CompletionResult> {
    const modelId = options.model || this.defaultModel;
    const abortController = new AbortController();
    const timeoutId = setTimeout(
      () => abortController.abort(),
      this.timeoutMs
    );

    const ollamaModel = this.ollamaProvider(modelId);

    const tools = this.buildV2Tools(options.tools);

    try {
      const result = await ollamaModel.doGenerate({
        prompt: messages.map((msg) => {
          if (msg.role === "system") {
            return { role: "system" as const, content: msg.content };
          } else if (msg.role === "user") {
            return {
              role: "user" as const,
              content: [{ type: "text" as const, text: msg.content }],
            };
          } else {
            return {
              role: "assistant" as const,
              content: [{ type: "text" as const, text: msg.content }],
            };
          }
        }),
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
        topP: options.topP,
        frequencyPenalty: options.frequencyPenalty,
        presencePenalty: options.presencePenalty,
        stopSequences: options.stop,
        tools,
        abortSignal: abortController.signal,
      });

      clearTimeout(timeoutId);

      const textParts = result.content.filter(
        (c: { type: string; text?: string }) => c.type === "text"
      ) as Array<{ type: "text"; text: string }>;
      const textContent = textParts.map((c) => c.text).join("");

      return {
        text: textContent,
        usage: {
          promptTokens: result.usage.inputTokens || 0,
          completionTokens: result.usage.outputTokens || 0,
          totalTokens: result.usage.totalTokens || 0,
        },
        model: modelId,
        finishReason: result.finishReason || "stop",
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          `Ollama request timed out after ${this.timeoutMs}ms`
        );
      }
      throw error;
    }
  }

  async *stream(
    messages: Message[],
    options: CompletionOptions = {}
  ): AsyncIterableIterator<StreamChunk> {
    const modelId = options.model || this.defaultModel;
    const abortController = new AbortController();
    const timeoutId = setTimeout(
      () => abortController.abort(),
      this.timeoutMs
    );

    const ollamaModel = this.ollamaProvider(modelId);

    const tools = this.buildV2Tools(options.tools);

    try {
      const result = await ollamaModel.doStream({
        prompt: messages.map((msg) => {
          if (msg.role === "system") {
            return { role: "system" as const, content: msg.content };
          } else if (msg.role === "user") {
            return {
              role: "user" as const,
              content: [{ type: "text" as const, text: msg.content }],
            };
          } else {
            return {
              role: "assistant" as const,
              content: [{ type: "text" as const, text: msg.content }],
            };
          }
        }),
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
        topP: options.topP,
        frequencyPenalty: options.frequencyPenalty,
        presencePenalty: options.presencePenalty,
        stopSequences: options.stop,
        tools,
        abortSignal: abortController.signal,
      });

      const reader = result.stream.getReader();
      let usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | null = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (value.type === "text-delta") {
            yield {
              text: value.delta,
              isComplete: false,
            };
          } else if (value.type === "finish") {
            usage = value.usage;
          }
        }

        clearTimeout(timeoutId);

        yield {
          text: "",
          isComplete: true,
          usage: {
            promptTokens: usage?.inputTokens || 0,
            completionTokens: usage?.outputTokens || 0,
            totalTokens: usage?.totalTokens || 0,
          },
        };
      } finally {
        reader.releaseLock();
        clearTimeout(timeoutId);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          `Ollama stream timed out after ${this.timeoutMs}ms`
        );
      }
      throw error;
    }
  }
}
