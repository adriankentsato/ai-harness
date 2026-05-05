import { CoreTool, tool as toolV1 } from 'ai-v1';
import { z } from 'zod';
import { IGenericType } from '../utils/types/generic-type';

type ToolSetV1 = Record<string, CoreTool>;

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
  tools?: ToolDefinition<IGenericType, IGenericType>[];
  system?: string;
}

export interface ToolDefinition<INPUT, OUTPUT> {
  name: string;
  description: string;
  parameters: z.ZodTypeAny;
  execute: (args: INPUT) => Promise<OUTPUT>;
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

  protected buildTools(tools?: ToolDefinition<IGenericType, IGenericType>[]): ToolSetV1 | undefined {
    if (!tools || tools.length === 0) return undefined;

    // Return tool definitions directly to avoid type recursion
    // The providers will handle tool creation
    return tools.reduce((acc, t) => {
      acc[t.name] = toolV1({
        description: t.description,
        parameters: t.parameters as IGenericType,
        execute: t.execute,
      });
      return acc;
    }, {} as ToolSetV1);
  }

  /**
   * Convert tools to LanguageModelV2 format for new AI SDK V2 providers
   */
  protected buildV2Tools(tools?: ToolDefinition<IGenericType, IGenericType>[]): any[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    
    return tools.map((t: any) => ({
      type: 'function' as const,
      name: t.name || t.function?.name,
      description: t.description || t.function?.description,
      inputSchema: t.parameters || t.function?.parameters
    }));
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
