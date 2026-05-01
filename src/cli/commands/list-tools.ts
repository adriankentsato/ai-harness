import { bashTool, fileOpsTool, webSearchTool, databaseUserTool, gitOpsTool, processOpsTool, runNpmScriptsTool } from '../../tools/index';
import type { CliContext } from '../types';

export function handleListTools(context: CliContext): void {
  const { rl, state, agentWorkflowTools, enableBash } = context;

  console.log('\n┌─ Available Tools ─────────────────────┐');
  console.log('│                                        │');
  
  const allTools = [
    bashTool,
    fileOpsTool, 
    webSearchTool,
    databaseUserTool,
    gitOpsTool,
    processOpsTool,
    runNpmScriptsTool,
    ...agentWorkflowTools
  ];

  allTools.forEach(tool => {
    const isBash = tool.name === 'bash';
    const status = isBash && !enableBash ? '🔒' : '✓';
    const name = tool.name.padEnd(22);
    const desc = tool.description.slice(0, 35).padEnd(35);
    console.log(`│  ${status} ${name} ${desc} │`);
  });
  
  console.log('│                                        │');
  console.log('│  Status: ✓ = Available, 🔒 = Requires   │');
  console.log('│          --enable-bash flag           │');
  console.log('└────────────────────────────────────────┘\n');
  
  if (state.enabledTools.length > 0) {
    console.log(`Currently enabled: ${state.enabledTools.map(t => t.name).join(', ')}\n`);
  } else {
    console.log('No tools currently enabled. Use /tools to enable.\n');
  }
  rl.prompt();
}
