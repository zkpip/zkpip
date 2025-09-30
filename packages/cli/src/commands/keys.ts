// packages/cli/src/commands/keys.ts
import type { CommandModule } from 'yargs';
import { runKeysGenerate, type KeysGenerateOptions } from './keys-generate.js';
import { defaultStoreRoot } from '../utils/keystore.js';

type GenArgs = {
  alg: 'ed25519';
  keyId?: string;
  store: string;
  label?: string;
  json: boolean;
};

const keysGenerateCmd: CommandModule<unknown, GenArgs> = {
  command: 'keys generate',
  describe: 'Generate a new keypair into the keystore (dev-only)',
  builder: {
    alg: {
      type: 'string',
      choices: ['ed25519'] as const,
      default: 'ed25519' as const,
      describe: 'Algorithm',
    },
    keyId: {
      type: 'string',
      describe: 'Logical key identifier override (must match derived)',
    },
    store: {
      type: 'string',
      default: defaultStoreRoot(),
      describe: 'Keystore root directory',
    },
    label: {
      type: 'string',
      describe: 'Optional human-friendly label',
    },
    json: {
      type: 'boolean',
      default: false,
      describe: 'JSON output',
    },
  } as const,
  async handler(argv) {
    const opts: KeysGenerateOptions = {
      outDir: argv.store ?? defaultStoreRoot(),
      ...(typeof argv.label === 'string' ? { label: argv.label } : {}),
      ...(typeof argv.keyId === 'string' ? { keyId: argv.keyId } : {}),
      ...(argv.json ? { json: true } : {}),
    };
    const code = await runKeysGenerate(opts);
    (process as NodeJS.Process).exitCode = code;
  },
};

export default keysGenerateCmd;
