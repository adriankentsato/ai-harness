import { Agent, type AgentConfig, type AgentContext, type AgentResult, type Message } from '../types/index';
import type { AIHarness } from '../harness';

export class BaseAgent extends Agent {
  readonly name: string;
  readonly description: string;

  constructor(config: AgentConfig, harness: AIHarness) {
    super(config, harness);
    this.name = config.name;
    this.description = config.description;
  }

  async execute(input: string, context?: AgentContext): Promise<AgentResult> {
    const messages: Message[] = [
      ...(this.config.systemPrompt ? [{ role: 'system' as const, content: this.config.systemPrompt }] : []),
      ...(context?.messages || []),
      { role: 'user' as const, content: input }
    ];

    const tools = context?.tools || [];

    if (tools.length > 0) {
      return await this.executeWithTools(messages, tools);
    } else {
      const result = await this.harness.complete(this.config.provider, messages, {
        model: this.config.model,
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
}

export function createAgent(config: AgentConfig, harness: AIHarness): Agent {
  return new BaseAgent(config, harness);
}

export { createCodeAssistantAgent } from './code-assistant';
export { createDataAnalystAgent } from './data-analyst';
export type { Agent, AgentConfig, AgentContext, AgentResult };
