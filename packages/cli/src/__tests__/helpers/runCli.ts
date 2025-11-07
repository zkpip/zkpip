// packages/cli/src/__tests__/helpers/runCli.ts
// ESM, strict TS, no `any`.


import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';


export type RunResult = Readonly<{
code: number;
stdout: string;
stderr: string;
}>;


export type RunOpts = Readonly<{
args: readonly string[];
cwd?: string;
env?: NodeJS.ProcessEnv;
timeoutMs?: number;
}>;


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Resolve built CLI entry (dist) or src index if running tsx.
function resolveCliBin(): string {
// Prefer dist for CI stability
const fromTests = path.resolve(__dirname, '../../..');
return path.join(fromTests, 'dist/index.js');
}


export function runCli(opts: RunOpts): Promise<RunResult> {
const bin = resolveCliBin();
const { args, cwd, env, timeoutMs = 20_000 } = opts;
return new Promise((resolve, reject) => {
const child = spawn(process.execPath, [bin, ...args], {
cwd,
env: { ...process.env, NODE_ENV: 'test', FORCE_COLOR: '0', ...env },
stdio: ['ignore', 'pipe', 'pipe'],
});


let out = '';
let err = '';
const t = setTimeout(() => {
child.kill('SIGKILL');
reject(new Error(`CLI run timed out after ${timeoutMs} ms: ${[bin, ...args].join(' ')}`));
}, timeoutMs);


child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');
child.stdout.on('data', (d: string) => { out += d; });
child.stderr.on('data', (d: string) => { err += d; });


child.on('error', (e) => { clearTimeout(t); reject(e); });
child.on('close', (code) => { clearTimeout(t); resolve({ code: code ?? -1, stdout: out, stderr: err }); });
});
}