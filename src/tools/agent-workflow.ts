import type { ToolDefinition } from '../types/index';
import type { AIHarness } from '../harness';
import type { ProviderType, AgentConfig, AgentTask, WorkflowOptions } from '../types/index';

export interface CreateAgentArgs {
  name: string;
  description?: string;
  provider: ProviderType;
  model?: string;
  systemPrompt?: string;
  tools?: string[];
  maxTokens?: number;
  temperature?: number;
}

export interface RunAgentWorkflowArgs {
  tasks: AgentTask[];
  mode?: 'parallel' | 'sequential';
  options?: WorkflowOptions;
}

export function createAgentWorkflowTools(harness: AIHarness): ToolDefinition[] {
  return [
    {
      name: 'create_agent',
      description: 'Create and register a new agent on-the-fly with a specific provider, model, system prompt, and optional tool access.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Unique name for the agent',
          },
          description: {
            type: 'string',
            description: 'Description of the agent purpose',
          },
          provider: {
            type: 'string',
            enum: ['openai', 'claude', 'nvidia', 'openrouter', 'ollama', 'google'],
            description: 'AI provider to use',
          },
          model: {
            type: 'string',
            description: 'Model to use (optional, uses provider default)',
          },
          systemPrompt: {
            type: 'string',
            description: 'System prompt for the agent',
          },
          tools: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of tool names the agent can use',
          },
          maxTokens: {
            type: 'number',
            description: 'Maximum tokens for agent responses',
          },
          temperature: {
            type: 'number',
            description: 'Temperature for agent responses (0-1)',
          },
        },
        required: ['name', 'provider'],
      },
      execute: async (args: Record<string, unknown>): Promise<string> => {
        const typedArgs = args as unknown as CreateAgentArgs;
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
      parameters: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                agentName: { type: 'string' },
                input: { type: 'string' },
                context: { type: 'object' },
              },
              required: ['agentName', 'input'],
            },
            description: 'Array of tasks with agentName and input',
          },
          mode: {
            type: 'string',
            enum: ['parallel', 'sequential'],
            description: 'Execution mode (default: parallel)',
          },
          options: {
            type: 'object',
            properties: {
              maxConcurrency: { type: 'number' },
              timeout: { type: 'number' },
              continueOnError: { type: 'boolean' },
            },
            description: 'Execution options (maxConcurrency, timeout, continueOnError)',
          },
        },
        required: ['tasks'],
      },
      execute: async (args: Record<string, unknown>): Promise<string> => {
        const typedArgs = args as unknown as RunAgentWorkflowArgs;
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
