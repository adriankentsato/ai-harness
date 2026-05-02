import type { ToolDefinition } from '../types/index';
import type { AIHarness } from '../harness';
import type { ProviderType, AgentConfig } from '../types/index';
import { z } from 'zod';
import { IGenericType } from '../utils/types/generic-type';

const CREATE_AGENT_INPUT_ARGS = z.object({
  name: z.string().describe('Unique name for the agent'),
  description: z.string().optional().describe('Description of the agent purpose'),
  provider: z.enum(['openai', 'claude', 'nvidia', 'openrouter', 'ollama', 'google']).describe('AI provider to use'),
  model: z.string().optional().describe('Model to use (optional, uses provider default)'),
  systemPrompt: z.string().optional().describe('System prompt for the agent'),
  tools: z.array(z.string()).optional().describe('List of tool names the agent can use'),
  maxTokens: z.number().optional().describe('Maximum tokens for agent responses'),
  temperature: z.number().optional().describe('Temperature for agent responses (0-1)'),
});

const RUN_AGENT_WORKFLOW_INPUT_ARGS = z.object({
  tasks: z.array(z.object({
    agentName: z.string(),
    input: z.string(),
    context: z.object({
      messages: z.array(z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
      })),
      tools: z.array(z.any()), // ToolDefinition objects
      metadata: z.record(z.string(), z.unknown()).optional(),
    }).optional(),
    dependsOn: z.array(z.string()).optional(),
  })).describe('Array of tasks with agentName and input'),
  mode: z.enum(['parallel', 'sequential']).optional().describe('Execution mode (default: parallel)'),
  options: z.object({
    maxConcurrency: z.number().optional(),
    timeout: z.number().optional(),
    continueOnError: z.boolean().optional(),
  }).optional().describe('Execution options (maxConcurrency, timeout, continueOnError)'),
});

export function createAgentWorkflowTools(harness: AIHarness): ToolDefinition<IGenericType, IGenericType>[] {
  return [
    {
      name: 'create_agent',
      description: 'Create and register a new agent on-the-fly with a specific provider, model, system prompt, and optional tool access.',
      parameters: CREATE_AGENT_INPUT_ARGS,
      execute: async (args: Record<string, unknown>): Promise<string> => {
        const typedArgs = args as z.infer<typeof CREATE_AGENT_INPUT_ARGS>;
        const { name, description, provider, model, systemPrompt, tools, maxTokens, temperature } = typedArgs;

        if (!name || typeof name !== 'string') {
          throw new Error('name is required and must be a string');
        }

        if (!provider || typeof provider !== 'string') {
          throw new Error('provider is required and must be a string');
        }

        if (!harness.hasProvider(provider as ProviderType)) {
          throw new Error(`Provider not registered: ${provider}`);
        }

        const config: AgentConfig = {
          name,
          description: description || `Agent: ${name}`,
          provider: provider as ProviderType,
          model,
          systemPrompt,
          tools,
          maxTokens,
          temperature,
        };

        harness.registerAgent(config);

        return `Agent "${name}" registered successfully.\nProvider: ${provider}\nModel: ${model || '(default)'}\nSystem Prompt: ${systemPrompt ? '(custom set)' : '(none)'}\nTools: ${tools?.length ? tools.join(', ') : '(none)'}`;
      },
    },

    {
      name: 'run_agent_workflow',
      description: 'Execute one or more registered agents in parallel or sequential mode with execution time tracking per task.',
      parameters: RUN_AGENT_WORKFLOW_INPUT_ARGS,
      execute: async (args: Record<string, unknown>): Promise<string> => {
        const typedArgs = args as z.infer<typeof RUN_AGENT_WORKFLOW_INPUT_ARGS>;
        const { tasks, mode = 'parallel', options = {} } = typedArgs;

        if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
          throw new Error('tasks is required and must be a non-empty array');
        }

        for (const task of tasks) {
          if (!task.agentName || typeof task.agentName !== 'string') {
            throw new Error('Each task must have an agentName (string)');
          }
          if (task.input === undefined || typeof task.input !== 'string') {
            throw new Error('Each task must have an input (string)');
          }
        }

        if (mode !== 'parallel' && mode !== 'sequential') {
          throw new Error('mode must be "parallel" or "sequential"');
        }

        try {
          const summary = await harness.executeAgentWorkflow(tasks, mode, options);

          let output = `Workflow ${summary.success ? 'completed' : 'failed'}!\n\n`;
          output += `Total Tasks: ${summary.totalTasks}\n`;
          output += `Completed: ${summary.completedTasks}\n`;
          output += `Failed: ${summary.failedTasks}\n`;
          output += `Total Execution Time: ${summary.totalExecutionTime}ms\n\n`;

          output += 'Task Results:\n';
          for (const result of summary.results) {
            output += `\n--- ${result.agentName} (${result.executionTime}ms) ---\n`;
            if (result.error) {
              output += `ERROR: ${result.error}\n`;
            } else {
              output += `Response: ${result.result.response.slice(0, 500)}${result.result.response.length > 500 ? '...\n(truncated)' : ''}\n`;
              output += `Tokens: ${result.result.usage.totalTokens}\n`;
            }
          }

          return output;
        } catch (error) {
          throw new Error(`Agent workflow execution failed: ${(error as Error).message}`);
        }
      },
    },
  ];
}
