import { ZodType } from "zod";
import { tool, type Tool } from 'ai';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  text: string;
  isComplete: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  tools?: ToolDefinition[];
  system?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ZodType<any>;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  name: string;
  result: string;
  error?: string;
}

export interface CompletionResult {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: string;
}

export interface ModelInfo {
  id: string;
  name?: string;
  description?: string;
  contextLength?: number;
  pricing?: {
    prompt?: number;
    completion?: number;
  };
}

export abstract class AIProvider {
  abstract readonly name: string;
  abstract readonly defaultModel: string;

  abstract complete(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult>;

  abstract stream(
    messages: Message[],
    options?: CompletionOptions
  ): AsyncIterableIterator<StreamChunk>;

  abstract validateConfig(): boolean;

  abstract fetchModels(): Promise<ModelInfo[]>;

  protected buildTools(tools?: ToolDefinition[]): Record<string, Tool> | undefined {
    if (!tools || tools.length === 0) return undefined;

    const result: Record<string, Tool> = {};
    for (const t of tools) {
      result[t.name] = tool({
        description: t.description,
        inputSchema: t.parameters,
        execute: t.execute,
      });
    }
    return result;
  }
}

export type ProviderType = 'openai' | 'claude' | 'nvidia' | 'openrouter' | 'ollama' | 'google';

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  timeout?: number;
}

export type ProviderConfigs = Partial<Record<ProviderType, ProviderConfig>>;
