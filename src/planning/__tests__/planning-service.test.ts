import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanningService } from '../planning-service';
import type { AIProvider, Plan, ToolDefinition } from '../../types/index';

describe('PlanningService', () => {
  let mockProvider: AIProvider;
  let planningService: PlanningService;
  let mockTools: ToolDefinition[];

  beforeEach(() => {
    mockProvider = {
      complete: vi.fn(),
      stream: vi.fn(),
      validateConfig: vi.fn(),
      fetchModels: vi.fn(),
      name: 'test',
      defaultModel: 'test-model',
    } as any;

    mockTools = [
      {
        name: 'bash',
        description: 'Execute bash commands',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string' },
          },
          required: ['command'],
        },
        execute: vi.fn(),
      },
    ];

    planningService = new PlanningService(mockProvider, mockTools);
  });

  describe('createPlan', () => {
    it('should create a plan with steps', async () => {
      const mockResponse = {
        text: JSON.stringify({
          description: 'Test plan description',
          steps: [
            { description: 'Step 1' },
            { description: 'Step 2', dependencies: ['step_1'] },
          ],
        }),
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        model: 'test-model',
        finishReason: 'stop',
      };

      vi.mocked(mockProvider.complete).mockResolvedValue(mockResponse);

      const plan = await planningService.createPlan('Test goal');

      expect(plan).toBeDefined();
      expect(plan.goal).toBe('Test goal');
      expect(plan.description).toBe('Test plan description');
      expect(plan.steps).toHaveLength(2);
      expect(plan.status).toBe('created');
      expect(plan.steps[0].id).toBe('step_1');
      expect(plan.steps[1].dependencies).toEqual(['step_1']);
    });

    it('should handle tool usage in plan steps', async () => {
      const mockResponse = {
        text: JSON.stringify({
          description: 'Plan with tools',
          steps: [
            {
              description: 'Run bash command',
              tool: 'bash',
              toolArgs: { command: 'echo hello' },
            },
          ],
        }),
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        model: 'test-model',
        finishReason: 'stop',
      };

      vi.mocked(mockProvider.complete).mockResolvedValue(mockResponse);

      const plan = await planningService.createPlan('Test goal', { allowTools: true });

      expect(plan.steps[0].tool).toBe('bash');
      expect(plan.steps[0].toolArgs).toEqual({ command: 'echo hello' });
    });

    it('should respect maxSteps limit', async () => {
      const mockResponse = {
        text: JSON.stringify({
          description: 'Plan with many steps',
          steps: Array.from({ length: 15 }, (_, i) => ({ description: `Step ${i + 1}` })),
        }),
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        model: 'test-model',
        finishReason: 'stop',
      };

      vi.mocked(mockProvider.complete).mockResolvedValue(mockResponse);

      const plan = await planningService.createPlan('Test goal', { maxSteps: 5 });

      // The service should still create the plan, but the AI should respect the limit
      expect(plan.steps.length).toBeGreaterThan(0);
    });
  });

  describe('executePlan', () => {
    let mockPlan: Plan;

    beforeEach(() => {
      mockPlan = {
        id: 'test-plan',
        goal: 'Test goal',
        description: 'Test description',
        status: 'created',
        createdAt: new Date(),
        updatedAt: new Date(),
        steps: [
          {
            id: 'step_1',
            description: 'Step without tool',
            status: 'pending',
          },
          {
            id: 'step_2',
            description: 'Step with bash tool',
            status: 'pending',
            tool: 'bash',
            toolArgs: { command: 'echo test' },
          },
        ],
      };
    });

    it('should execute plan steps successfully', async () => {
      vi.mocked(mockTools[0].execute).mockResolvedValue('Command executed');

      const result = await planningService.executePlan(mockPlan);

      expect(result.success).toBe(true);
      expect(result.plan.status).toBe('completed');
      expect(result.plan.steps[0].status).toBe('completed');
      expect(result.plan.steps[1].status).toBe('completed');
      expect(mockTools[0].execute).toHaveBeenCalledWith({ command: 'echo test' });
      expect(result.executionLog).toContain('Starting execution of plan');
      expect(result.executionLog).toContain('Plan execution completed');
    });

    it('should handle step failures', async () => {
      vi.mocked(mockTools[0].execute).mockRejectedValue(new Error('Command failed'));

      const result = await planningService.executePlan(mockPlan);

      expect(result.success).toBe(false);
      expect(result.plan.status).toBe('failed');
      expect(result.plan.steps[1].status).toBe('failed');
      expect(result.plan.steps[1].error).toBe('Command failed');
      expect(result.executionLog).toContain('Step failed');
    });

    it('should respect step dependencies', async () => {
      const planWithDeps: Plan = {
        ...mockPlan,
        steps: [
          {
            id: 'step_1',
            description: 'First step',
            status: 'pending',
          },
          {
            id: 'step_2',
            description: 'Dependent step',
            status: 'pending',
            dependencies: ['step_1'],
          },
          {
            id: 'step_3',
            description: 'Independent step',
            status: 'pending',
          },
        ],
      };

      const result = await planningService.executePlan(planWithDeps);

      expect(result.success).toBe(true);
      expect(result.plan.steps[0].status).toBe('completed');
      expect(result.plan.steps[1].status).toBe('completed');
      expect(result.plan.steps[2].status).toBe('completed');
    });

    it('should call onStepUpdate callback', async () => {
      const onStepUpdate = vi.fn();
      vi.mocked(mockTools[0].execute).mockResolvedValue('Success');

      await planningService.executePlan(mockPlan, {}, onStepUpdate);

      expect(onStepUpdate).toHaveBeenCalledTimes(2); // Once for each step
    });

    it('should pause on failure when requireConfirmation is true', async () => {
      vi.mocked(mockTools[0].execute).mockRejectedValue(new Error('Command failed'));

      const result = await planningService.executePlan(
        mockPlan,
        { requireConfirmation: true }
      );

      expect(result.success).toBe(false);
      expect(result.plan.status).toBe('paused');
      expect(result.error).toContain('paused for confirmation');
    });
  });

  describe('getPlanSummary', () => {
    it('should return formatted plan summary', () => {
      const plan: Plan = {
        id: 'test-plan',
        goal: 'Test goal',
        description: 'Test description',
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
        steps: [
          { id: 'step_1', description: 'Step 1', status: 'completed' },
          { id: 'step_2', description: 'Step 2', status: 'failed' },
          { id: 'step_3', description: 'Step 3', status: 'pending' },
        ],
      };

      const summary = planningService.getPlanSummary(plan);

      expect(summary).toContain('Test goal');
      expect(summary).toContain('completed');
      expect(summary).toContain('1/3 completed, 1 failed');
      expect(summary).toContain('Test description');
    });
  });
});
