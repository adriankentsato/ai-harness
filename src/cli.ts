#!/usr/bin/env node

import { createInterface } from 'readline';
import { AIHarness } from './harness';
import { bashTool, fileOpsTool, webSearchTool, databaseUserTool, gitOpsTool, processOpsTool, runNpmScriptsTool } from './tools/index';
import type { Message, ProviderType, ToolDefinition } from './types/index';

const SYSTEM_PROMPT = 'You are a helpful assistant. Be concise and clear.';
const TOOLS_SYSTEM_PROMPT = `You are a helpful assistant with access to system tools. Be concise and clear.

You have access to the following tools:
- file_ops: Perform native file system operations including read, write, append, copy, move, delete, create directories, list directory contents, get file stats, and check if paths exist.
- web_search: Search the web for information using multiple search providers (DuckDuckGo, Brave, SearX). Returns relevant web pages with titles, URLs, and snippets.
- database_user: Connect to a SQLite database and perform user information operations (create, read, update, delete users).
- git_ops: Perform Git operations with strict working directory restrictions. Supports status, log, add, commit, push, pull, branch, checkout, diff, show, init, and clone operations.
- process_ops: Perform safe process operations with strict working directory restrictions. Supports listing processes, killing processes, getting process info, and checking tool versions.
- run_npm_scripts: Execute npm scripts and package management operations with strict working directory restrictions. Supports listing scripts, running custom scripts, install, test, build, start, and dev operations.
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
  const harness = new AIHarness();
  const messages: Message[] = [];
  let currentProvider: ProviderType | null = null;
  let currentModel: string | undefined = undefined;
  let enabledTools: ToolDefinition[] = [];
  const registered: ProviderType[] = [];
  const missing: Array<{ provider: ProviderType; reason: string }> = [];

  // Register providers from env
  if (process.env.OPENAI_API_KEY) {
    harness.registerProvider('openai', { apiKey: process.env.OPENAI_API_KEY });
    registered.push('openai');
  } else {
    missing.push({ provider: 'openai', reason: 'OPENAI_API_KEY not set' });
  }

  if (process.env.ANTHROPIC_API_KEY) {
    harness.registerProvider('claude', { apiKey: process.env.ANTHROPIC_API_KEY });
    registered.push('claude');
  } else {
    missing.push({ provider: 'claude', reason: 'ANTHROPIC_API_KEY not set' });
  }

  if (process.env.NVIDIA_API_KEY) {
    harness.registerProvider('nvidia', { apiKey: process.env.NVIDIA_API_KEY });
    registered.push('nvidia');
  } else {
    missing.push({ provider: 'nvidia', reason: 'NVIDIA_API_KEY not set' });
  }

  if (process.env.OPENROUTER_API_KEY) {
    harness.registerProvider('openrouter', { apiKey: process.env.OPENROUTER_API_KEY });
    registered.push('openrouter');
  } else {
    missing.push({ provider: 'openrouter', reason: 'OPENROUTER_API_KEY not set' });
  }

  if (process.env.GOOGLE_AI_API_KEY) {
    harness.registerProvider('google', { apiKey: process.env.GOOGLE_AI_API_KEY });
    registered.push('google');
  } else {
    missing.push({ provider: 'google', reason: 'GOOGLE_AI_API_KEY not set' });
  }

  // Ollama: check OLLAMA_BASE_URL specifically
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  if (process.env.OLLAMA_BASE_URL) {
    harness.registerProvider('ollama', { baseUrl: ollamaUrl });
    registered.push('ollama');
  } else {
    missing.push({ provider: 'ollama', reason: `Failed to connect to ${ollamaUrl}` });
  }

  const providers = harness.listProviders();
  const hasProviders = providers.length > 0;

  // Default to first provider, or ollama if available
  currentProvider = providers.includes('ollama') ? 'ollama' : providers[0] || null;

  console.log('╔═══════════════════════════════════════╗');
  console.log('║         AI Harness CLI v1.0           ║');
  console.log('╚═══════════════════════════════════════╝');

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
    // Show provider status
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
    console.log(`\nActive: ${currentProvider}\n`);
  }

  console.log('Commands:');
  console.log('  /quit, /q       - Exit');
  if (hasProviders) {
    console.log('  /models, /m     - List available models');
    console.log('  /model <name>   - Switch model');
    console.log('  /provider, /p   - Switch provider');
    console.log('  /clear, /c      - Clear conversation');
    console.log('  /tools, /t      - Toggle specialized tools (file_ops, web_search, database_user, git_ops, process_ops, run_npm_scripts) on/off');
    console.log('  /list-tools, /lt - List all available tools with descriptions');
    console.log('  /plan <goal>    - Create a plan for a goal');
    console.log('  /execute [id]   - Execute a plan');
    console.log('  /status [id]    - Show plan status');
    console.log('  /plans          - List all plans');
  }
  console.log('  /config         - Configure/add providers');
  console.log('  /help, /h       - Show help\n');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: currentProvider ? `[${currentProvider}] > ` : '[none] > ',
  });

  function updatePrompt() {
    const providerDisplay = currentProvider || 'none';
    const modelInfo = currentModel ? `:${currentModel.split(':')[0]}` : '';
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

  // Initialize with system prompt
  addMessage('system', SYSTEM_PROMPT);

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // Handle commands
    if (input.startsWith('/')) {
      const [cmd, ...args] = input.slice(1).split(' ');

      switch (cmd) {
        case 'quit':
        case 'q':
        case 'exit':
          console.log('Goodbye!');
          rl.close();
          return;

        case 'models':
        case 'm':
          if (!currentProvider) {
            console.log('No provider configured. Use /config to add one.\n');
            rl.prompt();
            return;
          }
          try {
            const models = await harness.fetchModels(currentProvider);
            console.log(`\n${models.length} models available:`);
            models.slice(0, 20).forEach(m => {
              const marker = m.id === currentModel ? '▸ ' : '  ';
              const desc = m.description ? ` - ${m.description}` : '';
              console.log(`${marker}• ${m.id}${desc}`);
            });
            if (models.length > 20) {
              console.log(`  ... and ${models.length - 20} more`);
            }
            console.log();
          } catch (err) {
            console.error(`Error: ${(err as Error).message}\n`);
          }
          rl.prompt();
          return;

        case 'model':
          if (!currentProvider) {
            console.log('No provider configured. Use /config to add one.\n');
            rl.prompt();
            return;
          }
          if (args.length === 0) {
            if (currentModel) {
              console.log(`\nCurrent model: ${currentModel}\n`);
            } else {
              console.log(`\nUsing provider default model\n`);
            }
          } else {
            const newModel = args.join(' ');
            currentModel = newModel;
            updatePrompt();
            console.log(`Switched to model: ${currentModel}\n`);
          }
          rl.prompt();
          return;

        case 'provider':
        case 'p':
          if (args.length === 0) {
            console.log(`\nCurrent: ${currentProvider || 'none'}`);
            console.log(`Available: ${providers.join(', ') || 'none'}\n`);
          } else {
            const newProvider = args[0] as ProviderType;
            if (harness.hasProvider(newProvider)) {
              currentProvider = newProvider;
              updatePrompt();
              console.log(`Switched to ${currentProvider}\n`);
            } else {
              console.log(`Unknown provider: ${newProvider}\n`);
            }
          }
          rl.prompt();
          return;

        case 'config':
          console.log('\n┌─ Provider Configuration ──────────────┐');
          console.log('│                                         │');
          for (const [provider, envVar] of Object.entries(REQUIRED_ENV_VARS)) {
            const isRegistered = harness.hasProvider(provider as ProviderType);
            const status = isRegistered ? '✓' : '✗';
            console.log(`│  ${status} ${provider.padEnd(11)} ${envVar.slice(0, 28).padEnd(28)} │`);
          }
          console.log('│                                         │');
          console.log('│  Usage: /config <provider> <apikey>     │');
          console.log('│  Example: /config openai sk-abc123      │');
          console.log('└─────────────────────────────────────────┘\n');

          if (args.length >= 2) {
            const providerName = args[0] as ProviderType;
            const apiKey = args.slice(1).join(' ');

            if (!REQUIRED_ENV_VARS[providerName]) {
              console.log(`Unknown provider: ${providerName}\n`);
              rl.prompt();
              return;
            }

            try {
              if (providerName === 'ollama') {
                harness.registerProvider('ollama', { baseUrl: apiKey });
                console.log(`✓ Ollama configured at ${apiKey}\n`);
              } else {
                harness.registerProvider(providerName, { apiKey });
                console.log(`✓ ${providerName} configured with provided key\n`);
              }

              // If this is the first provider, make it active
              if (!currentProvider) {
                currentProvider = providerName;
                updatePrompt();
              }
            } catch (err) {
              console.error(`✗ Failed to configure ${providerName}: ${(err as Error).message}\n`);
            }
          } else if (args.length === 1) {
            console.log(`Usage: /config ${args[0]} <apikey>\n`);
          }
          rl.prompt();
          return;

        case 'clear':
        case 'c':
          clearConversation();
          rl.prompt();
          return;

        case 'tools':
        case 't':
          if (enabledTools.length > 0) {
            enabledTools = [];
            messages.length = 0;
            addMessage('system', SYSTEM_PROMPT);
            console.log('Tools disabled. Using standard system prompt.\n');
          } else {
            // Default tools (always safe)
            enabledTools = [fileOpsTool, webSearchTool, databaseUserTool, gitOpsTool, processOpsTool, runNpmScriptsTool];
            
            // Only include bash tool if --enable-bash flag is provided
            if (process.argv.includes('--enable-bash')) {
              enabledTools.push(bashTool);
              console.log('⚠️  Bash tool enabled with --enable-bash flag - use with caution!');
            }
            
            messages.length = 0;
            addMessage('system', TOOLS_SYSTEM_PROMPT);
            console.log(`Tools enabled: ${enabledTools.map(t => t.name).join(', ')}`);
            console.log('Using tools-enabled system prompt.\n');
          }
          rl.prompt();
          return;

        case 'plan':
          if (!currentProvider) {
            console.log('No provider configured. Use /config to add one.\n');
            rl.prompt();
            return;
          }
          if (args.length === 0) {
            console.log('Usage: /plan <goal>\n');
            rl.prompt();
            return;
          }
          try {
            const goal = args.join(' ');
            console.log('Creating plan...');
            const result = await harness.createPlan(currentProvider, goal);
            console.log(result);
          } catch (err) {
            console.error(`Error: ${(err as Error).message}\n`);
          }
          rl.prompt();
          return;

        case 'execute':
          if (!currentProvider) {
            console.log('No provider configured. Use /config to add one.\n');
            rl.prompt();
            return;
          }
          try {
            const planId = args[0];
            console.log('Executing plan...');
            const result = await harness.executePlan(currentProvider, planId);
            console.log(result);
          } catch (err) {
            console.error(`Error: ${(err as Error).message}\n`);
          }
          rl.prompt();
          return;

        case 'status':
          if (!currentProvider) {
            console.log('No provider configured. Use /config to add one.\n');
            rl.prompt();
            return;
          }
          try {
            const planId = args[0];
            const result = await harness.getPlanStatus(currentProvider, planId);
            console.log(result);
          } catch (err) {
            console.error(`Error: ${(err as Error).message}\n`);
          }
          rl.prompt();
          return;

        case 'plans':
          if (!currentProvider) {
            console.log('No provider configured. Use /config to add one.\n');
            rl.prompt();
            return;
          }
          try {
            const result = await harness.listPlans(currentProvider);
            console.log(result);
          } catch (err) {
            console.error(`Error: ${(err as Error).message}\n`);
          }
          rl.prompt();
          return;

        case 'list-tools':
        case 'lt':
          console.log('\n┌─ Available Tools ─────────────────────┐');
          console.log('│                                        │');
          
          const allTools = [
            bashTool,
            fileOpsTool, 
            webSearchTool,
            databaseUserTool,
            gitOpsTool,
            processOpsTool,
            runNpmScriptsTool
          ];

          allTools.forEach(tool => {
            const isBash = tool.name === 'bash';
            const status = isBash && !process.argv.includes('--enable-bash') ? '🔒' : '✓';
            const name = tool.name.padEnd(16);
            const desc = tool.description.slice(0, 35).padEnd(35);
            console.log(`│  ${status} ${name} ${desc} │`);
          });
          
          console.log('│                                        │');
          console.log('│  Status: ✓ = Available, 🔒 = Requires   │');
          console.log('│          --enable-bash flag           │');
          console.log('└────────────────────────────────────────┘\n');
          
          if (enabledTools.length > 0) {
            console.log(`Currently enabled: ${enabledTools.map(t => t.name).join(', ')}\n`);
          } else {
            console.log('No tools currently enabled. Use /tools to enable.\n');
          }
          rl.prompt();
          return;

        case 'help':
        case 'h':
          console.log('\nCommands:');
          console.log('  /quit, /q          - Exit');
          console.log('  /models, /m        - List available models');
          console.log('  /model <name>      - Switch model');
          console.log('  /provider, /p      - Switch provider');
          console.log('  /tools, /t         - Toggle specialized tools (file_ops, web_search, database_user, git_ops, process_ops, run_npm_scripts) on/off');
    console.log('                    (bash tool requires --enable-bash flag for security)');
          console.log('  /list-tools, /lt  - List all available tools with descriptions');
          console.log('  /plan <goal>       - Create a plan for a goal');
          console.log('  /execute [id]      - Execute a plan');
          console.log('  /status [id]       - Show plan status');
          console.log('  /plans             - List all plans');
          console.log('  /config [p] [key]  - Configure providers');
          console.log('  /clear, /c         - Clear conversation');
          console.log('  /help, /h          - Show help\n');
          rl.prompt();
          return;

        default:
          console.log(`Unknown command: /${cmd}. Type /help for commands.\n`);
          rl.prompt();
          return;
      }
    }

    // Process user message
    if (!currentProvider) {
      console.log('No provider configured. Use /config to add one.\n');
      rl.prompt();
      return;
    }

    addMessage('user', input);

    try {
      process.stdout.write('Thinking...\r');

      const stream = harness.stream(currentProvider, messages, {
        model: currentModel,
        maxTokens: 2000,
        temperature: 0.7,
        tools: enabledTools,
      });

      let response = '';
      process.stdout.write('            \r'); // Clear "Thinking..."

      for await (const chunk of stream) {
        if (!chunk.isComplete) {
          process.stdout.write(chunk.text);
          response += chunk.text;
        }
      }

      console.log('\n');
      addMessage('assistant', response);
    } catch (err) {
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
