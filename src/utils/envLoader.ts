import * as fs from 'fs';
import * as path from 'path';

// Parse dotenv-style content into key-value map
export function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    // Remove inline comments starting with #, but only if not within quotes
    const withoutComments = removeInlineComment(line);
    const equalIndex = withoutComments.indexOf('=');
    if (equalIndex <= 0) continue;
    const key = withoutComments.substring(0, equalIndex).trim();
    let value = withoutComments.substring(equalIndex + 1).trim();
    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.substring(1, value.length - 1);
    }
    // Do not overwrite existing keys here; caller can decide about override
    result[key] = value;
  }
  return result;
}

// Load env vars from a file. By default, do not override existing vars unless override is true
export function loadEnvFromFile(filePath: string, options: { override?: boolean } = {}): Record<string, string> {
  const { override = false } = options;
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Env file not found: ${abs}`);
  }
  const content = fs.readFileSync(abs, { encoding: 'utf8' });
  const parsed = parseEnvContent(content);
  for (const [k, v] of Object.entries(parsed)) {
    if (override || process.env[k] === undefined) {
      // stringify value to ensure consistency
      process.env[k] = v;
    }
  }
  return parsed;
}

// Simple helper to strip inline comments not inside quotes (basic support for common cases)
function removeInlineComment(line: string): string {
  // naive approach: split on unescaped # not within quotes
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '\'') inSingle = !inSingle;
    else if (c === '"') inDouble = !inDouble;
    if (c === '#' && !inSingle && !inDouble) {
      return line.substring(0, i).trim();
    }
  }
  return line;
}
