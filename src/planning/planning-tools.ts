import type { ToolDefinition, Plan } from '../types/index';
import { PlanningService } from './planning-service';
import type { AIProvider } from '../types/index';
import type { ToolDefinition as ToolDef } from '../types/core';

interface PlanningToolArgs {
  goal: string;
  maxSteps?: number;
  allowTools?: boolean;
  requireConfirmation?: boolean;
}

interface ExecutePlanArgs {
  planId?: string;
  requireConfirmation?: boolean;
}

interface PlanStatusArgs {
  planId?: string;
}

// Global storage for active plans (in production, use proper storage)
const activePlans = new Map<string, Plan>();
const planningServices = new Map<string, PlanningService>();

export function createPlanningTools(provider: AIProvider, tools: ToolDef[] = []): ToolDefinition[] {
  const serviceId = `service_${Date.now()}`;
  planningServices.set(serviceId, new PlanningService(provider, tools));

  return [
    {
      name: 'create_plan',
      description: 'Create a multi-step plan to achieve a goal. Breaks down complex tasks into specific, actionable steps.',
      parameters: {
        type: 'object',
        properties: {
          goal: {
            type: 'string',
            description: 'The goal or task to accomplish',
          },
          maxSteps: {
            type: 'number',
            description: 'Maximum number of steps in the plan (optional, default 10)',
          },
          allowTools: {
            type: 'boolean',
            description: 'Whether to allow using tools in the plan (optional, default true)',
          },
          requireConfirmation: {
            type: 'boolean',
            description: 'Whether to require confirmation before executing (optional, default false)',
          },
        },
        required: ['goal'],
      },
      execute: async (args: Record<string, unknown>): Promise<string> => {
        const typedArgs = args as unknown as PlanningToolArgs;
        const { goal, maxSteps, allowTools, requireConfirmation } = typedArgs;

        if (!goal || typeof goal !== 'string') {
          throw new Error('goal is required and must be a string');
        }

        try {
          const service = planningServices.get(serviceId)!;
          const plan = await service.createPlan(goal, {
            maxSteps,
            allowTools,
            requireConfirmation,
          });

          activePlans.set(plan.id, plan);

          const summary = service.getPlanSummary(plan);
          return `Plan created successfully!\n\nPlan ID: ${plan.id}\n${summary}\n\nUse execute_plan to start execution.`;
        } catch (error) {
          throw new Error(`Failed to create plan: ${(error as Error).message}`);
        }
      },
    },

    {
      name: 'execute_plan',
      description: 'Execute a previously created plan. Runs each step in order, handling dependencies and tools.',
      parameters: {
        type: 'object',
        properties: {
          planId: {
            type: 'string',
            description: 'ID of the plan to execute (optional, uses most recent if not provided)',
          },
          requireConfirmation: {
            type: 'boolean',
            description: 'Whether to pause on failures for confirmation (optional, default false)',
          },
        },
        required: [],
      },
      execute: async (args: Record<string, unknown>): Promise<string> => {
        const typedArgs = args as ExecutePlanArgs;
        const { planId, requireConfirmation } = typedArgs;

        let targetPlan: Plan | undefined;

        if (planId) {
          targetPlan = activePlans.get(planId);
          if (!targetPlan) {
            throw new Error(`Plan not found: ${planId}`);
          }
        } else {
          // Get most recent plan
          const plans = Array.from(activePlans.values());
          if (plans.length === 0) {
            throw new Error('No plans available. Create a plan first using create_plan.');
          }
          targetPlan = plans[plans.length - 1];
        }

        try {
          const service = planningServices.get(serviceId)!;
          
          const result = await service.executePlan(
            targetPlan,
            { requireConfirmation },
            () => {
              // Update plan in storage
              activePlans.set(targetPlan.id, targetPlan);
            }
          );

          // Update plan in storage
          activePlans.set(targetPlan.id, result.plan);

          const summary = service.getPlanSummary(result.plan);
          const logOutput = result.executionLog.join('\n');

          return `Plan execution ${result.success ? 'completed' : 'failed'}!\n\n${summary}\n\nExecution Log:\n${logOutput}`;
        } catch (error) {
          throw new Error(`Failed to execute plan: ${(error as Error).message}`);
        }
      },
    },

    {
      name: 'plan_status',
      description: 'Get the status and details of a plan. Shows current progress and step information.',
      parameters: {
        type: 'object',
        properties: {
          planId: {
            type: 'string',
            description: 'ID of the plan to check (optional, uses most recent if not provided)',
          },
        },
        required: [],
      },
      execute: async (args: Record<string, unknown>): Promise<string> => {
        const typedArgs = args as PlanStatusArgs;
        const { planId } = typedArgs;

        let targetPlan: Plan | undefined;

        if (planId) {
          targetPlan = activePlans.get(planId);
          if (!targetPlan) {
            throw new Error(`Plan not found: ${planId}`);
          }
        } else {
          // Get most recent plan
          const plans = Array.from(activePlans.values());
          if (plans.length === 0) {
            return 'No plans available. Create a plan first using create_plan.';
          }
          targetPlan = plans[plans.length - 1];
        }

        const service = planningServices.get(serviceId)!;
        const summary = service.getPlanSummary(targetPlan);

        let stepsInfo = '\n\nSteps:\n';
        for (const step of targetPlan.steps) {
          const statusIcon = step.status === 'completed' ? ' completed' : 
                            step.status === 'failed' ? ' failed' : 
                            step.status === 'in_progress' ? ' in_progress' : ' pending';
          stepsInfo += `- [${statusIcon}] ${step.description}\n`;
          if (step.tool) {
            stepsInfo += `  Tool: ${step.tool}\n`;
          }
          if (step.result) {
            stepsInfo += `  Result: ${step.result.slice(0, 100)}${step.result.length > 100 ? '...' : ''}\n`;
          }
          if (step.error) {
            stepsInfo += `  Error: ${step.error}\n`;
          }
        }

        return `${summary}${stepsInfo}`;
      },
    },

    {
      name: 'list_plans',
      description: 'List all available plans with their status and basic information.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async (): Promise<string> => {
        const plans = Array.from(activePlans.values());
        
        if (plans.length === 0) {
          return 'No plans available.';
        }

        let output = `Available Plans (${plans.length}):\n\n`;
        
        for (const plan of plans) {
          const completedSteps = plan.steps.filter(s => s.status === 'completed').length;
          const totalSteps = plan.steps.length;
          const progress = `${completedSteps}/${totalSteps}`;
          
          output += `ID: ${plan.id}\n`;
          output += `Goal: ${plan.goal}\n`;
          output += `Status: ${plan.status}\n`;
          output += `Progress: ${progress} steps completed\n`;
          output += `Created: ${plan.createdAt.toLocaleString()}\n\n`;
        }

        return output;
      },
    },
  ];
}
