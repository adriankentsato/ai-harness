import { generateText, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { AIProvider, type Message, type CompletionOptions, type CompletionResult, type StreamChunk, type ModelInfo } from '../types/index';

export class OpenRouterProvider extends AIProvider {
  readonly name = 'openrouter';
  readonly defaultModel = 'openai/gpt-4o-mini';

  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: { apiKey: string; baseUrl?: string; timeout?: number }) {
    super();
    this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
    this.timeoutMs = config.timeout || 60000;
    this.apiKey = config.apiKey;
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

    // Filter out system messages and use system parameter instead
    const filteredMessages = messages.filter(m => m.role !== 'system');

    const result = await generateText({
      model: openrouter(model),
      messages: filteredMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      system: options.system,
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

    const openrouter = createOpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
      headers: {
        'HTTP-Referer': 'https://ai-harness.local',
        'X-Title': 'AI Harness',
      },
    });
    const tools = this.buildTools(options.tools);

    // Filter out system messages and use system parameter instead
    const filteredMessages = messages.filter(m => m.role !== 'system');

    const result = await streamText({
      model: openrouter(model),
      messages: filteredMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      system: options.system,
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

    let _fullText = '';
    for await (const chunk of result.textStream) {
      _fullText += chunk;
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
