import {
  AIProvider,
  type Message,
  type CompletionOptions,
  type CompletionResult,
  type StreamChunk,
  type ModelInfo,
} from '../../types/index';

import { createGoogle } from '../../models/google-gemini';
import type {
  LanguageModelV2FunctionTool,
  LanguageModelV2ProviderDefinedTool,
  LanguageModelV2Content,
  LanguageModelV2Usage,
} from '@ai-sdk/provider';

export class GoogleProvider extends AIProvider {
  readonly name = 'google';
  readonly defaultModel = 'gemini-2.0-flash';
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private googleProvider: ReturnType<typeof createGoogle>;

  constructor(config: {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
  }) {
    super();
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    this.timeoutMs = config.timeout || 60000;
    this.googleProvider = createGoogle({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
    });
  }

  validateConfig(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  async fetchModels(): Promise<ModelInfo[]> {
    // First try to use the Google API to list models
    try {
      const response = await fetch(
        `${this.baseUrl}/models?key=${this.apiKey}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json() as {
          models: Array<{
            name: string;
            displayName: string;
            description: string;
            supportedGenerationMethods: string[];
          }>;
        };

        return data.models
          .filter((m) => m.supportedGenerationMethods.includes('generateContent'))
          .map((m) => {
            const id = m.name.split('/').pop() || m.name;
            return {
              id,
              name: m.displayName,
              description: m.description,
              contextLength: this.getContextLength(id),
            };
          });
      }
    } catch (_error) {
      // Fallback to library models if API fails
    }

    // Fallback to known model list
    const fallbackModels: ModelInfo[] = [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Google\'s fastest and most efficient model', contextLength: 1048576 },
      { id: 'gemini-2.0-flash-thinking', name: 'Gemini 2.0 Flash Thinking', description: 'Gemini 2.0 Flash with thinking mode', contextLength: 1048576 },
      { id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro', description: 'Google\'s most capable model', contextLength: 1048576 },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Previous generation Pro model', contextLength: 2097152 },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Previous generation Flash model', contextLength: 1048576 },
      { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B', description: 'Smaller Flash variant', contextLength: 1048576 },
      { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro', description: 'First generation Pro model', contextLength: 32768 },
    ];

    return fallbackModels;
  }

  private getContextLength(modelId: string): number {
    if (modelId.includes('2.0')) return 1048576; // 1M tokens for Gemini 2.0
    if (modelId.includes('1.5-pro')) return 2097152; // 2M tokens for Gemini 1.5 Pro
    if (modelId.includes('1.5-flash')) return 1048576; // 1M tokens for Gemini 1.5 Flash
    if (modelId.includes('1.0')) return 32768; // 32K tokens for Gemini 1.0
    return 1048576; // Default to 1M tokens
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

    // Create the Google LanguageModelV2 instance
    const googleModel = this.googleProvider(modelId);

    // Convert messages to LanguageModelV2 format
    const prompt = messages.map((msg) => {
      if (msg.role === 'system') {
        return { role: 'system' as const, content: msg.content };
      } else if (msg.role === 'user') {
        return {
          role: 'user' as const,
          content: [{ type: 'text' as const, text: msg.content }],
        };
      } else {
        return {
          role: 'assistant' as const,
          content: [{ type: 'text' as const, text: msg.content }],
        };
      }
    });

    const tools = this.buildV2Tools(options.tools) as Array<
      LanguageModelV2FunctionTool | LanguageModelV2ProviderDefinedTool
    > | undefined;

    try {
      const result = await googleModel.doGenerate({
        prompt,
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
        topP: options.topP,
        tools,
        abortSignal: abortController.signal,
      });

      clearTimeout(timeoutId);

      const textParts = result.content.filter(
        (c: LanguageModelV2Content) => c.type === 'text'
      ) as Array<{ type: 'text'; text: string }>;
      const textContent = textParts.map((c) => c.text).join('');

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
        finishReason: result.finishReason || 'stop',
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `Google Gemini request timed out after ${this.timeoutMs}ms`
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

    // Create the Google LanguageModelV2 instance
    const googleModel = this.googleProvider(modelId);

    // Convert messages to LanguageModelV2 format
    const prompt = messages.map((msg) => {
      if (msg.role === 'system') {
        return { role: 'system' as const, content: msg.content };
      } else if (msg.role === 'user') {
        return {
          role: 'user' as const,
          content: [{ type: 'text' as const, text: msg.content }],
        };
      } else {
        return {
          role: 'assistant' as const,
          content: [{ type: 'text' as const, text: msg.content }],
        };
      }
    });

    const tools = this.buildV2Tools(options.tools) as Array<
      LanguageModelV2FunctionTool | LanguageModelV2ProviderDefinedTool
    > | undefined;

    try {
      const result = await googleModel.doStream({
        prompt,
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
        topP: options.topP,
        tools,
        abortSignal: abortController.signal,
      });

      const reader = result.stream.getReader();
      let usage: LanguageModelV2Usage | null = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (value.type === 'text-delta') {
            yield { text: value.delta, isComplete: false };
          } else if (value.type === 'finish') {
            usage = value.usage;
          }
        }

        clearTimeout(timeoutId);

        yield {
          text: '',
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
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `Google Gemini stream timed out after ${this.timeoutMs}ms`
        );
      }
      throw error;
    }
  }
}
