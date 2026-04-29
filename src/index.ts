export { AIHarness } from './harness.js';
export {
  OpenAIProvider,
  ClaudeProvider,
  NvidiaProvider,
  OpenRouterProvider,
  OllamaProvider,
} from './providers/index.js';
export {
  availableTools,
  getTool,
  createToolSet,
  bashTool,
} from './tools/index.js';
export type {
  AIProvider,
  Message,
  StreamChunk,
  CompletionOptions,
  CompletionResult,
  ProviderType,
  ProviderConfig,
  ModelInfo,
  ToolDefinition,
  ToolCall,
  ToolResult,
} from './types.js';
export type { BashToolArgs } from './tools/bash.js';
