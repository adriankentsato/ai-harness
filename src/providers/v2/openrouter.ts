import {
  AIProvider,
  type Message,
  type CompletionOptions,
  type CompletionResult,
  type StreamChunk,
  type ModelInfo,
} from "../../types/index";

import { createOpenRouter } from "../../models/openrouter";
import type {
  LanguageModelV2FunctionTool,
  LanguageModelV2ProviderDefinedTool,
  LanguageModelV2Content,
  LanguageModelV2Usage,
} from "@ai-sdk/provider";

export class OpenRouterProvider extends AIProvider {
  readonly name = "openrouter";
  readonly defaultModel = "openai/gpt-4o-mini";
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private openrouterProvider: ReturnType<typeof createOpenRouter>;

  constructor(config: { apiKey: string; baseUrl?: string; timeout?: number }) {
    super();
    this.baseUrl = config.baseUrl || "https://openrouter.ai/api/v1";
    this.timeoutMs = config.timeout || 60000;
    this.apiKey = config.apiKey;
    this.openrouterProvider = createOpenRouter({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
    });
  }

  validateConfig(): boolean {
    return !!this.apiKey;
  }

  async fetchModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as {
        data?: Array<{
          id: string;
          name: string;
          description?: string;
          context_length?: number;
          pricing?: {
            prompt?: number;
            completion?: number;
          };
        }>;
      };

      // Handle malformed response
      if (!Array.isArray(data?.data)) {
        return [];
      }

      return data.data.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description ?? '',
        contextLength: m.context_length ?? 0,
        pricing: {
          prompt: m.pricing?.prompt,
          completion: m.pricing?.completion,
        },
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

    const openrouterModel = this.openrouterProvider(modelId);

    const prompt = messages.map((msg) => {
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
    });

    const tools = this.buildV2Tools(options.tools) as Array<
      LanguageModelV2FunctionTool | LanguageModelV2ProviderDefinedTool
    > | undefined;

    try {
      const result = await openrouterModel.doGenerate({
        prompt,
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
        (c: LanguageModelV2Content) => c.type === "text"
      ) as Array<{ type: "text"; text: string }>;
      const textContent = textParts.map((c) => c.text).join("");

      return {
        text: textContent,
        usage: {
          promptTokens: result.usage.inputTokens || 0,
          completionTokens: result.usage.outputTokens || 0,
          totalTokens:
            result.usage.totalTokens ||
            (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
        model: modelId,
        finishReason: result.finishReason || "stop",
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          `OpenRouter request timed out after ${this.timeoutMs}ms`
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

    const openrouterModel = this.openrouterProvider(modelId);

    const prompt = messages.map((msg) => {
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
    });

    const tools = this.buildV2Tools(options.tools) as Array<
      LanguageModelV2FunctionTool | LanguageModelV2ProviderDefinedTool
    > | undefined;

    try {
      const result = await openrouterModel.doStream({
        prompt,
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
      let usage: LanguageModelV2Usage | null = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (value.type === "text-delta") {
            yield { text: value.delta, isComplete: false };
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
            totalTokens:
              usage?.totalTokens ||
              (usage?.inputTokens || 0) + (usage?.outputTokens || 0),
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
          `OpenRouter stream timed out after ${this.timeoutMs}ms`
        );
      }
      throw error;
    }
  }
}
