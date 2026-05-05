import { AIProvider, type Message, type CompletionOptions, type CompletionResult, type StreamChunk, type ModelInfo } from '../../types/index';
import { createNvidia } from '../../models/nvidia-nim';

export class NvidiaProvider extends AIProvider {
  readonly name = 'nvidia';
  readonly defaultModel = 'meta/llama-3.1-405b-instruct';

  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private nvidiaProvider: ReturnType<typeof createNvidia>;


  constructor(config: { apiKey: string; baseUrl?: string; timeout?: number }) {
    super();
    this.baseUrl = config.baseUrl || 'https://integrate.api.nvidia.com/v1';
    this.timeoutMs = config.timeout || 60000;
    this.apiKey = config.apiKey;
    this.nvidiaProvider = createNvidia({
      apiKey: this.apiKey,
      baseURL: this.baseUrl
    });
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
    const modelId = options.model || this.defaultModel;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), this.timeoutMs);
    
    // Create the custom LanguageModelV2 instance
    const nimModel = this.nvidiaProvider(modelId);
    
    const tools = this.buildV2Tools(options.tools);

    try {
      const result = await nimModel.doGenerate({
        prompt: messages.map(msg => {
          if (msg.role === 'system') {
            return { role: 'system' as const, content: msg.content };
          } else if (msg.role === 'user') {
            return { 
              role: 'user' as const, 
              content: [{ type: 'text' as const, text: msg.content }]
            };
          } else {
            return { 
              role: 'assistant' as const, 
              content: [{ type: 'text' as const, text: msg.content }]
            };
          }
        }),
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
        topP: options.topP,
        frequencyPenalty: options.frequencyPenalty,
        presencePenalty: options.presencePenalty,
        stopSequences: options.stop,
        tools: tools,
        abortSignal: abortController.signal,
      });

      clearTimeout(timeoutId);

      const textContent = result.content.find(c => c.type === 'text')?.text || '';
      
      return {
        text: textContent,
        usage: {
          promptTokens: result.usage.inputTokens || 0,
          completionTokens: result.usage.outputTokens || 0,
          totalTokens: result.usage.totalTokens || 0,
        },
        model: modelId,
        finishReason: result.finishReason || 'stop',
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`NVIDIA NIM request timed out after ${this.timeoutMs}ms`);
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
    const timeoutId = setTimeout(() => abortController.abort(), this.timeoutMs);
    
    // Create the custom LanguageModelV2 instance
    const nimModel = this.nvidiaProvider(modelId);
    
    const tools = this.buildV2Tools(options.tools);

    try {
      const result = await nimModel.doStream({
        prompt: messages.map(msg => {
          if (msg.role === 'system') {
            return { role: 'system' as const, content: msg.content };
          } else if (msg.role === 'user') {
            return { 
              role: 'user' as const, 
              content: [{ type: 'text' as const, text: msg.content }]
            };
          } else {
            return { 
              role: 'assistant' as const, 
              content: [{ type: 'text' as const, text: msg.content }]
            };
          }
        }),
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
        topP: options.topP,
        frequencyPenalty: options.frequencyPenalty,
        presencePenalty: options.presencePenalty,
        stopSequences: options.stop,
        tools: tools,
        abortSignal: abortController.signal,
      });

      clearTimeout(timeoutId);

      const reader = result.stream.getReader();
      let accumulatedText = '';
      let usage = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (value.type === 'text-delta') {
            accumulatedText += value.delta;
            yield {
              text: value.delta,
              isComplete: false,
            };
          } else if (value.type === 'finish') {
            usage = value.usage;
          }
        }

        yield {
          text: '',
          isComplete: true,
          usage: {
            promptTokens: usage?.inputTokens || 0,
            completionTokens: usage?.outputTokens || 0,
            totalTokens: usage?.totalTokens || 0,
          },
        };
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`NVIDIA NIM stream timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    }
  }
}
