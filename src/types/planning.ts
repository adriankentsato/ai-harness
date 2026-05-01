export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies?: string[]; // step IDs this step depends on
  tool?: string; // tool name if this step uses a tool
  toolArgs?: Record<string, unknown>; // arguments for the tool
  result?: string; // result of step execution
  error?: string; // error if step failed
}

export interface Plan {
  id: string;
  goal: string;
  description: string;
  steps: PlanStep[];
  status: 'created' | 'executing' | 'completed' | 'failed' | 'paused';
  createdAt: Date;
  updatedAt: Date;
  currentStep?: string; // ID of currently executing step
}

export interface PlanningOptions {
  maxSteps?: number;
  allowTools?: boolean;
  requireConfirmation?: boolean;
  timeout?: number;
}

export interface PlanningResult {
  plan: Plan;
  executionLog: string[];
  success: boolean;
  error?: string;
}
