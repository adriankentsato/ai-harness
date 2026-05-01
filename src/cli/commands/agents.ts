import type { CliContext } from '../types';

export function handleAgents(context: CliContext): void {
  const { rl, harness } = context;

  console.log('\n┌─ Registered Agents ───────────────────┐');
  console.log('│                                        │');
  const agents = harness.listAgents();
  if (agents.length === 0) {
    console.log('│  No agents registered. Use create_agent │');
    console.log('│  tool or /create-agent command.       │');
  } else {
    for (const agentName of agents) {
      console.log(`│  • ${agentName.padEnd(36)} │`);
    }
  }
  console.log('│                                        │');
  console.log('└────────────────────────────────────────┘\n');
  rl.prompt();
}
