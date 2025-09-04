// packages/core/src/types/ajv-formats.d.ts
declare module 'ajv-formats' {
  type Ajv = import('ajv').default;

  const addFormats: (ajv: Ajv, opts?: unknown) => unknown;
  export default addFormats;
}
