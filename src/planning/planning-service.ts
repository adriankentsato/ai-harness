import type {
  Plan,
  PlanStep,
  PlanningOptions,
  PlanningResult,
  AIProvider,
  ToolDefinition,
} from '../types/index';
import { IGenericType } from '../utils/types/generic-type';

export class PlanningService {
  private tools: Map<string, ToolDefinition<IGenericType, IGenericType>> = new Map();

  constructor(private provider: AIProvider, tools: ToolDefinition<IGenericType, IGenericType>[] = []) {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  async createPlan(
    goal: string,
    options: PlanningOptions = {}
  ): Promise<Plan> {
    const maxSteps = options.maxSteps || 10;
    const allowTools = options.allowTools !== false;

    const planningPrompt = `You are a planning AI. Break down this goal into specific, actionable steps:

Goal: ${goal}

Create a plan with up to ${maxSteps} steps. Each step should:
1. Be specific and actionable
2. Have clear dependencies on previous steps if needed
3. Include tools if ${allowTools ? 'available and needed' : 'not used'}
4. Be ordered logically

Available tools: ${allowTools ? Array.from(this.tools.keys()).join(', ') : 'none'}

Respond with a JSON object:
{
  "description": "Brief description of the overall approach",
  "steps": [
    {
      "description": "Step description",
      "dependencies": ["step_id1", "step_id2"],
      "tool": "tool_name",
      "toolArgs": {"param": "value"}
    }
  ]
}

Keep steps focused and atomic. Each step should accomplish one clear thing.`;

    try {
      const response = await this.provider.complete([
        { role: 'system', content: 'You are a planning assistant. Always respond with valid JSON.' },
        { role: 'user', content: planningPrompt }
      ], {
        temperature: 0.3,
        maxTokens: 2000,
      });

      const planData = JSON.parse(response.text);
      const steps: PlanStep[] = [];

      for (let i = 0; i < planData.steps.length; i++) {
        const stepData = planData.steps[i];
        steps.push({
          id: `step_${i + 1}`,
          description: stepData.description,
          status: 'pending',
          dependencies: stepData.dependencies || [],
          tool: stepData.tool,
          toolArgs: stepData.toolArgs,
        });
      }

      return {
        id: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        goal,
        description: planData.description,
        steps,
        status: 'created',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to create plan: ${(error as Error).message}`);
    }
  }

  async executePlan(
    plan: Plan,
    options: PlanningOptions = {},
    onStepUpdate?: (step: PlanStep) => void
  ): Promise<PlanningResult> {
    const executionLog: string[] = [];
    const requireConfirmation = options.requireConfirmation || false;

    try {
      executionLog.push(`Starting execution of plan: ${plan.goal}`);
      plan.status = 'executing';
      plan.updatedAt = new Date();

      const executedSteps = new Set<string>();
      let currentStepIndex = 0;

      while (currentStepIndex < plan.steps.length) {
        const step = plan.steps[currentStepIndex];
        
        // Check if all dependencies are met
        if (step.dependencies && step.dependencies.length > 0) {
          const allDepsMet = step.dependencies.every(depId => 
            executedSteps.has(depId)
          );
          if (!allDepsMet) {
            currentStepIndex++;
            continue;
          }
        }

        // Execute step
        try {
          executionLog.push(`Executing step: ${step.description}`);
          step.status = 'in_progress';
          plan.currentStep = step.id;
          plan.updatedAt = new Date();
          
          if (onStepUpdate) onStepUpdate(step);

          if (step.tool && this.tools.has(step.tool)) {
            // Execute tool
            const tool = this.tools.get(step.tool)!;
            const result = await tool.execute(step.toolArgs || {});
            step.result = result;
            step.status = 'completed';
            executionLog.push(`Tool '${step.tool}' executed successfully`);
          } else {
            // No tool needed, mark as completed
            step.status = 'completed';
            executionLog.push(`Step completed (no tool required)`);
          }

          executedSteps.add(step.id);
          currentStepIndex++;

          if (onStepUpdate) onStepUpdate(step);

        } catch (error) {
          step.status = 'failed';
          step.error = (error as Error).message;
          executionLog.push(`Step failed: ${(error as Error).message}`);
          
          if (onStepUpdate) onStepUpdate(step);

          if (requireConfirmation) {
            plan.status = 'paused';
            return {
              plan,
              executionLog,
              success: false,
              error: `Step failed: ${step.description}. Plan paused for confirmation.`,
            };
          } else {
            // Continue with next step
            currentStepIndex++;
          }
        }
      }

      // Check if all steps completed
      const allCompleted = plan.steps.every(step => 
        step.status === 'completed' || step.status === 'failed'
      );

      const anyFailed = plan.steps.some(step => step.status === 'failed');

      if (allCompleted) {
        plan.status = anyFailed ? 'failed' : 'completed';
        executionLog.push(anyFailed ? 'Plan execution completed with failures' : 'Plan execution completed');
      } else {
        plan.status = 'failed';
        executionLog.push('Plan execution failed - some steps could not be completed');
      }

      plan.updatedAt = new Date();
      plan.currentStep = undefined;

      return {
        plan,
        executionLog,
        success: plan.status === 'completed',
      };

    } catch (error) {
      plan.status = 'failed';
      plan.updatedAt = new Date();
      return {
        plan,
        executionLog,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async resumePlan(
    plan: Plan,
    options: PlanningOptions = {},
    onStepUpdate?: (step: PlanStep) => void
  ): Promise<PlanningResult> {
    const executionLog: string[] = [];
    executionLog.push(`Resuming execution of plan: ${plan.goal}`);
    return this.executePlan(plan, options, onStepUpdate);
  }

  getPlanSummary(plan: Plan): string {
    const completedSteps = plan.steps.filter(s => s.status === 'completed').length;
    const failedSteps = plan.steps.filter(s => s.status === 'failed').length;
    const totalSteps = plan.steps.length;

    return `Plan: ${plan.goal}\n` +
           `Status: ${plan.status}\n` +
           `Progress: ${completedSteps}/${totalSteps} completed, ${failedSteps} failed\n` +
           `Description: ${plan.description}`;
  }
}
