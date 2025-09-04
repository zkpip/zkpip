import AjvImport from 'ajv';
import addFormats from 'ajv-formats';

// Golyóálló ESM/CJS interop: mindig konstruálható osztályt kapunk
type AjvCtor = new (opts?: any) => import('ajv').default;
const AjvClass: AjvCtor = (AjvImport as any).default ?? (AjvImport as any);

export function createAjv() {
  const ajv = new AjvClass({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
    // Ne kérjen meta-séma ellenőrzést (2020-12), így nem kell meta import
    validateSchema: false,
  });

  // ajv-formats default export interop biztosan hívható
  (addFormats as any)(ajv);
  return ajv as import('ajv').default;
}
