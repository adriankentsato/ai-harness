import { Agent, type AgentConfig, type AgentContext, type AgentResult, type Message, ToolDefinition } from '../types/index';
import type { AIHarness } from '../harness';
import { IGenericType } from '../utils/types/generic-type';
import { createToolSet } from '../tools/index';

export class BaseAgent extends Agent {
  readonly name: string;
  readonly description: string;
  private resolvedTools: ToolDefinition<IGenericType, IGenericType>[];

  constructor(config: AgentConfig, harness: AIHarness) {
    super(config, harness);
    this.name = config.name;
    this.description = config.description;
    // Resolve tool names from config to ToolDefinition[]
    this.resolvedTools = config.tools ? createToolSet(config.tools) : [];
  }

  async execute(input: string, context?: AgentContext): Promise<AgentResult> {
    // Filter out any system messages from context and use system parameter instead
    const contextMessages = (context?.messages || []).filter(m => m.role !== 'system');
    const messages: Message[] = [
      ...contextMessages,
      { role: 'user' as const, content: input }
    ];

    // Use context tools if provided, otherwise fall back to resolved tools from config
    const tools = context?.tools || this.resolvedTools;

    if (tools.length > 0) {
      return await this.executeWithTools(messages, tools);
    } else {
      const result = await this.harness.complete(this.config.provider, messages, {
        model: this.config.model,
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
}

export function createAgent(config: AgentConfig, harness: AIHarness): Agent {
  return new BaseAgent(config, harness);
}

export { createCodeAssistantAgent } from './code-assistant';
export { createDataAnalystAgent } from './data-analyst';
export type { Agent, AgentConfig, AgentContext, AgentResult };
