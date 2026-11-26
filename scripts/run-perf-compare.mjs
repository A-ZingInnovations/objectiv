#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const code = `
import { runLlmSuitePerfTest, formatPerfReport } from './src/llmSuitePerf.ts';
const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error('OPENROUTER_API_KEY required');
async function main() {
  for (const bili of [false, true]) {
    console.log('\\n=== biliContextEnabled=' + bili + ' ===');
    const report = await runLlmSuitePerfTest({
      provider: 'openai',
      model: 'openai/gpt-4o-mini',
      byokBaseUrl: 'https://openrouter.ai/api/v1',
      byokApiKey: key,
      byokOrg: '',
      ollamaBaseUrl: 'http://127.0.0.1:11434',
      messages: [],
      biliContextEnabled: bili,
      biliDaemonUrl: 'http://127.0.0.1:8787',
    });
    console.log(formatPerfReport(report));
  }
}
main();
`;
const r = spawnSync('npx', ['--yes', 'tsx', '-e', code], {
  cwd: appDir,
  env: process.env,
  stdio: 'inherit',
});
process.exit(r.status ?? 1);