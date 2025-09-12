#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * - yargs runtime from 'yargs/yargs'
 * - JSON mode: suppress non-JSON noise on STDOUT/STDERR
 * - Last-resort guards → single-line JSON on STDERR
 * - adapters command regisztrálva
 * - lazy verify command
 * - .exitProcess(false) + egyetlen exit
 */

import yargsRuntime from 'yargs/yargs';
import type { CommandModule, Argv } from 'yargs';
import { writeJsonStderr } from './utils/ioJson.js';
import { mapVerifyOutcomeToExitCode } from './utils/exitCodeMap.js';
import type { VerifyHandlerArgs } from './types/cli.js';

type AnyCmd = CommandModule<Record<string, unknown>, unknown>;

function wantsJson(argv: readonly string[]): boolean {
  return argv.some((a) => a === '--json' || a.startsWith('--json=') || a === '-j');
}

type WriteFn = (
  chunk: string | Uint8Array,
  encoding?: BufferEncoding,
  cb?: (err?: Error | null) => void,
) => boolean;

function jsonOnlyWriter(orig: WriteFn): WriteFn {
  return (chunk, encOrCb?, cb?) => {
    let encoding: BufferEncoding | undefined;
    let callback: ((err?: Error | null) => void) | undefined;
    if (typeof encOrCb === 'function') {
      callback = encOrCb;
    } else {
      encoding = encOrCb;
      callback = cb;
    }
    let str = '';
    try {
      str = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString(encoding ?? 'utf8');
    } catch {
      /* no need to do */
    }
    if (str.trimStart().startsWith('{') || str.trimStart().startsWith('['))
      return orig(chunk, encoding, callback);
    if (callback) callback();
    return true;
  };
}

