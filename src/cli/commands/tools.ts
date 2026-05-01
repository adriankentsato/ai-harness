import { bashTool, fileOpsTool, webSearchTool, databaseUserTool, gitOpsTool, processOpsTool, runNpmScriptsTool } from '../../tools/index';
import type { CliContext } from '../types';

export function handleTools(context: CliContext): void {
  const { state, rl, agentWorkflowTools, enableBash, SYSTEM_PROMPT, TOOLS_SYSTEM_PROMPT } = context;

  if (state.enabledTools.length > 0) {
    state.enabledTools = [];
    state.messages.length = 0;
    context.addMessage('system', SYSTEM_PROMPT);
    console.log('Tools disabled. Using standard system prompt.\n');
  } else {
    state.enabledTools = [fileOpsTool, webSearchTool, databaseUserTool, gitOpsTool, processOpsTool, runNpmScriptsTool, ...agentWorkflowTools];
    
    if (enableBash) {
      state.enabledTools.push(bashTool);
      console.log('⚠️  Bash tool enabled with --enable-bash flag - use with caution!');
    }
    
    state.messages.length = 0;
    context.addMessage('system', TOOLS_SYSTEM_PROMPT);
    console.log(`Tools enabled: ${state.enabledTools.map(t => t.name).join(', ')}`);
    console.log('Using tools-enabled system prompt.\n');
  }
  rl.prompt();
}
