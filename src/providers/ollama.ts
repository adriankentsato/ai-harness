import { generateText, streamText, tool, type CoreTool } from 'ai';
import { createOllama } from 'ollama-ai-provider';
import { z } from 'zod';
import type { AIProvider, Message, CompletionOptions, CompletionResult, StreamChunk, ModelInfo, ToolDefinition } from '../types/index';

export class OllamaProvider implements AIProvider {
  readonly name = 'ollama';
  readonly defaultModel = 'llama3.1';

  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: { baseUrl?: string; timeout?: number } = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.timeoutMs = config.timeout || 60000;
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
    return true;
  }

  async fetchModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const data = await response.json() as {
        models: Array<{
          name: string;
          model: string;
          size?: number;
          parameter_size?: string;
          quantization_level?: string;
        }>;
      };

      return data.models.map(m => ({
        id: m.name,
        name: m.name,
        description: `${m.parameter_size || 'Unknown'} ${m.quantization_level || ''}`.trim(),
      }));
    } catch {
      return [];
    }
  }

  async complete(
    messages: Message[],
    options: CompletionOptions = {}
  ): Promise<CompletionResult> {
    const model = options.model || this.defaultModel;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), this.timeoutMs);

    const ollama = createOllama({ baseURL: `${this.baseUrl}/api` });
    const tools = this.buildTools(options.tools);

    const result = await generateText({
      model: ollama(model),
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

    const ollama = createOllama({ baseURL: `${this.baseUrl}/api` });
    const tools = this.buildTools(options.tools);

    const result = await streamText({
      model: ollama(model),
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
