// ESM, strict TS, no "any".
import { describe, it, expect, vi } from 'vitest';
import { runForgeCli, printForgeHelp } from '../forge-cli.js';

describe('forge help (unit)', () => {
  it('prints help with epilogue via --help', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => { /* swallow */ });

    await runForgeCli(['--help']);

    expect(spy).toHaveBeenCalledTimes(1);
    const out = String(spy.mock.calls[0]?.[0] ?? '');
    expect(out).toContain('zkpip forge'); 
    expect(out).toContain('Options:');
    expect(out).toContain('Error codes:');           // from epilogue
    expect(out).toContain('ZKPIP_HARD_EXIT=1');      // from epilogue

    spy.mockRestore();
  });

  it('prints help directly via printForgeHelp', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printForgeHelp();
    const out = String(spy.mock.calls[0]?.[0] ?? '');
    expect(out).toContain('zkpip forge');
    expect(out).toContain('Error codes:');
    spy.mockRestore();
  });
});
