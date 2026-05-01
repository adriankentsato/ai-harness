import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { initEnvFromArgs } from '../src/utils/envInit';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadEnvFromFile } from '../src/utils/envLoader';

describe('envInit', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envinit-'));
  });
  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  test('loads env-file when provided in argv', () => {
    const envPath = path.join(tmpDir, '.env');
    fs.writeFileSync(envPath, 'INIT_VAR=hello');
    // ensure clean
    delete process.env.INIT_VAR;
    initEnvFromArgs(['node', 'script', '--env-file', envPath]);
    expect(process.env.INIT_VAR).toBe('hello');
  });
});
