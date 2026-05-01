import { loadEnvFromFile } from './envLoader';

// Initialize environment variables from command line arguments.
// Supports --env-file <path> and -e <path>
export function initEnvFromArgs(argv: string[]): void {
  const args = argv.slice(2); // skip node and script path
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--env-file' || a === '-e') {
      const pathArg = args[i + 1];
      if (pathArg) {
        // Load env vars without overriding existing ones by default
        try {
          loadEnvFromFile(pathArg, { override: false });
        } catch {
          // Ignore invalid env file at startup to avoid hard-failing the CLI
        }
      }
      break;
    }
    // Support combined form: --env-file=path
    const eqIndex = a.indexOf('=');
    if (eqIndex > 0 && (a.startsWith('--env-file') || a.startsWith('-e'))) {
      const value = a.substring(eqIndex + 1);
      if (value) {
        try {
          loadEnvFromFile(value, { override: false });
        } catch {
          // Ignore invalid env file at startup to avoid hard-failing the CLI
        }
      }
      break;
    }
  }
}
