import type { CommandModule } from 'yargs';
import { readFile } from 'node:fs/promises';
import { writeFile } from '../../src/utils/fs-compat.js';
import { resolve } from 'node:path';
import { deriveCanonicalHash, normalizeJsonStable, type CanonicalInput } from '../utils/envelope.js';

type BaseArgs = { in: string; out: string };

export const convertCanonicalCmd: CommandModule<unknown, BaseArgs> = {
  command: 'convert canonical',
  describe: 'Produce canonical JSON with stable order',
  builder: (y) => y.option('in', { type: 'string', demandOption: true }).option('out', { type: 'string', demandOption: true }),
  handler: async (argv) => {
    const raw = await readFile(resolve(argv.in), 'utf8');
    const obj = JSON.parse(raw) as CanonicalInput;
    const body = normalizeJsonStable(obj) + '\n';
    await writeFile(resolve(argv.out), body, 'utf8');
  },
};

export const convertHexCmd: CommandModule<unknown, BaseArgs> = {
  command: 'convert hex',
  describe: 'Convert canonical JSON → hex payload',
  builder: (y) => y.option('in', { type: 'string', demandOption: true }).option('out', { type: 'string', demandOption: true }),
  handler: async (argv) => {
    const raw = await readFile(resolve(argv.in), 'utf8');
    const hex = Buffer.from(raw, 'utf8').toString('hex');
    await writeFile(resolve(argv.out), `0x${hex}\n`, 'utf8');
  },
};

export const convertBase64Cmd: CommandModule<unknown, BaseArgs> = {
  command: 'convert base64',
  describe: 'Convert canonical JSON → base64 payload',
  builder: (y) => y.option('in', { type: 'string', demandOption: true }).option('out', { type: 'string', demandOption: true }),
  handler: async (argv) => {
    const raw = await readFile(resolve(argv.in), 'utf8');
    const b64 = Buffer.from(raw, 'utf8').toString('base64');
    await writeFile(resolve(argv.out), `${b64}\n`, 'utf8');
  },
};

// Optional A→B→C→A helper (invoked by tests)
export async function roundTripEqual(a: string, b: string): Promise<boolean> {
  const aa = await readFile(resolve(a), 'utf8');
  const bb = await readFile(resolve(b), 'utf8');
  return normalizeJsonStable(JSON.parse(aa)) === normalizeJsonStable(JSON.parse(bb));
}

// Export URN helper
export function vectorUrnFromCanonical(input: CanonicalInput): string {
  const h = deriveCanonicalHash(input);
  return `urn:zkpip:vector:sha256:${h}`;
}
