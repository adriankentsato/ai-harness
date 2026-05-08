import {
  AIProvider,
  type Message,
  type CompletionOptions,
  type CompletionResult,
  type StreamChunk,
  type ModelInfo,
} from '../../types/index';

import { createOpenAIModel } from '../../models/openai-chat';
import type {
  LanguageModelV2FunctionTool,
  LanguageModelV2ProviderDefinedTool,
  LanguageModelV2Content,
  LanguageModelV2Usage,
} from '@ai-sdk/provider';

export class OpenAIProvider extends AIProvider {
  readonly name = 'openai';
  readonly defaultModel = 'gpt-4o-mini';
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private openAIProvider: ReturnType<typeof createOpenAIModel>;

  constructor(config: {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
  }) {
    super();
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.timeoutMs = config.timeout || 60000;
    this.openAIProvider = createOpenAIModel({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
    });
  }

  validateConfig(): boolean {
    return !!this.apiKey && this.apiKey.startsWith('sk-');
  }

  async fetchModels(): Promise<ModelInfo[]> {
    // First try to use the OpenAI API to list models
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json() as {
          data: Array<{
            id: string;
            object: string;
            created: number;
            owned_by: string;
          }>;
        };

        return data.data
          .filter(m => 
            m.id.includes('gpt') || 
            m.id.includes('o1') || 
            m.id.includes('o3') ||
            m.id.includes('o4') ||
            m.id.includes('chatgpt')
          )
          .map(m => ({
            id: m.id,
            name: m.id,
            description: `Owned by ${m.owned_by}`,
            contextLength: this.getContextLength(m.id),
          }));
      }
    } catch (_error) {
      // Fallback to library models if API fails
    }

    // Fallback to known model list
    const fallbackModels: ModelInfo[] = [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable model for complex tasks', contextLength: 128000 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and efficient', contextLength: 128000 },
      { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Latest GPT-4.1 model', contextLength: 128000 },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Mini variant of GPT-4.1', contextLength: 128000 },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', description: 'Nano variant of GPT-4.1', contextLength: 128000 },
      { id: 'o1', name: 'o1', description: 'OpenAI reasoning model', contextLength: 128000 },
      { id: 'o1-mini', name: 'o1 Mini', description: 'Mini reasoning model', contextLength: 128000 },
      { id: 'o1-preview', name: 'o1 Preview', description: 'Preview of reasoning model', contextLength: 128000 },
      { id: 'o3', name: 'o3', description: 'Next generation reasoning', contextLength: 128000 },
      { id: 'o3-mini', name: 'o3 Mini', description: 'Mini variant of o3', contextLength: 128000 },
      { id: 'o4-mini', name: 'o4 Mini', description: 'Mini variant of o4', contextLength: 128000 },
      { id: 'gpt-5', name: 'GPT-5', description: 'Next generation GPT', contextLength: 128000 },
      { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'Mini variant of GPT-5', contextLength: 128000 },
      { id: 'gpt-5-nano', name: 'GPT-5 Nano', description: 'Nano variant of GPT-5', contextLength: 128000 },
    ];

    return fallbackModels;
  }

  private getContextLength(modelId: string): number {
    // o1/o3 models have different context limits
    if (modelId.startsWith('o1') || modelId.startsWith('o3') || modelId.startsWith('o4')) {
      return 128000; // o1/o3/o4 series
    }
    // GPT-4 series
    if (modelId.includes('gpt-4')) return 128000;
    // GPT-5 series (assumed)
    if (modelId.includes('gpt-5')) return 128000;
    // GPT-3.5 series
    if (modelId.includes('gpt-3.5')) return 16385;
    // Default
    return 128000;
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

    // Create the OpenAI LanguageModelV2 instance
    const openAIModel = this.openAIProvider(modelId);

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
      const result = await openAIModel.doGenerate({
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
          `OpenAI request timed out after ${this.timeoutMs}ms`
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

    // Create the OpenAI LanguageModelV2 instance
    const openAIModel = this.openAIProvider(modelId);

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
      const result = await openAIModel.doStream({
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
          `OpenAI stream timed out after ${this.timeoutMs}ms`
        );
      }
      throw error;
    }
  }
}