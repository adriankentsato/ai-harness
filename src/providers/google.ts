import { generateText, streamText, tool, type CoreTool } from 'ai';
import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from '@ai-sdk/google';
import { z } from 'zod';
import type { AIProvider, Message, CompletionOptions, CompletionResult, StreamChunk, ModelInfo, ToolDefinition } from '../types/index';

export class GoogleProvider implements AIProvider {
  readonly name = 'google';
  readonly defaultModel = 'gemini-2.0-flash-exp';

  private apiKey: string;
  private timeoutMs: number;
  private google: GoogleGenerativeAIProvider;

  constructor(config: { apiKey: string; timeout?: number }) {
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeout || 60000;
    this.google = createGoogleGenerativeAI({ apiKey: this.apiKey });
  }

  validateConfig(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  async fetchModels(): Promise<ModelInfo[]> {
    // First try to use library-provided model list
    const libraryModels: string[] = [
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash-thinking-exp',
      'gemini-2.0-flash-lite-preview',
      'gemini-2.0-pro-exp',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.0-pro',
    ];

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

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
          .filter(m => m.supportedGenerationMethods.includes('generateContent'))
          .map(m => {
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

    // Fallback to library-provided models
    return libraryModels.map(id => ({
      id,
      name: id,
      description: `Google ${id}`,
      contextLength: this.getContextLength(id),
    }));
  }

  private getContextLength(modelId: string): number {
    if (modelId.includes('2.0')) return 1048576; // 1M tokens for Gemini 2.0
    if (modelId.includes('1.5-pro')) return 2097152; // 2M tokens for Gemini 1.5 Pro
    if (modelId.includes('1.5-flash')) return 1048576; // 1M tokens for Gemini 1.5 Flash
    if (modelId.includes('1.0')) return 32768; // 32K tokens for Gemini 1.0
    return 1048576; // Default to 1M tokens
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
      model: this.google(model),
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
      model: this.google(model),
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
