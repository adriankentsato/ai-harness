import { describe, it, expect, vi } from 'vitest';
import { AIProvider } from '../core';
import type { Message, CompletionOptions, CompletionResult, StreamChunk, ModelInfo } from '../core';

// Create a concrete implementation for testing
class TestProvider extends AIProvider {
  readonly name = 'test';
  readonly defaultModel = 'test-model';
  private isClosed = false;

  async complete(
    _messages: Message[],
    _options?: CompletionOptions
  ): Promise<CompletionResult> {
    return {
      text: 'test',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      model: _options?.model || this.defaultModel,
      finishReason: 'stop',
    };
  }

  async *stream(
    _messages: Message[],
    _options?: CompletionOptions
  ): AsyncIterableIterator<StreamChunk> {
    yield { text: 'test', isComplete: false };
    yield { text: '', isComplete: true, usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } };
  }

  validateConfig(): boolean {
    return !this.isClosed;
  }

  async fetchModels(): Promise<ModelInfo[]> {
    if (this.isClosed) {
      throw new Error('Provider is closed');
    }
    return [{ id: 'test-model', name: 'Test Model' }];
  }

  async close(): Promise<void> {
    this.isClosed = true;
  }
}

describe('AIProvider', () => {
  describe('healthCheck', () => {
    it('should return true when fetchModels succeeds', async () => {
      const provider = new TestProvider();
      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should return false when fetchModels fails', async () => {
      const provider = new TestProvider();
      vi.spyOn(provider, 'fetchModels').mockRejectedValue(new Error('API Error'));
      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(false);
    });

    it('should return false after provider is closed', async () => {
      const provider = new TestProvider();
      await provider.close();
      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('close', () => {
    it('should be callable without error', async () => {
      const provider = new TestProvider();
      await expect(provider.close()).resolves.not.toThrow();
    });

    it('should prevent further operations after close', async () => {
      const provider = new TestProvider();
      await provider.close();
      await expect(provider.fetchModels()).rejects.toThrow('Provider is closed');
    });
  });

  describe('buildV2Tools', () => {
    it('should return undefined for empty tools', () => {
      const provider = new TestProvider();
      const result = (provider as unknown as { buildV2Tools(tools?: unknown[]): unknown }).buildV2Tools([]);
      expect(result).toBeUndefined();
    });

    it('should return undefined for undefined tools', () => {
      const provider = new TestProvider();
      const result = (provider as unknown as { buildV2Tools(tools?: unknown[]): unknown }).buildV2Tools(undefined);
      expect(result).toBeUndefined();
    });
  });
});
