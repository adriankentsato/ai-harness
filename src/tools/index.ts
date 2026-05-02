import { bashTool } from './bash';
import { fileOpsTool } from './file-ops';
import { webSearchTool } from './web-search';
import { databaseUserTool } from './database-user';
import { gitOpsTool } from './git-ops';
import { processOpsTool } from './process-ops';
import { runNpmScriptsTool } from './run-npm-scripts';
import type { ToolDefinition } from '../types/index';
import { IGenericType } from '../utils/types/generic-type';

export const availableTools: ToolDefinition<IGenericType, IGenericType>[] = [
  bashTool,
  fileOpsTool,
  webSearchTool,
  databaseUserTool,
  gitOpsTool,
  processOpsTool,
  runNpmScriptsTool,
];

export function getTool(name: string): ToolDefinition<IGenericType, IGenericType> | undefined {
  return availableTools.find(t => t.name === name);
}

export function createToolSet(names: string[]): ToolDefinition<IGenericType, IGenericType>[] {
  return names
    .map(name => getTool(name))
    .filter((t): t is ToolDefinition<IGenericType, IGenericType> => t !== undefined);
}

export { bashTool } from './bash';
export { fileOpsTool } from './file-ops';
export { webSearchTool } from './web-search';
export { databaseUserTool } from './database-user';
export { gitOpsTool } from './git-ops';
export { processOpsTool } from './process-ops';
export { runNpmScriptsTool } from './run-npm-scripts';
export { createAgentWorkflowTools } from './agent-workflow';
