import { bashTool } from './bash.js';
import { fileOpsTool } from './file-ops.js';
import { webSearchTool } from './web-search.js';
import type { ToolDefinition } from '../types.js';

export const availableTools: ToolDefinition[] = [
  bashTool,
  fileOpsTool,
  webSearchTool,
];

export function getTool(name: string): ToolDefinition | undefined {
  return availableTools.find(t => t.name === name);
}

export function createToolSet(names: string[]): ToolDefinition[] {
  return names
    .map(name => getTool(name))
    .filter((t): t is ToolDefinition => t !== undefined);
}

export { bashTool } from './bash.js';
export type { BashToolArgs } from './bash.js';
export { fileOpsTool } from './file-ops.js';
export type { FileOpsArgs } from './file-ops.js';
export { webSearchTool } from './web-search.js';
export type { WebSearchArgs } from './web-search.js';
