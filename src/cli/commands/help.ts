import type { CliContext } from '../types';

export function handleHelp(context: CliContext): void {
  const { rl, enableBash } = context;

  console.log('\nCommands:');
  console.log('  /quit, /q          - Exit');
  console.log('  /models, /m        - List available models');
  console.log('  /model <name>      - Switch model');
  console.log('  /provider, /p      - Switch provider');
  console.log('  /tools, /t         - Toggle specialized tools (file_ops, web_search, database_user, git_ops, process_ops, run_npm_scripts, create_agent, run_agent_workflow) on/off');
  if (enableBash) {
    console.log('                    (bash tool enabled with --enable-bash flag)');
  } else {
    console.log('                    (bash tool requires --enable-bash flag for security)');
  }
  console.log('  /list-tools, /lt  - List all available tools with descriptions');
  console.log('  /agents           - List registered agents');
  console.log('  /plan <goal>       - Create a plan for a goal');
  console.log('  /execute [id]      - Execute a plan');
  console.log('  /status [id]       - Show plan status');
  console.log('  /plans             - List all plans');
  console.log('  /config [p] [key]  - Configure providers');
  console.log('  /clear, /c         - Clear conversation');
  console.log('  /help, /h          - Show help\n');
  rl.prompt();
}
