import { registerCommand } from '../registry';
import { handleQuit } from './quit';
import { handleModels } from './models';
import { handleModel } from './model';
import { handleProvider } from './provider';
import { handleConfig } from './config';
import { handleClear } from './clear';
import { handleTools } from './tools';
import { handlePlan } from './plan';
import { handleExecute } from './execute';
import { handleStatus } from './status';
import { handlePlans } from './plans';
import { handleListTools } from './list-tools';
import { handleAgents } from './agents';
import { handleHelp } from './help';

export function registerAllCommands(): void {
  registerCommand(['quit', 'q', 'exit'], handleQuit);
  registerCommand(['models', 'm'], handleModels, true);
  registerCommand(['model'], handleModel);
  registerCommand(['provider', 'p'], handleProvider);
  registerCommand(['config'], handleConfig);
  registerCommand(['clear', 'c'], handleClear);
  registerCommand(['tools', 't'], handleTools);
  registerCommand(['plan'], handlePlan, true);
  registerCommand(['execute'], handleExecute, true);
  registerCommand(['status'], handleStatus, true);
  registerCommand(['plans'], handlePlans, true);
  registerCommand(['list-tools', 'lt'], handleListTools);
  registerCommand(['agents'], handleAgents);
  registerCommand(['help', 'h'], handleHelp);
}
