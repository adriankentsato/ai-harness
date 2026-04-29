import {
  OpenAIProvider,
  ClaudeProvider,
  NvidiaProvider,
  OpenRouterProvider,
  OllamaProvider,
} from './providers/index.js';
import type {
  AIProvider,
  Message,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  ProviderType,
  ProviderConfig,
  ModelInfo,
} from './types.js';

export class AIHarness {
  private providers: Map<ProviderType, AIProvider> = new Map();
  private configs: Map<ProviderType, ProviderConfig> = new Map();

  registerProvider(type: ProviderType, config: ProviderConfig): void {
    this.configs.set(type, config);

    let provider: AIProvider;

    switch (type) {
      case 'openai':
        if (!config.apiKey) throw new Error('OpenAI requires apiKey');
        provider = new OpenAIProvider({
          apiKey: config.apiKey,
          timeout: config.timeout,
        });
        break;

      case 'claude':
        if (!config.apiKey) throw new Error('Claude requires apiKey');
        provider = new ClaudeProvider({
          apiKey: config.apiKey,
          timeout: config.timeout,
        });
        break;

      case 'nvidia':
        if (!config.apiKey) throw new Error('NVIDIA NIM requires apiKey');
        provider = new NvidiaProvider({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          timeout: config.timeout,
        });
        break;

      case 'openrouter':
        if (!config.apiKey) throw new Error('OpenRouter requires apiKey');
        provider = new OpenRouterProvider({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          timeout: config.timeout,
        });
        break;

      case 'ollama':
        provider = new OllamaProvider({
          baseUrl: config.baseUrl,
          timeout: config.timeout,
        });
        break;

      default:
        throw new Error(`Unknown provider type: ${type}`);
    }

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
    const { createPlanningTools } = await import('./planning/planning-tools.js');
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
    const { createPlanningTools } = await import('./planning/planning-tools.js');
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
    const { createPlanningTools } = await import('./planning/planning-tools.js');
    const provider = this.getProvider(providerType);
    const planningTools = createPlanningTools(provider);
    
    const planStatusTool = planningTools.find(t => t.name === 'plan_status');
    if (!planStatusTool) {
      throw new Error('Planning tools not available');
    }

    return await planStatusTool.execute({ planId });
  }

  async listPlans(providerType: ProviderType) {
    const { createPlanningTools } = await import('./planning/planning-tools.js');
    const provider = this.getProvider(providerType);
    const planningTools = createPlanningTools(provider);
    
    const listPlansTool = planningTools.find(t => t.name === 'list_plans');
    if (!listPlansTool) {
      throw new Error('Planning tools not available');
    }

    return await listPlansTool.execute({});
  }
}
