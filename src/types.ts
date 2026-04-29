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
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
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
}

export type ProviderType = 'openai' | 'claude' | 'nvidia' | 'openrouter' | 'ollama';

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  timeout?: number;
}

export type ProviderConfigs = Partial<Record<ProviderType, ProviderConfig>>;

// Planning types
export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies?: string[]; // step IDs this step depends on
  tool?: string; // tool name if this step uses a tool
  toolArgs?: Record<string, unknown>; // arguments for the tool
  result?: string; // result of step execution
  error?: string; // error if step failed
}

export interface Plan {
  id: string;
  goal: string;
  description: string;
  steps: PlanStep[];
  status: 'created' | 'executing' | 'completed' | 'failed' | 'paused';
  createdAt: Date;
  updatedAt: Date;
  currentStep?: string; // ID of currently executing step
}

export interface PlanningOptions {
  maxSteps?: number;
  allowTools?: boolean;
  requireConfirmation?: boolean;
  timeout?: number;
}

export interface PlanningResult {
  plan: Plan;
  executionLog: string[];
  success: boolean;
  error?: string;
}
