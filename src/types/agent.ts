import { Message, ToolDefinition, ToolCall, ProviderType } from './core';

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
  tools: ToolDefinition[];
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
  protected harness: any; // AIHarness instance - using any to avoid circular dependency

  constructor(config: AgentConfig, harness: any) {
    this.config = config;
    this.harness = harness;
  }

  abstract execute(input: string, context?: AgentContext): Promise<AgentResult>;

  protected async executeWithTools(
    messages: Message[],
    tools: ToolDefinition[]
  ): Promise<AgentResult> {
    const result = await this.harness.complete(this.config.provider, messages, {
      model: this.config.model,
      tools,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    return {
      response: result.text,
      usage: result.usage,
      metadata: { model: result.model, finishReason: result.finishReason },
    };
  }
}
