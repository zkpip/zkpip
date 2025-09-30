import { describe, it, expect } from 'vitest';
import type { ErrorObject } from 'ajv';
import { mapAjvSealErrors } from '../verify/ajvMap.js';

describe('mapAjvSealErrors', () => {
  it('missing signature -> SIGNATURE_BASE64_ERROR', () => {
    const errs: ErrorObject[] = [
      {
        instancePath: '/seal',
        schemaPath: '#/properties/seal/required',
        keyword: 'required',
        params: { missingProperty: 'signature' },
        message: "must have required property 'signature'",
      } as ErrorObject,
    ];
    expect(mapAjvSealErrors(errs)).toBe('SIGNATURE_BASE64_ERROR');
  });

  it('pattern on signature -> SIGNATURE_BASE64_ERROR', () => {
    const errs: ErrorObject[] = [
      {
        instancePath: '/seal/signature',
        schemaPath: '#/properties/seal/properties/signature/pattern',
        keyword: 'pattern',
        params: {},
        message: 'must match pattern',
      } as ErrorObject,
    ];
    expect(mapAjvSealErrors(errs)).toBe('SIGNATURE_BASE64_ERROR');
  });

  it('algo enum -> ALGO_UNSUPPORTED', () => {
    const errs: ErrorObject[] = [
      {
        instancePath: '/seal/algo',
        schemaPath: '#/properties/seal/properties/algo/enum',
        keyword: 'enum',
        params: { allowedValues: ['ed25519'] },
        message: 'must be equal to one of the allowed values',
      } as ErrorObject,
    ];
    expect(mapAjvSealErrors(errs)).toBe('ALGO_UNSUPPORTED');
  });

  it('fallback -> SCHEMA_INVALID', () => {
    const errs: ErrorObject[] = [
      {
        instancePath: '/seal/keyId',
        schemaPath: '#/properties/seal/properties/keyId/pattern',
        keyword: 'pattern',
        params: {},
        message: 'must match pattern',
      } as ErrorObject,
    ];
    expect(mapAjvSealErrors(errs)).toBe('SCHEMA_INVALID');
  });
});
