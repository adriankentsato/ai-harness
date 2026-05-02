import { Message, ToolDefinition, ToolCall, ProviderType } from './core';
import type { AIHarness } from '../harness';
import { IGenericType } from '../utils/types/generic-type';

export interface AgentConfig {
  name: string;
  description: string;
  provider: ProviderType;
  model?: string;
  systemPrompt?: string;
  tools?: string[]; // tool names the agent can use
  maxTokens?: number;
  temperature?: number;
}

export interface AgentContext {
  messages: Message[];
  tools: ToolDefinition<IGenericType, IGenericType>[];
  metadata?: Record<string, unknown>;
}

export interface AgentResult {
  response: string;
  toolCalls?: ToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, unknown>;
}

export abstract class Agent {
  abstract readonly name: string;
  abstract readonly description: string;
  protected config: AgentConfig;
  protected harness: AIHarness; // AIHarness instance

  constructor(config: AgentConfig, harness: AIHarness) {
    this.config = config;
    this.harness = harness;
  }

  abstract execute(input: string, context?: AgentContext): Promise<AgentResult>;

  protected async executeWithTools(
    messages: Message[],
    tools: ToolDefinition<IGenericType, IGenericType>[]
  ): Promise<AgentResult> {
    const result = await this.harness.complete(this.config.provider, messages, {
      model: this.config.model,
      tools,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: this.config.systemPrompt,
    });

    return {
      response: result.text,
      usage: result.usage,
      metadata: { model: result.model, finishReason: result.finishReason },
    };
  }
}
