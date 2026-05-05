import { generateText, streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { AIProvider, type Message, type CompletionOptions, type CompletionResult, type StreamChunk, type ModelInfo } from '../types/index';

export class ClaudeProvider extends AIProvider {
  readonly name = 'claude';
  readonly defaultModel = 'claude-3-5-sonnet-20241022';

  private apiKey: string;
  private timeoutMs: number;

  constructor(config: { apiKey: string; timeout?: number }) {
    super();
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
    } catch (_error) {
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

  async complete(
    messages: Message[],
    options: CompletionOptions = {}
  ): Promise<CompletionResult> {
    const model = options.model || this.defaultModel;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), this.timeoutMs);

    const tools = this.buildTools(options.tools);

    // Filter out system messages and use system parameter instead
    const filteredMessages = messages.filter(m => m.role !== 'system');

    const result = await generateText({
      model: anthropic(model),
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

    const tools = this.buildTools(options.tools);

    // Filter out system messages and use system parameter instead
    const filteredMessages = messages.filter(m => m.role !== 'system');

    const result = await streamText({
      model: anthropic(model),
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
