// packages/cli/src/commands/forge.ts
import type { CommandModule, Argv, CommandBuilder } from 'yargs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { makeEnvelopeId, normalizeJsonStable, asHexSeed } from '../utils/envelope.js';

import {
  type AdapterId,
  availableAdapterIds,
  isAdapterId,
} from '../registry/adapterRegistry.js';

type ForgeArgs = {
  input: string;
  out: string;
  adapter: AdapterId;
  dryRun: boolean;
  strict: boolean;
  seed?: string;
};

function protocolAndCurve(
  adapter: AdapterId,
): { protocol: 'groth16' | 'plonk'; curve: 'bn128' } {
  if (adapter === 'snarkjs-plonk') return { protocol: 'plonk', curve: 'bn128' };
  return { protocol: 'groth16', curve: 'bn128' };
}

export const forgeCmd: CommandModule<unknown, ForgeArgs> = {
  command: 'forge',
  describe: 'Forge a proof envelope from raw inputs',
  builder: ((y: Argv<unknown>): Argv<ForgeArgs> =>
    y
      .option('input', { type: 'string', demandOption: true, desc: 'Input JSON path' })
      .option('out', { type: 'string', demandOption: true, desc: 'Output JSON path' })
      .option('adapter', {
        type: 'string',
        // yargs choices string[]-et vár; explicit cast ok
        choices: availableAdapterIds as unknown as readonly string[],
        demandOption: true,
      })
      .option('dryRun', { type: 'boolean', default: false, desc: 'Write to stdout only' })
      .alias('dryRun', 'dry-run')
      .option('strict', { type: 'boolean', default: false, desc: 'Treat suspicious fields as errors' })
      .option('seed', { type: 'string', desc: 'Hex seed (0x...) for deterministic envelopeId' })
      .check((argv) => {
        if (argv.seed && !/^0x[0-9a-f]+$/i.test(argv.seed)) {
          throw new Error('seed must be 0x-prefixed hex');
        }
        if (!isAdapterId(String(argv.adapter))) {
          throw new Error(`unknown adapter: ${argv.adapter}`);
        }
        return true;
      }) as Argv<ForgeArgs>) as CommandBuilder<unknown, ForgeArgs>,

  handler: async (argv) => {
    const { input, out, adapter, dryRun, strict, seed } = argv;
    const raw = await (await import('node:fs/promises')).readFile(resolve(input), 'utf8');
    const json = JSON.parse(raw) as Record<string, unknown>;

    if (strict) {
      const forbidden = ['$schema', '$id', 'artifactsPath', 'uri'];
      const bad = forbidden.filter((k) => k in json);
      if (bad.length) throw new Error(`Strict mode: forbidden fields present: ${bad.join(', ')}`);
    }

    const { protocol, curve } = protocolAndCurve(adapter);
    const envelopeId = makeEnvelopeId(seed ? asHexSeed(seed) : undefined);

    const envelope = {
      envelopeId,
      protocol,
      curve,
      adapter,
      createdAt: new Date().toISOString(),
      input: json,
    };

    const pretty = `${normalizeJsonStable(envelope)}\n`;
    if (dryRun) { process.stdout.write(pretty); return; }
    await writeFile(resolve(out), pretty, 'utf8');
  },
};
