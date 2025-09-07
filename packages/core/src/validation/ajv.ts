import AjvDefault, { type Options as AjvOptions } from "ajv";
import addFormats from "ajv-formats";
import type { AjvLike } from "./ajv-types.js";

export function createAjv(): AjvLike {
  const AjvCtor: new (opts?: AjvOptions) => any = AjvDefault as unknown as new (opts?: AjvOptions) => any;

  const core = new AjvCtor({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
    validateSchema: false,
  });

  addFormats(core);

  const wrapped: AjvLike = {
    addFormat: core.addFormat.bind(core),
    addSchema: core.addSchema.bind(core),
    getSchema: core.getSchema.bind(core),
    compile: core.compile.bind(core),
    validate: core.validate.bind(core),
    get errors() {
      return core.errors ?? null;
    },
  };
  return wrapped;
}
