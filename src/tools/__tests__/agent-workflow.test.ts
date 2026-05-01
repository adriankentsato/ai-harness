import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAgentWorkflowTools } from '../agent-workflow';
import { AIHarness } from '../../harness';

// Mock AIHarness
const mockHarness = {
  hasProvider: vi.fn(),
  registerAgent: vi.fn(),
  listAgents: vi.fn(),
  executeAgentWorkflow: vi.fn(),
} as unknown as AIHarness;

describe('createAgentWorkflowTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create_agent tool', () => {
    const createAgentTool = createAgentWorkflowTools(mockHarness)[0];

    it('should validate required parameters', async () => {
      await expect(
        createAgentTool.execute({})
      ).rejects.toThrow('name is required and must be a string');
    });

    it('should validate provider is required', async () => {
      await expect(
        createAgentTool.execute({ name: 'test-agent' })
      ).rejects.toThrow('provider is required and must be a string');
    });

    it('should validate provider is registered', async () => {
      (mockHarness.hasProvider as ReturnType<typeof vi.fn>).mockReturnValue(false);

      await expect(
        createAgentTool.execute({ name: 'test-agent', provider: 'openai' })
      ).rejects.toThrow('Provider not registered: openai');
    });

    it('should register agent with valid parameters', async () => {
      (mockHarness.hasProvider as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const result = await createAgentTool.execute({
        name: 'test-agent',
        provider: 'openai',
        model: 'gpt-4',
        systemPrompt: 'You are a test agent',
        tools: ['file_ops'],
        maxTokens: 1000,
        temperature: 0.7,
      });

      expect(mockHarness.registerAgent).toHaveBeenCalledWith({
        name: 'test-agent',
        description: 'Agent: test-agent',
        provider: 'openai',
        model: 'gpt-4',
        systemPrompt: 'You are a test agent',
        tools: ['file_ops'],
        maxTokens: 1000,
        temperature: 0.7,
      });

      expect(result).toContain('Agent "test-agent" registered successfully');
      expect(result).toContain('Provider: openai');
      expect(result).toContain('Model: gpt-4');
    });

    it('should use default description if not provided', async () => {
      (mockHarness.hasProvider as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const result = await createAgentTool.execute({
        name: 'minimal-agent',
        provider: 'claude',
      });

      expect(mockHarness.registerAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Agent: minimal-agent',
        })
      );

      expect(result).toContain('Agent "minimal-agent" registered successfully');
    });
  });

  describe('run_agent_workflow tool', () => {
    const runAgentWorkflowTool = createAgentWorkflowTools(mockHarness)[1];

    it('should validate tasks is required', async () => {
      await expect(
        runAgentWorkflowTool.execute({})
      ).rejects.toThrow('tasks is required and must be a non-empty array');
    });

    it('should validate tasks is non-empty array', async () => {
      await expect(
        runAgentWorkflowTool.execute({ tasks: [] })
      ).rejects.toThrow('tasks is required and must be a non-empty array');
    });

    it('should validate each task has agentName', async () => {
      await expect(
        runAgentWorkflowTool.execute({
          tasks: [{ input: 'test' }],
        })
      ).rejects.toThrow('Each task must have an agentName (string)');
    });

    it('should validate each task has input', async () => {
      await expect(
        runAgentWorkflowTool.execute({
          tasks: [{ agentName: 'test-agent' }],
        })
      ).rejects.toThrow('Each task must have an input (string)');
    });

    it('should execute parallel workflow successfully', async () => {
      (mockHarness.executeAgentWorkflow as ReturnType<typeof vi.fn>).mockResolvedValue({
        totalTasks: 2,
        completedTasks: 2,
        failedTasks: 0,
        totalExecutionTime: 150,
        results: [
          {
            agentName: 'agent-1',
            executionTime: 80,
            result: {
              response: 'Response from agent 1',
              usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            },
          },
          {
            agentName: 'agent-2',
            executionTime: 70,
            result: {
              response: 'Response from agent 2',
              usage: { promptTokens: 15, completionTokens: 25, totalTokens: 40 },
            },
          },
        ],
        success: true,
      });

      const result = await runAgentWorkflowTool.execute({
        tasks: [
          { agentName: 'agent-1', input: 'Task 1' },
          { agentName: 'agent-2', input: 'Task 2' },
        ],
        mode: 'parallel',
      });

      expect(mockHarness.executeAgentWorkflow).toHaveBeenCalledWith(
        [
          { agentName: 'agent-1', input: 'Task 1' },
          { agentName: 'agent-2', input: 'Task 2' },
        ],
        'parallel',
        {}
      );

      expect(result).toContain('Workflow completed');
      expect(result).toContain('Total Tasks: 2');
      expect(result).toContain('Completed: 2');
      expect(result).toContain('Total Execution Time: 150ms');
      expect(result).toContain('agent-1 (80ms)');
      expect(result).toContain('agent-2 (70ms)');
    });

    it('should execute sequential workflow successfully', async () => {
      (mockHarness.executeAgentWorkflow as ReturnType<typeof vi.fn>).mockResolvedValue({
        totalTasks: 1,
        completedTasks: 1,
        failedTasks: 0,
        totalExecutionTime: 50,
        results: [
          {
            agentName: 'agent-1',
            executionTime: 50,
            result: {
              response: 'Sequential response',
              usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
            },
          },
        ],
        success: true,
      });

      const result = await runAgentWorkflowTool.execute({
        tasks: [{ agentName: 'agent-1', input: 'Sequential task' }],
        mode: 'sequential',
        options: { timeout: 5000 },
      });

      expect(mockHarness.executeAgentWorkflow).toHaveBeenCalledWith(
        [{ agentName: 'agent-1', input: 'Sequential task' }],
        'sequential',
        { timeout: 5000 }
      );

      expect(result).toContain('Sequential response');
    });

    it('should handle workflow failures', async () => {
      (mockHarness.executeAgentWorkflow as ReturnType<typeof vi.fn>).mockResolvedValue({
        totalTasks: 2,
        completedTasks: 1,
        failedTasks: 1,
        totalExecutionTime: 200,
        results: [
          {
            agentName: 'agent-1',
            executionTime: 100,
            result: {
              response: 'Success',
              usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            },
          },
          {
            agentName: 'agent-2',
            executionTime: 100,
            result: {
              response: '',
              usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            },
            error: 'Agent execution failed',
          },
        ],
        success: false,
      });

      const result = await runAgentWorkflowTool.execute({
        tasks: [
          { agentName: 'agent-1', input: 'Task 1' },
          { agentName: 'agent-2', input: 'Task 2' },
        ],
      });

      expect(result).toContain('Workflow failed');
      expect(result).toContain('Failed: 1');
      expect(result).toContain('ERROR: Agent execution failed');
    });

    it('should handle execution errors', async () => {
      (mockHarness.executeAgentWorkflow as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network timeout')
      );

      await expect(
        runAgentWorkflowTool.execute({
          tasks: [{ agentName: 'agent-1', input: 'Task 1' }],
        })
      ).rejects.toThrow('Agent workflow execution failed: Network timeout');
    });

    it('should truncate long responses', async () => {
      const longResponse = 'x'.repeat(600);
      (mockHarness.executeAgentWorkflow as ReturnType<typeof vi.fn>).mockResolvedValue({
        totalTasks: 1,
        completedTasks: 1,
        failedTasks: 0,
        totalExecutionTime: 100,
        results: [
          {
            agentName: 'agent-1',
            executionTime: 100,
            result: {
              response: longResponse,
              usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
            },
          },
        ],
        success: true,
      });

      const result = await runAgentWorkflowTool.execute({
        tasks: [{ agentName: 'agent-1', input: 'Long task' }],
      });

      expect(result).toContain('(truncated)');
      expect(result).toContain('Tokens: 150');
    });
  });
});
