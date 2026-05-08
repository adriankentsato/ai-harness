import { Message, ToolDefinition, ToolCall, ToolResult, ProviderType } from './core';
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
  /** Maximum number of tool call iterations to prevent infinite loops */
  maxToolIterations?: number;
}

export interface AgentContext {
  messages: Message[];
  tools: ToolDefinition<IGenericType, IGenericType>[];
  metadata?: Record<string, unknown>;
}

export interface AgentResult {
  response: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
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
    const maxIterations = this.config.maxToolIterations ?? 10;
    let currentMessages: Message[] = [...messages];
    const allToolCalls: ToolCall[] = [];
    const allToolResults: ToolResult[] = [];
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const result = await this.harness.complete(this.config.provider, currentMessages, {
        model: this.config.model,
        tools,
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: this.config.systemPrompt,
      });

      totalUsage.promptTokens += result.usage.promptTokens;
      totalUsage.completionTokens += result.usage.completionTokens;
      totalUsage.totalTokens += result.usage.totalTokens;

      // Check if the model wants to call tools
      const toolCalls = (result as unknown as { toolCalls?: ToolCall[] }).toolCalls;
      if (!toolCalls || toolCalls.length === 0) {
        // No tool calls, return the final response
        return {
          response: result.text,
          toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
          toolResults: allToolResults.length > 0 ? allToolResults : undefined,
          usage: totalUsage,
          metadata: { model: result.model, finishReason: result.finishReason, iterations: iteration + 1 },
        };
      }

      // Execute tool calls and collect results
      const assistantContent: string[] = [];
      if (result.text) {
        assistantContent.push(result.text);
      }

      for (const toolCall of toolCalls) {
        allToolCalls.push(toolCall);

        // Find the tool definition
        const tool = tools.find(t => t.name === toolCall.name);
        let toolResult: ToolResult;

        if (!tool) {
          toolResult = {
            id: toolCall.id,
            name: toolCall.name,
            result: '',
            error: `Tool '${toolCall.name}' not found`,
          };
        } else {
          try {
            const output = await tool.execute(toolCall.arguments);
            toolResult = {
              id: toolCall.id,
              name: toolCall.name,
              result: typeof output === 'string' ? output : JSON.stringify(output),
            };
          } catch (error) {
            toolResult = {
              id: toolCall.id,
              name: toolCall.name,
              result: '',
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }

        allToolResults.push(toolResult);

        // Add tool call to assistant content (OpenAI format)
        assistantContent.push(`<tool_call>${JSON.stringify({ id: toolCall.id, name: toolCall.name, arguments: toolCall.arguments })}</tool_call>`);
      }

      // Add assistant message with tool calls
      currentMessages.push({
        role: 'assistant',
        content: assistantContent.join('\n'),
      });

      // Add tool results as separate messages
      for (const toolResult of allToolResults.slice(-toolCalls.length)) {
        currentMessages.push({
          role: 'user',
          content: `<tool_result tool_call_id="${toolResult.id}">${toolResult.error ? `Error: ${toolResult.error}` : toolResult.result}</tool_result>`,
        });
      }
    }

    // Max iterations reached
    throw new Error(`Maximum tool iterations (${maxIterations}) reached. Possible infinite loop.`);
  }
}
