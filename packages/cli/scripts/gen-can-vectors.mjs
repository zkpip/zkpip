#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { args.help = true; continue; }
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[k] = v;
    } else args._.push(a);
  }
  return args;
}

function printHelp() {
  process.stdout.write(
`Usage:
  node packages/cli/scripts/gen-can-vectors.mjs --in <manifest.json> --key-dir <dir> --out <sealed.json>

Options:
  --in <path>       Manifest JSON path (required)
  --key-dir <dir>   Key directory (required)
  --out <path>      Output sealed JSON (required)
  --help            Show this help and exit 0
`);
}

function isString(x) { return typeof x === 'string'; }
function norm(p, base = process.cwd()) {
  if (!isString(p)) throw new TypeError(`Path must be string, got: ${typeof p}`);
  return path.isAbsolute(p) ? p : path.resolve(base, p);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); return; }

  const missing = [];
  if (!isString(args.in)) missing.push('--in');
  if (!isString(args['key-dir'])) missing.push('--key-dir');
  if (!isString(args.out)) missing.push('--out');
  if (missing.length) { process.stderr.write(`Missing required arg(s): ${missing.join(', ')}\n`); process.exit(2); return; }

  const manifest = norm(args.in);
  const keyDir = norm(args['key-dir']);
  const out = norm(args.out);

  if (!fs.existsSync(manifest)) { process.stderr.write(`Manifest not found: ${manifest}\n`); process.exit(2); return; }
  if (!fs.existsSync(keyDir)) { process.stderr.write(`Key dir not found: ${keyDir}\n`); process.exit(2); return; }
  fs.mkdirSync(path.dirname(out), { recursive: true });

  const cliBin = norm(path.join(__dirname, '..', 'dist', 'index.js'));
  const child = spawn(process.execPath, [
    cliBin, 'vectors', 'forge-seal', // ← ha nálatok más a subcommand, ITT 1 helyen átírható
    '--manifest', manifest, '--key-dir', keyDir, '--out', out, '--json'
  ], { stdio: 'inherit' });

  child.on('close', (code) => process.exit(code ?? 70));
  child.on('error', () => process.exit(70));
}

main().catch(() => process.exit(70));
