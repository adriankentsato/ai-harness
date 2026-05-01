import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIHarness } from '../../harness';
import type { AgentTask } from '../../types/index';

describe('Agent Workflow Execution', () => {
  let harness: AIHarness;

  beforeEach(() => {
    harness = new AIHarness();
    
    // Mock the executeAgent method to simulate agent execution
    vi.spyOn(harness, 'executeAgent').mockImplementation(async (name: string) => {
      // Add a small delay to simulate real execution time
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const responses: Record<string, { response: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> = {
        'code-assistant': {
          response: 'Code response',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        },
        'data-analyst': {
          response: 'Data analysis response',
          usage: { promptTokens: 15, completionTokens: 25, totalTokens: 40 },
        },
        'writer': {
          response: 'Writing response',
          usage: { promptTokens: 12, completionTokens: 18, totalTokens: 30 },
        },
      };
      
      if (responses[name]) {
        return responses[name];
      }
      throw new Error(`Unknown agent: ${name}`);
    });
  });

  describe('Parallel Execution', () => {
    it('should execute agents in parallel', async () => {
      const tasks: AgentTask[] = [
        { agentName: 'code-assistant', input: 'Write code' },
        { agentName: 'data-analyst', input: 'Analyze data' },
      ];

      const result = await harness.executeAgentsParallel(tasks, {
        maxConcurrency: 2,
        timeout: 30000,
        continueOnError: true,
      });

      expect(result.success).toBe(true);
      expect(result.totalTasks).toBe(2);
      expect(result.completedTasks).toBe(2);
      expect(result.failedTasks).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.totalExecutionTime).toBeGreaterThan(0);
    });

    it('should handle errors in parallel execution', async () => {
      const tasks: AgentTask[] = [
        { agentName: 'code-assistant', input: 'Write code' },
        { agentName: 'unknown-agent', input: 'Do something' },
      ];

      const result = await harness.executeAgentsParallel(tasks, {
        continueOnError: true,
      });

      expect(result.success).toBe(false);
      expect(result.completedTasks).toBe(1);
      expect(result.failedTasks).toBe(1);
      expect(result.results[1].error).toContain('Unknown agent');
    });
  });

  describe('Sequential Execution', () => {
    it('should execute agents sequentially', async () => {
      const tasks: AgentTask[] = [
        { agentName: 'code-assistant', input: 'Write code' },
        { agentName: 'data-analyst', input: 'Analyze data' },
        { agentName: 'writer', input: 'Write content' },
      ];

      const result = await harness.executeAgentsSequential(tasks);

      expect(result.success).toBe(true);
      expect(result.totalTasks).toBe(3);
      expect(result.completedTasks).toBe(3);
      expect(result.failedTasks).toBe(0);
      expect(result.results).toHaveLength(3);
    });

    it('should stop on error when continueOnError is false', async () => {
      const tasks: AgentTask[] = [
        { agentName: 'code-assistant', input: 'Write code' },
        { agentName: 'unknown-agent', input: 'Do something' },
        { agentName: 'data-analyst', input: 'Analyze data' },
      ];

      const result = await harness.executeAgentsSequential(tasks, {
        continueOnError: false,
      });

      expect(result.success).toBe(false);
      expect(result.completedTasks).toBe(1);
      expect(result.failedTasks).toBe(1);
      // Should stop after the error, not execute the third task
      expect(result.results).toHaveLength(2);
    });
  });

  describe('Unified Workflow Method', () => {
    it('should route to parallel execution', async () => {
      const tasks: AgentTask[] = [
        { agentName: 'code-assistant', input: 'Write code' },
        { agentName: 'data-analyst', input: 'Analyze data' },
      ];

      const result = await harness.executeAgentWorkflow(tasks, 'parallel');

      expect(result.success).toBe(true);
      expect(result.totalTasks).toBe(2);
    });

    it('should route to sequential execution', async () => {
      const tasks: AgentTask[] = [
        { agentName: 'code-assistant', input: 'Write code' },
      ];

      const result = await harness.executeAgentWorkflow(tasks, 'sequential');

      expect(result.success).toBe(true);
      expect(result.totalTasks).toBe(1);
    });

    it('should default to parallel execution', async () => {
      const tasks: AgentTask[] = [
        { agentName: 'code-assistant', input: 'Write code' },
      ];

      const result = await harness.executeAgentWorkflow(tasks);

      expect(result.success).toBe(true);
      expect(result.totalTasks).toBe(1);
    });
  });

  describe('Task Dependencies', () => {
    it('should support task dependencies in task definition', () => {
      const tasks: AgentTask[] = [
        {
          agentName: 'data-analyst',
          input: 'Analyze data',
          dependsOn: ['data-collection'],
        },
        {
          agentName: 'code-assistant',
          input: 'Write code',
          dependsOn: ['analysis-complete'],
        },
      ];

      expect(tasks[0].dependsOn).toEqual(['data-collection']);
      expect(tasks[1].dependsOn).toEqual(['analysis-complete']);
    });
  });
});
