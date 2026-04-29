import { generateText, streamText, tool, type CoreTool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import type { AIProvider, Message, CompletionOptions, CompletionResult, StreamChunk, ModelInfo, ToolDefinition } from '../types.js';

export class OpenRouterProvider implements AIProvider {
  readonly name = 'openrouter';
  readonly defaultModel = 'openai/gpt-4o-mini';

  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: { apiKey: string; baseUrl?: string; timeout?: number }) {
    this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
    this.timeoutMs = config.timeout || 60000;
    this.apiKey = config.apiKey;
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

  validateConfig(): boolean {
    return !!this.apiKey;
  }

  async fetchModels(): Promise<ModelInfo[]> {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = await response.json() as {
      data: Array<{
        id: string;
        name: string;
        description: string;
        context_length: number;
        pricing: {
          prompt: number;
          completion: number;
        };
      }>;
    };

    return data.data.map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      contextLength: m.context_length,
      pricing: {
        prompt: m.pricing?.prompt,
        completion: m.pricing?.completion,
      },
    }));
  }

  async complete(
    messages: Message[],
    options: CompletionOptions = {}
  ): Promise<CompletionResult> {
    const model = options.model || this.defaultModel;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), this.timeoutMs);

    const openrouter = createOpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
      headers: {
        'HTTP-Referer': 'https://ai-harness.local',
        'X-Title': 'AI Harness',
      },
    });
    const tools = this.buildTools(options.tools);

    const result = await generateText({
      model: openrouter(model),
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

    const openrouter = createOpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
      headers: {
        'HTTP-Referer': 'https://ai-harness.local',
        'X-Title': 'AI Harness',
      },
    });
    const tools = this.buildTools(options.tools);

    const result = await streamText({
      model: openrouter(model),
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
