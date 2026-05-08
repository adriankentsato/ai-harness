#!/usr/bin/env node

import { createInterface } from 'readline';
import { AIHarness } from './harness';
import { createAgentWorkflowTools } from './tools/index';
import {
  OpenAIProvider,
  ClaudeProvider,
  NvidiaProvider,
  OpenRouterProvider,
  OllamaProvider,
  GoogleProvider,
} from './providers/index';
import type { Message, ProviderType } from './types/index';
import { initEnvFromArgs } from './utils/envInit';
import { getCommand } from './cli/registry';
import { registerAllCommands } from './cli/commands/index';
import type { CliContext, CliState } from './cli/types';
import { LoadingDisplay } from './utils/loading';

const SYSTEM_PROMPT = 'You are a helpful assistant. Be concise and clear.';
const TOOLS_SYSTEM_PROMPT = `You are a helpful assistant with access to system tools. Be concise and clear.

You have access to the following tools:
- file_ops: Perform native file system operations including read, write, append, copy, move, delete, create directories, list directory contents, get file stats, and check if paths exist.
- web_search: Search the web for information using multiple search providers (DuckDuckGo, Brave, SearX). Returns relevant web pages with titles, URLs, and snippets.
- database_user: Connect to a SQLite database and perform user information operations (create, read, update, delete users).
- git_ops: Perform Git operations with strict working directory restrictions. Supports status, log, add, commit, push, pull, branch, checkout, diff, show, init, and clone operations.
- process_ops: Perform safe process operations with strict working directory restrictions. Supports listing processes, killing processes, getting process info, and checking tool versions.
- run_npm_scripts: Execute npm scripts and package management operations with strict working directory restrictions. Supports listing scripts, running custom scripts, install, test, build, start, and dev operations.
- create_agent: Create and register a new agent on-the-fly with a specific provider, model, system prompt, and optional tool access.
- run_agent_workflow: Execute one or more registered agents in parallel or sequential mode with execution time tracking per task.
${process.argv.includes('--enable-bash') ? '- bash: Execute bash commands on the local system. Use for file operations, running scripts, checking system info, git commands, etc. (DANGEROUS - ENABLED WITH --enable-bash FLAG)' : ''}

When you need to use a tool, the system will automatically execute it and return results to you.`;

const REQUIRED_ENV_VARS: Record<ProviderType, string> = {
  openai: 'OPENAI_API_KEY',
  claude: 'ANTHROPIC_API_KEY',
  nvidia: 'NVIDIA_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  ollama: 'OLLAMA_BASE_URL (optional, defaults to localhost)',
  google: 'GOOGLE_AI_API_KEY',
};

