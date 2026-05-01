import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { parseEnvContent, loadEnvFromFile } from '../src/utils/envLoader';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('envLoader parseEnvContent', () => {
  test('parses basic key=value lines and quotes', () => {
    const content = `FOO=bar\nBAR="baz qux"\n# comment line\nEMPTY=\`\`\n`;
    const parsed = parseEnvContent(content);
    expect(parsed.FOO).toBe('bar');
    expect(parsed.BAR).toBe('baz qux');
    expect(parsed.EMPTY).toBe('');
  });
});

describe('envLoader loadEnvFromFile', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envtest-'));
  });
  afterEach(() => {
    // cleanup any created files
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  test('loads env vars without overriding existing', () => {
    const filePath = path.join(tmpDir, '.env');
    fs.writeFileSync(filePath, 'FOO=bar\nEXIST=orig');
    process.env.EXIST = 'existing';

    const parsed = loadEnvFromFile(filePath, { override: false });
    // ensure parsed values
    expect(parsed.FOO).toBe('bar');
    // existing should remain untouched
    expect(process.env.EXIST).toBe('existing');
    expect(process.env.FOO).toBe('bar');
  });

  test('overrides when override option is true', () => {
    const filePath = path.join(tmpDir, '.env2');
    fs.writeFileSync(filePath, 'FOO=overridden');
    process.env.FOO = 'older';
    const parsed = loadEnvFromFile(filePath, { override: true });
    expect(parsed.FOO).toBe('overridden');
    expect(process.env.FOO).toBe('overridden');
  });
});
