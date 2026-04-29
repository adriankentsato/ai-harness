import { generateText, streamText, tool, type CoreTool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import type { AIProvider, Message, CompletionOptions, CompletionResult, StreamChunk, ModelInfo, ToolDefinition } from '../types.js';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  readonly defaultModel = 'gpt-4o-mini';

  private apiKey: string;
  private timeoutMs: number;

  constructor(config: { apiKey: string; timeout?: number }) {
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeout || 60000;
  }

  validateConfig(): boolean {
    return !!this.apiKey && this.apiKey.startsWith('sk-');
  }

  async fetchModels(): Promise<ModelInfo[]> {
    // First try to use library-provided model list
    const libraryModels: string[] = [
      'o1',
      'o1-2024-12-17',
      'o1-mini',
      'o1-mini-2024-09-12',
      'o1-preview',
      'o1-preview-2024-09-12',
      'o3-mini',
      'o3-mini-2025-01-31',
      'o3',
      'o3-2025-04-16',
      'o4-mini',
      'o4-mini-2025-04-16',
      'gpt-5',
      'gpt-5-2025-08-07',
      'gpt-5-mini',
      'gpt-5-mini-2025-08-07',
      'gpt-5-nano',
      'gpt-5-nano-2025-08-07',
      'gpt-5-chat-latest',
      'gpt-4.1',
      'gpt-4.1-2025-04-14',
      'gpt-4.1-mini',
      'gpt-4.1-mini-2025-04-14',
      'gpt-4.1-nano',
      'gpt-4.1-nano-2025-04-14',
      'gpt-4o',
      'gpt-4o-2024-05-13',
      'gpt-4o-2024-08-06',
      'gpt-4o-2024-11-20',
      'gpt-4o-audio-preview',
      'gpt-4o-audio-preview-2024-10-01',
      'gpt-4o-audio-preview-2024-12-17',
      'gpt-4o-search-preview',
      'gpt-4o-search-preview-2025-03-11',
      'gpt-4o-mini-search-preview',
      'gpt-4o-mini-search-preview-2025-03-11',
      'gpt-4o-mini',
      'gpt-4o-mini-2024-07-18',
      'gpt-4-turbo',
      'gpt-4-turbo-2024-04-09',
      'gpt-4-turbo-preview',
      'gpt-4-0125-preview',
      'gpt-4-1106-preview',
      'gpt-4',
      'gpt-4-0613',
      'gpt-4.5-preview',
      'gpt-4.5-preview-2025-02-27',
      'gpt-3.5-turbo-0125',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-1106',
      'chatgpt-4o-latest',
    ];

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
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
          .filter(m => m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3') || m.id.includes('o4'))
          .map(m => ({
            id: m.id,
            name: m.id,
            description: `Owned by ${m.owned_by}`,
          }));
      }
    } catch (error) {
      // Fallback to library models if API fails
    }

    // Fallback to library-provided models
    return libraryModels.map(id => ({
      id,
      name: id,
      description: `OpenAI ${id}`,
    }));
  }

  private buildTools(tools?: ToolDefinition[]): Record<string, CoreTool> | undefined {
    if (!tools || tools.length === 0) return undefined;

    const result: Record<string, CoreTool> = {};
    for (const t of tools) {
      result[t.name] = tool({
        description: t.description,
        parameters: z.object(this.convertParams(t.parameters)),
        execute: t.execute,
      }) as CoreTool;
    }
    return result;
  }

  private convertParams(params: Record<string, unknown>): Record<string, z.ZodType> {
    if (!params || typeof params !== 'object') return {};

    const props = (params.properties || {}) as Record<string, { type: string; description?: string }>;
    const result: Record<string, z.ZodType> = {};

    for (const [key, value] of Object.entries(props)) {
      if (value.type === 'string') {
        result[key] = z.string().describe(value.description || '');
      } else if (value.type === 'number') {
        result[key] = z.number().describe(value.description || '');
      } else if (value.type === 'boolean') {
        result[key] = z.boolean().describe(value.description || '');
      } else {
        result[key] = z.any().describe(value.description || '');
      }
    }
    return result;
  }

  async complete(
    messages: Message[],
    options: CompletionOptions = {}
  ): Promise<CompletionResult> {
    const model = options.model || this.defaultModel;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), this.timeoutMs);

    const tools = this.buildTools(options.tools);

    const result = await generateText({
      model: openai(model),
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      topP: options.topP,
      frequencyPenalty: options.frequencyPenalty,
      presencePenalty: options.presencePenalty,
      stopSequences: options.stop,
      tools,
      abortSignal: abortController.signal,
    });

    clearTimeout(timeoutId);

    return {
      text: result.text,
      usage: {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      },
      model,
      finishReason: result.finishReason || 'stop',
    };
  }

  async *stream(
    messages: Message[],
    options: CompletionOptions = {}
  ): AsyncIterableIterator<StreamChunk> {
    const model = options.model || this.defaultModel;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), this.timeoutMs);

    const tools = this.buildTools(options.tools);

    const result = await streamText({
      model: openai(model),
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      topP: options.topP,
      frequencyPenalty: options.frequencyPenalty,
      presencePenalty: options.presencePenalty,
      stopSequences: options.stop,
      tools,
      abortSignal: abortController.signal,
    });

    clearTimeout(timeoutId);

    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
      yield {
        text: chunk,
        isComplete: false,
      };
    }

    yield {
      text: '',
      isComplete: true,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    };
  }
}
