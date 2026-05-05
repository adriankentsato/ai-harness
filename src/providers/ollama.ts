import { generateText, streamText } from 'ai';
import { createOllama } from 'ollama-ai-provider';
import { AIProvider, type Message, type CompletionOptions, type CompletionResult, type StreamChunk, type ModelInfo } from '../types/index';
import { IGenericType } from '../utils/types/generic-type';

export class OllamaProvider extends AIProvider {
  readonly name = 'ollama';
  readonly defaultModel = 'llama3.1';

  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: { baseUrl?: string; timeout?: number } = {}) {
    super();
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.timeoutMs = config.timeout || 60000;
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

    // Filter out system messages and use system parameter instead
    const filteredMessages = messages.filter(m => m.role !== 'system');

    const result = await generateText({
      model: ollama(model) as IGenericType,
      messages: filteredMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      system: options.system,
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
        promptTokens: result.usage.promptTokens || 0,
        completionTokens: result.usage.completionTokens || 0,
        totalTokens: result.usage.totalTokens || 0,
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

    // Filter out system messages and use system parameter instead
    const filteredMessages = messages.filter(m => m.role !== 'system');

    const result = await streamText({
      model: ollama(model) as IGenericType,
      messages: filteredMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      system: options.system,
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
