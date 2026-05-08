import {
  AIProvider,
  type Message,
  type CompletionOptions,
  type CompletionResult,
  type StreamChunk,
  type ModelInfo,
} from '../../types/index';

import { createClaude } from '../../models/claude';
import type {
  LanguageModelV2FunctionTool,
  LanguageModelV2ProviderDefinedTool,
  LanguageModelV2Content,
  LanguageModelV2Usage,
} from '@ai-sdk/provider';

export class ClaudeProvider extends AIProvider {
  readonly name = 'claude';
  readonly defaultModel = 'claude-3-7-sonnet-20250219';
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private claudeProvider: ReturnType<typeof createClaude>;

  constructor(config: {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
  }) {
    super();
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
    this.timeoutMs = config.timeout || 60000;
    this.claudeProvider = createClaude({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
    });
  }

  validateConfig(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  async fetchModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
      });

      if (response.ok) {
        const data = await response.json() as {
          data: Array<{
            id: string;
            name: string;
          }>;
        };

        return data.data.map((m) => ({
          id: m.id,
          name: m.name || m.id,
          description: `Anthropic ${m.id}`,
          contextLength: 200000,
        }));
      }
    } catch (_error) {
      // Fallback
    }

    const fallbackModels: ModelInfo[] = [
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', description: 'Anthropic\'s latest high-performance model', contextLength: 200000 },
      { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet Latest', description: 'Latest 3.5 Sonnet', contextLength: 200000 },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Claude 3.5 Sonnet (Oct 2024)', contextLength: 200000 },
      { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku Latest', description: 'Latest 3.5 Haiku', contextLength: 200000 },
      { id: 'claude-3-opus-latest', name: 'Claude 3 Opus Latest', description: 'Latest Claude 3 Opus', contextLength: 200000 },
    ];

    return fallbackModels;
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

    const claudeModel = this.claudeProvider(modelId);

    const prompt = messages.map((msg) => {
      if (msg.role === 'system') {
        return { role: 'system' as const, content: msg.content };
      } else {
        return {
          role: msg.role as 'user' | 'assistant',
          content: [{ type: 'text' as const, text: msg.content }],
        };
      }
    });

    const tools = this.buildV2Tools(options.tools) as Array<
      LanguageModelV2FunctionTool | LanguageModelV2ProviderDefinedTool
    > | undefined;

    try {
      const result = await claudeModel.doGenerate({
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
          `Claude request timed out after ${this.timeoutMs}ms`
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

    const claudeModel = this.claudeProvider(modelId);

    const prompt = messages.map((msg) => {
      if (msg.role === 'system') {
        return { role: 'system' as const, content: msg.content };
      } else {
        return {
          role: msg.role as 'user' | 'assistant',
          content: [{ type: 'text' as const, text: msg.content }],
        };
      }
    });

    const tools = this.buildV2Tools(options.tools) as Array<
      LanguageModelV2FunctionTool | LanguageModelV2ProviderDefinedTool
    > | undefined;

    try {
      const result = await claudeModel.doStream({
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
          `Claude stream timed out after ${this.timeoutMs}ms`
        );
      }
      throw error;
    }
  }
}
