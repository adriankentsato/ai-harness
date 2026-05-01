import { Agent, type AgentConfig, type AgentContext, type AgentResult, type Message } from '../types/index';
import type { AIHarness } from '../harness';

export class CodeAssistantAgent extends Agent {
  readonly name: string;
  readonly description: string;

  constructor(config: AgentConfig, harness: AIHarness) {
    super(config, harness);
    this.name = config.name;
    this.description = config.description;
  }

  async execute(input: string, context?: AgentContext): Promise<AgentResult> {
    const systemPrompt = `You are a helpful code assistant. You specialize in:
- Writing clean, maintainable code
- Explaining programming concepts
- Debugging issues
- Suggesting best practices
- Code review and optimization

When providing code, always include proper explanations and follow best practices for the language/framework being used.`;

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...(context?.messages || []),
      { role: 'user', content: input }
    ];

    const tools = context?.tools || [];

    if (tools.length > 0) {
      return await this.executeWithTools(messages, tools);
    } else {
      const result = await this.harness.complete(this.config.provider, messages, {
        model: this.config.model,
        maxTokens: this.config.maxTokens || 2000,
        temperature: this.config.temperature || 0.3,
      });

      return {
        response: result.text,
        usage: result.usage,
        metadata: { model: result.model, finishReason: result.finishReason },
      };
    }
  }
}

export function createCodeAssistantAgent(config: AgentConfig, harness: AIHarness): Agent {
  return new CodeAssistantAgent({
    ...config,
    systemPrompt: config.systemPrompt || `You are a helpful code assistant. You specialize in writing clean, maintainable code and explaining programming concepts.`,
  }, harness);
}
