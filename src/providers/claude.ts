import { generateText, streamText, tool, type CoreTool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type { AIProvider, Message, CompletionOptions, CompletionResult, StreamChunk, ModelInfo, ToolDefinition } from '../types.js';

export class ClaudeProvider implements AIProvider {
  readonly name = 'claude';
  readonly defaultModel = 'claude-3-5-sonnet-20241022';

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
      'claude-4-opus-20250514',
      'claude-4-sonnet-20250514', 
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-latest',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620',
      'claude-3-5-haiku-latest',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-latest',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ];

    try {
      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
      });

      if (response.ok) {
        const data = await response.json() as {
          data: Array<{
            id: string;
            object: string;
            created: number;
            type: string;
          }>;
        };

        return data.data.map(m => ({
          id: m.id,
          name: m.id,
          description: `Anthropic ${m.id}`,
          contextLength: m.id.includes('opus') ? 200000 : 200000,
        }));
      }
    } catch (error) {
      // Fallback to library models if API fails
    }

    // Fallback to library-provided models
    return libraryModels.map(id => ({
      id,
      name: id,
      description: `Anthropic ${id}`,
      contextLength: id.includes('opus') ? 200000 : 200000,
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
      model: anthropic(model),
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      topP: options.topP,
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
      model: anthropic(model),
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      topP: options.topP,
      tools,
      abortSignal: abortController.signal,
    });

    clearTimeout(timeoutId);

    for await (const chunk of result.textStream) {
      yield {
        text: chunk,
        isComplete: false,
      };
    }

    yield {
      text: '',
      isComplete: true,
    };
  }
}
