import { AgentContext, AgentResult } from './agent';

export interface AgentTask {
  agentName: string;
  input: string;
  context?: AgentContext;
  dependsOn?: string[]; // task names this task depends on
}

export interface WorkflowResult {
  taskName: string;
  agentName: string;
  result: AgentResult;
  executionTime: number;
  error?: string;
}

export interface WorkflowSummary {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalExecutionTime: number;
  results: WorkflowResult[];
  success: boolean;
}

export interface WorkflowOptions {
  maxConcurrency?: number;
  timeout?: number;
  continueOnError?: boolean;
}
