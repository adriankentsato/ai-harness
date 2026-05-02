import { generateText, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { AIProvider, type Message, type CompletionOptions, type CompletionResult, type StreamChunk, type ModelInfo } from '../types/index';

export class NvidiaProvider extends AIProvider {
  readonly name = 'nvidia';
  readonly defaultModel = 'meta/llama-3.1-405b-instruct';

  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: { apiKey: string; baseUrl?: string; timeout?: number }) {
    super();
    this.baseUrl = config.baseUrl || 'https://integrate.api.nvidia.com/v1';
    this.timeoutMs = config.timeout || 60000;
    this.apiKey = config.apiKey;
  }

  validateConfig(): boolean {
    return !!this.apiKey;
  }

  async fetchModels(): Promise<ModelInfo[]> {
    const response = await fetch(`${this.baseUrl}/models`, {
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
        object: string;
        created: number;
        owned_by: string;
      }>;
    };

    return data.data.map(m => ({
      id: m.id,
      name: m.id,
      description: `Owned by ${m.owned_by}`,
    }));
  }

  async complete(
    messages: Message[],
    options: CompletionOptions = {}
  ): Promise<CompletionResult> {
    const model = options.model || this.defaultModel;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), this.timeoutMs);

    const nvidia = createOpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
    });
    const tools = this.buildTools(options.tools);

    const result = await generateText({
      model: nvidia(model),
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
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

    return {
      text: result.text,
      usage: {
        promptTokens: result.usage.inputTokens || 0,
        completionTokens: result.usage.outputTokens || 0,
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

    const nvidia = createOpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
    });
    const tools = this.buildTools(options.tools);

    const result = await streamText({
      model: nvidia(model),
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
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

    for await (const chunk of result.textStream) {
      yield {
        text: chunk,
        isComplete: false,
      };
    }

    const usage = await result.usage;

    yield {
      text: '',
      isComplete: true,
      usage: {
        promptTokens: usage.inputTokens || 0,
        completionTokens: usage.outputTokens || 0,
        totalTokens: usage.totalTokens || 0,
      },
    };
  }
}