async function main() {
  registerAllCommands();

  initEnvFromArgs(process.argv);
  const harness = new AIHarness();
  const messages: Message[] = [];
  const state: CliState = {
    currentProvider: null,
    currentModel: undefined,
    enabledTools: [],
    messages,
  };

  const agentWorkflowTools = createAgentWorkflowTools(harness);
  const registered: ProviderType[] = [];
  const missing: Array<{ provider: ProviderType; reason: string }> = [];

  // Register providers from env
  if (process.env.OPENAI_API_KEY) {
    harness.registerProvider('openai', new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY }));
    registered.push('openai');
  } else {
    missing.push({ provider: 'openai', reason: 'OPENAI_API_KEY not set' });
  }

  if (process.env.ANTHROPIC_API_KEY) {
    harness.registerProvider('claude', new ClaudeProvider({ apiKey: process.env.ANTHROPIC_API_KEY }));
    registered.push('claude');
  } else {
    missing.push({ provider: 'claude', reason: 'ANTHROPIC_API_KEY not set' });
  }

  if (process.env.NVIDIA_API_KEY) {
    harness.registerProvider('nvidia', new NvidiaProvider({ apiKey: process.env.NVIDIA_API_KEY }));
    registered.push('nvidia');
  } else {
    missing.push({ provider: 'nvidia', reason: 'NVIDIA_API_KEY not set' });
  }

  if (process.env.OPENROUTER_API_KEY) {
    harness.registerProvider('openrouter', new OpenRouterProvider({ apiKey: process.env.OPENROUTER_API_KEY }));
    registered.push('openrouter');
  } else {
    missing.push({ provider: 'openrouter', reason: 'OPENROUTER_API_KEY not set' });
  }

  if (process.env.GOOGLE_AI_API_KEY) {
    harness.registerProvider('google', new GoogleProvider({ apiKey: process.env.GOOGLE_AI_API_KEY }));
    registered.push('google');
  } else {
    missing.push({ provider: 'google', reason: 'GOOGLE_AI_API_KEY not set' });
  }

  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  if (process.env.OLLAMA_BASE_URL) {
    harness.registerProvider('ollama', new OllamaProvider({ baseUrl: ollamaUrl }));
    registered.push('ollama');
  } else {
    missing.push({ provider: 'ollama', reason: `Failed to connect to ${ollamaUrl}` });
  }

  const providers = harness.listProviders();
  const hasProviders = providers.length > 0;

  state.currentProvider = providers.includes('ollama') ? 'ollama' : providers[0] || null;

  console.log('╔═══════════════════════════════════════╗');
  console.log('║         AI Harness CLI v1.0           ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log('Env-file support: use -e/--env-file <path> to load environment variables from a file.\n');

  if (!hasProviders) {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  No AI providers configured                                ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  Use /config to add a provider:                            ║');
    console.log('║                                                            ║');
    console.log('║    /config openai <apikey>                                 ║');
    console.log('║    /config claude <apikey>                                   ║');
    console.log('║    /config ollama http://localhost:11434                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  } else {
    console.log('\n┌─ Provider Status ─────────────────────┐');
    for (const p of registered) {
      console.log(`│  ✓ ${p.padEnd(12)}                     │`);
    }
    for (const m of missing) {
      if (m.provider !== 'ollama' || process.env.OLLAMA_BASE_URL) {
        console.log(`│  ✗ ${m.provider.padEnd(12)} ${m.reason.slice(0, 22).padEnd(22)} │`);
      }
    }
    console.log('└───────────────────────────────────────┘');
    console.log(`\nActive: ${state.currentProvider}\n`);
  }

  console.log('Commands:');
  console.log('  /quit, /q       - Exit');
  if (hasProviders) {
    console.log('  /models, /m     - List available models');
    console.log('  /model <name>   - Switch model');
    console.log('  /provider, /p   - Switch provider');
    console.log('  /clear, /c      - Clear conversation');
    console.log('  /tools, /t      - Toggle specialized tools (file_ops, web_search, database_user, git_ops, process_ops, run_npm_scripts, create_agent, run_agent_workflow) on/off');
    console.log('  /list-tools, /lt - List all available tools with descriptions');
    console.log('  /agents         - List registered agents');
    console.log('  /plan <goal>    - Create a plan for a goal');
    console.log('  /execute [id]   - Execute a plan');
    console.log('  /status [id]    - Show plan status');
    console.log('  /plans          - List all plans');
  }
  console.log('  /config         - Configure/add providers');
  console.log('  -e, --env-file   - Load environment variables from a file');
  console.log('  /help, /h       - Show help\n');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: state.currentProvider ? `[${state.currentProvider}] > ` : '[none] > ',
  });

  function updatePrompt() {
    const providerDisplay = state.currentProvider || 'none';
    const modelInfo = state.currentModel ? `:${state.currentModel.split(':')[0]}` : '';
    rl.setPrompt(`[${providerDisplay}${modelInfo}] > `);
  }

  function addMessage(role: 'system' | 'user' | 'assistant', content: string) {
    messages.push({ role, content });
  }

  function clearConversation() {
    messages.length = 0;
    addMessage('system', SYSTEM_PROMPT);
    console.log('Conversation cleared.\n');
  }

  addMessage('system', SYSTEM_PROMPT);

  const enableBash = process.argv.includes('--enable-bash');

  const context: CliContext = {
    harness,
    state,
    rl,
    agentWorkflowTools,
    registered,
    missing,
    providers,
    hasProviders,
    SYSTEM_PROMPT,
    TOOLS_SYSTEM_PROMPT,
    REQUIRED_ENV_VARS,
    enableBash,
    updatePrompt,
    addMessage,
    clearConversation,
  };

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    if (input.startsWith('/')) {
      const [cmd, ...args] = input.slice(1).split(' ');
      const commandEntry = getCommand(cmd);

      if (commandEntry) {
        try {
          if (commandEntry.isAsync) {
            await commandEntry.handler(context, args);
          } else {
            commandEntry.handler(context, args);
          }
        } catch (err) {
          console.error(`Error: ${(err as Error).message}\n`);
        }
        rl.prompt();
        return;
      }

      console.log(`Unknown command: /${cmd}. Type /help for commands.\n`);
      rl.prompt();
      return;
    }

    if (!state.currentProvider) {
      console.log('No provider configured. Use /config to add one.\n');
      rl.prompt();
      return;
    }

    addMessage('user', input);

    const loading = new LoadingDisplay();
    loading.start();

    try {

      const stream = harness.stream(state.currentProvider, messages, {
        model: state.currentModel,
        maxTokens: 2000,
        temperature: 0.7,
        tools: state.enabledTools,
      });

      let response = '';
      let firstChunk = true;

      for await (const chunk of stream) {
        if (!chunk.isComplete) {
          if (firstChunk) {
            loading.stop();
            firstChunk = false;
          }
          process.stdout.write(chunk.text);
          response += chunk.text;
        }
      }

      if (firstChunk) {
        loading.stop();
      }

      console.log('\n');
      addMessage('assistant', response);
    } catch (err) {
      loading.stop();
      console.error(`\nError: ${(err as Error).message}\n`);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('Goodbye!');
    process.exit(0);
  });
}

main().catch(console.error);
