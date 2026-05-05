import type {
  AIProvider,
  Message,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  ProviderType,
  ModelInfo,
  Agent,
  AgentConfig,
  AgentContext,
  AgentResult,
  AgentTask,
  WorkflowResult,
  WorkflowSummary,
  WorkflowOptions,
} from './types/index';

export class AIHarness {
  private providers: Map<ProviderType, AIProvider> = new Map();
  private agents: Map<string, Agent> = new Map();

  registerProvider(type: ProviderType, provider: AIProvider): void {
    if (!provider.validateConfig()) {
      throw new Error(`Invalid configuration for provider: ${type}`);
    }

    this.providers.set(type, provider);
  }

  getProvider(type: ProviderType): AIProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Provider not registered: ${type}`);
    }
    return provider;
  }

  hasProvider(type: ProviderType): boolean {
    return this.providers.has(type);
  }

  listProviders(): ProviderType[] {
    return Array.from(this.providers.keys());
  }

  async complete(
    providerType: ProviderType,
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    const provider = this.getProvider(providerType);
    return provider.complete(messages, options);
  }

  async *stream(
    providerType: ProviderType,
    messages: Message[],
    options?: CompletionOptions
  ): AsyncIterableIterator<StreamChunk> {
    const provider = this.getProvider(providerType);
    yield* provider.stream(messages, options);
  }

  async fetchModels(providerType: ProviderType): Promise<ModelInfo[]> {
    const provider = this.getProvider(providerType);
    return provider.fetchModels();
  }

  async route(
    messages: Message[],
    options?: CompletionOptions & { preferred?: ProviderType[] }
  ): Promise<CompletionResult> {
    const preferred = options?.preferred || Array.from(this.providers.keys());

    const errors: Array<{ provider: ProviderType; error: Error }> = [];

    for (const type of preferred) {
      if (this.hasProvider(type)) {
        try {
          return await this.complete(type, messages, options);
        } catch (error) {
          errors.push({ provider: type, error: error as Error });
        }
      }
    }

    if (errors.length > 0) {
      const errorMessage = errors
        .map(e => `${e.provider}: ${e.error.message}`)
        .join('; ');
      throw new Error(`All providers failed: ${errorMessage}`);
    }

    throw new Error('No providers available');
  }

  async createPlan(
    providerType: ProviderType,
    goal: string,
    options?: { maxSteps?: number; allowTools?: boolean; requireConfirmation?: boolean }
  ) {
    const { createPlanningTools } = await import('./planning/planning-tools');
    const provider = this.getProvider(providerType);
    const planningTools = createPlanningTools(provider);
    
    const createPlanTool = planningTools.find(t => t.name === 'create_plan');
    if (!createPlanTool) {
      throw new Error('Planning tools not available');
    }

    return await createPlanTool.execute({ goal, ...options });
  }

  async executePlan(
    providerType: ProviderType,
    planId?: string,
    options?: { requireConfirmation?: boolean }
  ) {
    const { createPlanningTools } = await import('./planning/planning-tools');
    const provider = this.getProvider(providerType);
    const planningTools = createPlanningTools(provider);
    
    const executePlanTool = planningTools.find(t => t.name === 'execute_plan');
    if (!executePlanTool) {
      throw new Error('Planning tools not available');
    }

    return await executePlanTool.execute({ planId, ...options });
  }

  async getPlanStatus(
    providerType: ProviderType,
    planId?: string
  ) {
    const { createPlanningTools } = await import('./planning/planning-tools');
    const provider = this.getProvider(providerType);
    const planningTools = createPlanningTools(provider);
    
    const planStatusTool = planningTools.find(t => t.name === 'plan_status');
    if (!planStatusTool) {
      throw new Error('Planning tools not available');
    }

    return await planStatusTool.execute({ planId });
  }

  async listPlans(providerType: ProviderType) {
    const { createPlanningTools } = await import('./planning/planning-tools');
    const provider = this.getProvider(providerType);
    const planningTools = createPlanningTools(provider);
    
    const listPlansTool = planningTools.find(t => t.name === 'list_plans');
    if (!listPlansTool) {
      throw new Error('Planning tools not available');
    }

    return await listPlansTool.execute({});
  }

  registerAgent(config: AgentConfig): void {
    if (!this.hasProvider(config.provider)) {
      throw new Error(`Provider not registered: ${config.provider}`);
    }

    const { createAgent } = require('./agents/index');
    const agent = createAgent(config, this);
    this.agents.set(config.name, agent);
  }

  getAgent(name: string): Agent {
    const agent = this.agents.get(name);
    if (!agent) {
      throw new Error(`Agent not registered: ${name}`);
    }
    return agent;
  }

  hasAgent(name: string): boolean {
    return this.agents.has(name);
  }

  listAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  async executeAgent(
    name: string,
    input: string,
    context?: AgentContext
  ): Promise<AgentResult> {
    const agent = this.getAgent(name);
    return await agent.execute(input, context);
  }

  async executeAgentsParallel(
    tasks: AgentTask[],
    options: WorkflowOptions = {}
  ): Promise<WorkflowSummary> {
    const startTime = Date.now();
    const results: WorkflowResult[] = [];
    const maxConcurrency = options.maxConcurrency || 5;
    const timeout = options.timeout || 30000;

    // Execute tasks in parallel batches
    const batches: AgentTask[][] = [];
    for (let i = 0; i < tasks.length; i += maxConcurrency) {
      batches.push(tasks.slice(i, i + maxConcurrency));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (task): Promise<WorkflowResult> => {
        const taskStartTime = Date.now();
        try {
          const result = await Promise.race([
            this.executeAgent(task.agentName, task.input, task.context),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Task timeout')), timeout)
            )
          ]);

          return {
            taskName: task.agentName,
            agentName: task.agentName,
            result,
            executionTime: Date.now() - taskStartTime,
          };
        } catch (error) {
          const workflowResult: WorkflowResult = {
            taskName: task.agentName,
            agentName: task.agentName,
            result: {
              response: '',
              usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            },
            executionTime: Date.now() - taskStartTime,
            error: error instanceof Error ? error.message : String(error),
          };

          if (!options.continueOnError) {
            throw workflowResult;
          }

          return workflowResult;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const completedTasks = results.filter(r => !r.error).length;
    const failedTasks = results.filter(r => r.error).length;

    return {
      totalTasks: tasks.length,
      completedTasks,
      failedTasks,
      totalExecutionTime: Date.now() - startTime,
      results,
      success: failedTasks === 0,
    };
  }

  async executeAgentsSequential(
    tasks: AgentTask[],
    options: WorkflowOptions = {}
  ): Promise<WorkflowSummary> {
    const startTime = Date.now();
    const results: WorkflowResult[] = [];
    const timeout = options.timeout || 30000;

    for (const task of tasks) {
      const taskStartTime = Date.now();
      try {
        const result = await Promise.race([
          this.executeAgent(task.agentName, task.input, task.context),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Task timeout')), timeout)
          )
        ]);

        results.push({
          taskName: task.agentName,
          agentName: task.agentName,
          result,
          executionTime: Date.now() - taskStartTime,
        });
      } catch (error) {
        const workflowResult: WorkflowResult = {
          taskName: task.agentName,
          agentName: task.agentName,
          result: {
            response: '',
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          },
          executionTime: Date.now() - taskStartTime,
          error: error instanceof Error ? error.message : String(error),
        };

        results.push(workflowResult);

        if (!options.continueOnError) {
          return {
            totalTasks: tasks.length,
            completedTasks: results.filter(r => !r.error).length,
            failedTasks: results.filter(r => r.error).length,
            totalExecutionTime: Date.now() - startTime,
            results,
            success: false,
          };
        }
      }
    }

    const completedTasks = results.filter(r => !r.error).length;
    const failedTasks = results.filter(r => r.error).length;

    return {
      totalTasks: tasks.length,
      completedTasks,
      failedTasks,
      totalExecutionTime: Date.now() - startTime,
      results,
      success: failedTasks === 0,
    };
  }

  async executeAgentWorkflow(
    tasks: AgentTask[],
    mode: 'parallel' | 'sequential' = 'parallel',
    options: WorkflowOptions = {}
  ): Promise<WorkflowSummary> {
    if (mode === 'parallel') {
      return await this.executeAgentsParallel(tasks, options);
    } else {
      return await this.executeAgentsSequential(tasks, options);
    }
  }
}
