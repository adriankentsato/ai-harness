import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIHarness } from '../../harness';
import { BaseAgent, createAgent } from '../index';
import type { AgentConfig, AgentContext } from '../../types/index';
import { z } from 'zod';

// Mock the AIHarness
vi.mock('../../harness');

describe('Agent System', () => {
  let mockHarness: AIHarness;
  let agentConfig: AgentConfig;

  beforeEach(() => {
    mockHarness = {
      complete: vi.fn(),
      hasProvider: vi.fn().mockReturnValue(true),
    } as unknown as AIHarness;

    agentConfig = {
      name: 'test-agent',
      description: 'Test agent for unit testing',
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000,
    };
  });

  describe('BaseAgent', () => {
    it('should create an agent with correct configuration', () => {
      const agent = new BaseAgent(agentConfig, mockHarness);
      
      expect(agent.name).toBe('test-agent');
      expect(agent.description).toBe('Test agent for unit testing');
    });

    it('should execute without tools', async () => {
      const agent = new BaseAgent(agentConfig, mockHarness);
      const mockResult = {
        text: 'Test response',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        model: 'gpt-4',
        finishReason: 'stop',
      };
      
      vi.mocked(mockHarness.complete).mockResolvedValue(mockResult);

      const result = await agent.execute('Test input');

      expect(mockHarness.complete).toHaveBeenCalledWith(
        'openai',
        [
          { role: 'user', content: 'Test input' }
        ],
        {
          model: 'gpt-4',
          maxTokens: 1000,
          temperature: 0.7,
        }
      );

      expect(result.response).toBe('Test response');
      expect(result.usage).toEqual(mockResult.usage);
    });

    it('should execute with system prompt', async () => {
      const configWithSystem = {
        ...agentConfig,
        systemPrompt: 'You are a helpful assistant.',
      };
      const agent = new BaseAgent(configWithSystem, mockHarness);
      const mockResult = {
        text: 'Test response',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        model: 'gpt-4',
        finishReason: 'stop',
      };
      
      vi.mocked(mockHarness.complete).mockResolvedValue(mockResult);

      await agent.execute('Test input');

      expect(mockHarness.complete).toHaveBeenCalledWith(
        'openai',
        [
          { role: 'user', content: 'Test input' }
        ],
        {
          model: 'gpt-4',
          maxTokens: 1000,
          temperature: 0.7,
          system: 'You are a helpful assistant.',
        }
      );
    });

    it('should execute with tools', async () => {
      const agent = new BaseAgent(agentConfig, mockHarness);
      const mockResult = {
        text: 'Test response with tools',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        model: 'gpt-4',
        finishReason: 'stop',
      };
      
      vi.mocked(mockHarness.complete).mockResolvedValue(mockResult);

      const context: AgentContext = {
        messages: [{ role: 'user', content: 'Previous message' }],
        tools: [
          {
            name: 'test-tool',
            description: 'A test tool',
            parameters: z.object({}),
            execute: vi.fn(),
          }
        ],
      };

      const result = await agent.execute('Test input', context);

      expect(mockHarness.complete).toHaveBeenCalledWith(
        'openai',
        [
          { role: 'user', content: 'Previous message' },
          { role: 'user', content: 'Test input' }
        ],
        {
          model: 'gpt-4',
          maxTokens: 1000,
          temperature: 0.7,
          tools: context.tools,
        }
      );

      expect(result.response).toBe('Test response with tools');
    });
  });

  describe('createAgent factory', () => {
    it('should create an agent using the factory function', () => {
      const agent = createAgent(agentConfig, mockHarness);
      
      expect(agent).toBeInstanceOf(BaseAgent);
      expect(agent.name).toBe('test-agent');
      expect(agent.description).toBe('Test agent for unit testing');
    });
  });
});
