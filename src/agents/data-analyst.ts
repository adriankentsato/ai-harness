import { Agent, type AgentConfig, type AgentContext, type AgentResult, type Message } from '../types/index';

export class DataAnalystAgent extends Agent {
  readonly name: string;
  readonly description: string;

  constructor(config: AgentConfig, harness: any) {
    super(config, harness);
    this.name = config.name;
    this.description = config.description;
  }

  async execute(input: string, context?: AgentContext): Promise<AgentResult> {
    const systemPrompt = `You are a data analyst assistant. You specialize in:
- Analyzing datasets and identifying patterns
- Creating data visualizations and charts
- Statistical analysis and hypothesis testing
- Data cleaning and preprocessing
- SQL query optimization
- Reporting findings with clear insights

Always provide clear explanations of your analysis and any assumptions you make.`;

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
        maxTokens: this.config.maxTokens || 3000,
        temperature: this.config.temperature || 0.2,
      });

      return {
        response: result.text,
        usage: result.usage,
        metadata: { model: result.model, finishReason: result.finishReason },
      };
    }
  }
}

export function createDataAnalystAgent(config: AgentConfig, harness: any): Agent {
  return new DataAnalystAgent({
    ...config,
    systemPrompt: config.systemPrompt || `You are a data analyst assistant specializing in data analysis, visualization, and statistical insights.`,
  }, harness);
}