async function main(): Promise<void> {
  const raw = process.argv.slice(2);
  const jsonWanted = wantsJson(raw);

  // JSON mód: némíts minden nem-JSON zajt
  if (jsonWanted) {
    process.env.NODE_NO_WARNINGS = '1';
    try {
      (process as unknown as { emitWarning: (...a: unknown[]) => void }).emitWarning = () => {};
    } catch {
      /* no need to do */
    }
    const noop = () => {};
    console.log = noop;
    console.warn = noop;
    console.error = noop;
    (process.stdout as unknown as { write: WriteFn }).write = jsonOnlyWriter(
      process.stdout.write.bind(process.stdout) as WriteFn,
    );
    (process.stderr as unknown as { write: WriteFn }).write = jsonOnlyWriter(
      process.stderr.write.bind(process.stderr) as WriteFn,
    );
  }

  // Last-resort guardok
  let fatalHandled = false;
  const emitFatal = (message: string) => {
    if (fatalHandled) return;
    fatalHandled = true;
    const out = {
      ok: false as const,
      stage: 'cli' as const,
      error: 'adapter_error' as const,
      message,
    };
    if (jsonWanted) writeJsonStderr(out);
    else console.error(message);
    if (typeof process.exitCode !== 'number') process.exitCode = mapVerifyOutcomeToExitCode(out); // -> 1
  };
  process.on('uncaughtException', (e) => emitFatal((e as Error)?.message ?? String(e)));
  process.on('unhandledRejection', (e) => emitFatal((e as Error)?.message ?? String(e)));

  // adapters parancs dinamikusan (guardok után)
  const { adaptersCmd } = await import('./commands/adapters.js');

  // lazy verify parancs (nincs strict/check; minden a verify.ts-ben validálódik)
  const verifyLazyCmd: CommandModule<Record<string, unknown>, unknown> = {
    command: 'verify',
    describe: 'Verify a proof bundle or a verification JSON input',
    builder: (yy) =>
      yy
        .option('verification', {
          type: 'string',
          alias: ['bundle'],
          describe: 'Path or inline JSON',
        })
        .option('adapter', { type: 'string', describe: 'Adapter id (e.g. snarkjs-plonk)' })
        .option('list-adapters', {
          type: 'boolean',
          default: false,
          describe: 'List adapters and exit',
        })
        .option('json', { type: 'boolean', default: false, describe: 'Emit machine-readable JSON' })
        .option('use-exit-codes', { type: 'boolean', alias: ['exit-codes'], default: false })
        .option('useExitCodes', { type: 'boolean', default: false, hidden: true })
        .option('exitCodes', { type: 'boolean', default: false, hidden: true })
        .option('schema', { type: 'boolean', default: true })
        .option('no-schema', { type: 'boolean', default: false })
        .option('skip-schema', { type: 'boolean', default: false })
        .option('dump-normalized', { type: 'string' })
        .option('no-dump-normalized', { type: 'boolean', default: false })
        .parserConfiguration({ 'camel-case-expansion': true }),
    handler: async (argv) => {
      try {
        if (argv['list-adapters'] === true) {
          await (adaptersCmd.handler as (a: unknown) => Promise<void> | void)({
            json: argv.json === true,
          });
          if (argv['use-exit-codes'] || argv['exit-codes'] || argv.useExitCodes || argv.exitCodes) {
            if (typeof process.exitCode !== 'number') process.exitCode = 0;
          }
          return;
        }

        if (argv['no-dump-normalized'] === true) {
          delete process.env.ZKPIP_DUMP_NORMALIZED;
        } else {
          const rawDump = argv['dump-normalized'];
          if (typeof rawDump === 'string' && rawDump.trim()) {
            const { resolve } = await import('node:path');
            process.env.ZKPIP_DUMP_NORMALIZED = resolve(process.cwd(), rawDump.trim());
          }
        }

        const mod = (await import('./commands/verify.js')) as {
          handler: (a: VerifyHandlerArgs) => Promise<void> | void;
        };

        const useExitCodes =
          argv['use-exit-codes'] === true ||
          argv['exit-codes'] === true ||
          argv.useExitCodes === true ||
          argv.exitCodes === true;

        const noSchema =
          argv.schema === false ||
          (argv['no-schema'] as boolean) === true ||
          (argv['skip-schema'] as boolean) === true;

        const args: VerifyHandlerArgs = {
          json: argv.json === true,
          useExitCodes,
          noSchema,
          ...(typeof argv.adapter === 'string' && argv.adapter ? { adapter: argv.adapter } : {}),
          ...(typeof argv.verification === 'string' && argv.verification
            ? { verification: argv.verification }
            : {}),
        };

        await mod.handler(args);
      } catch (e) {
        const msg = (e as Error)?.message ?? String(e);
        const out = {
          ok: false as const,
          stage: 'cli' as const,
          error: 'adapter_error' as const,
          message: msg,
        };
        if (argv.json) writeJsonStderr(out);
        else console.error(msg);
        if (argv['use-exit-codes'] || argv['exit-codes'] || argv.useExitCodes || argv.exitCodes) {
          if (typeof process.exitCode !== 'number') process.exitCode = 1;
        }
      }
    },
  };

  const y = yargsRuntime(raw) as unknown as Argv<unknown>;

  await y
    .scriptName('zkpip')
    .strict(false)
    .exitProcess(false)
    .fail((msg, err) => {
      // NE írd felül, ha már van numerikus kód (pl. verify success → 0)
      if (typeof process.exitCode === 'number') return;
      const out = {
        ok: false as const,
        stage: 'cli' as const,
        error: 'adapter_error' as const,
        message: err?.message ?? msg ?? 'CLI error',
      };
      if (jsonWanted) writeJsonStderr(out);
      else console.error(out.message);
      process.exitCode = mapVerifyOutcomeToExitCode(out); // -> 1
    })
    .command(adaptersCmd as unknown as AnyCmd)
    .command(verifyLazyCmd as unknown as AnyCmd)
    .parseAsync();

  process.exit(typeof process.exitCode === 'number' ? process.exitCode : 0);
}

await main();
