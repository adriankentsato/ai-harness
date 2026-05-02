import type { Message, ProviderType, ToolDefinition } from '../types/index';
import type { AIHarness } from '../harness';
import type { ReadLine } from 'readline';
import { IGenericType } from '../utils/types/generic-type';

export interface CliState {
  currentProvider: ProviderType | null;
  currentModel: string | undefined;
  enabledTools: ToolDefinition<IGenericType, IGenericType>[];
  messages: Message[];
}

export interface CliContext {
  harness: AIHarness;
  state: CliState;
  rl: ReadLine;
  agentWorkflowTools: ToolDefinition<IGenericType, IGenericType>[];
  registered: ProviderType[];
  missing: Array<{ provider: ProviderType; reason: string }>;
  providers: ProviderType[];
  hasProviders: boolean;
  SYSTEM_PROMPT: string;
  TOOLS_SYSTEM_PROMPT: string;
  REQUIRED_ENV_VARS: Record<ProviderType, string>;
  enableBash: boolean;
  updatePrompt: () => void;
  addMessage: (role: 'system' | 'user' | 'assistant', content: string) => void;
  clearConversation: () => void;
}
