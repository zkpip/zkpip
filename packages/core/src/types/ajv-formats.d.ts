declare module 'ajv-formats' {
  import type Ajv from 'ajv';
  const addFormats: (ajv: Ajv, opts?: unknown) => unknown;
  export default addFormats;
}
