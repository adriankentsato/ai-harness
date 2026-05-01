import { bashTool } from './bash';
import { fileOpsTool } from './file-ops';
import { webSearchTool } from './web-search';
import { databaseUserTool } from './database-user';
import { gitOpsTool } from './git-ops';
import { processOpsTool } from './process-ops';
import { runNpmScriptsTool } from './run-npm-scripts';
import type { ToolDefinition } from '../types/index';

export const availableTools: ToolDefinition[] = [
  bashTool,
  fileOpsTool,
  webSearchTool,
  databaseUserTool,
  gitOpsTool,
  processOpsTool,
  runNpmScriptsTool,
];

export function getTool(name: string): ToolDefinition | undefined {
  return availableTools.find(t => t.name === name);
}

export function createToolSet(names: string[]): ToolDefinition[] {
  return names
    .map(name => getTool(name))
    .filter((t): t is ToolDefinition => t !== undefined);
}

export { bashTool } from './bash';
export type { BashToolArgs } from './bash';
export { fileOpsTool } from './file-ops';
export type { FileOpsArgs } from './file-ops';
export { webSearchTool } from './web-search';
export type { WebSearchArgs } from './web-search';
export { databaseUserTool } from './database-user';
export type { DatabaseUserArgs } from './database-user';
export { gitOpsTool } from './git-ops';
export type { GitOpsArgs } from './git-ops';
export { processOpsTool } from './process-ops';
export type { ProcessOpsArgs } from './process-ops';
export { runNpmScriptsTool } from './run-npm-scripts';
export type { RunNpmScriptsArgs } from './run-npm-scripts';
