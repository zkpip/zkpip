// src/__tests__/adapters.contract.test.ts

import { vi } from 'vitest';

type VerifyFn = (
  vkey: object,
  publics: readonly string[],
  proof: object | string,
) => Promise<boolean>;
const isDec = (s: string): boolean => /^[0-9]+$/.test(s);

vi.mock('../adapters/snarkjsRuntime.js', () => {
  const plonk: VerifyFn = async (_vk, publics) => publics.every(isDec);
  const g16: VerifyFn = async (_vk, publics) => publics.every(isDec);
  return {
    getPlonkVerify: async (): Promise<VerifyFn> => plonk,
    getGroth16Verify: async (): Promise<VerifyFn> => g16,
  };
});

import { defineAdapterContractSuite } from './helpers/defineAdapterSuite.js';
import { LocalFsProvider } from './helpers/canvectors.local.js';

import { verify as plonkVerify } from '../adapters/snarkjs-plonk.js';
import { verify as g16Verify } from '../adapters/snarkjs-groth16.js';

// import { HttpProvider } from './helpers/canvectors.http.js';

// Named adapter imports (lint clean)

const local = new LocalFsProvider();
// const maybeHttp = new HttpProvider(); // only used if CANVECTORS_ONLINE=1

defineAdapterContractSuite(
  'PLONK via CanVectors (local fixtures)',
  { verify: plonkVerify },
  local,
  [
    { id: 'can:snarkjs:plonk:demo:valid', expectOk: true },
    { id: 'can:snarkjs:plonk:demo:invalid', expectOk: false },
  ],
);

// Optional online suite (skippeld a futtatást CI-ben, ha nincs online)
if (process.env.CANVECTORS_ONLINE === '1') {
  defineAdapterContractSuite(
    'Groth16 via CanVectors (local fixtures)',
    { verify: g16Verify },
    local,
    [
      // only if we already have corresponding fixtures:
      // { id: 'can:snarkjs:groth16:demo:valid', expectOk: true },
      // { id: 'can:snarkjs:groth16:demo:invalid', expectOk: false },
    ],
  );
}
