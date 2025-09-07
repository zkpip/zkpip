// Minimal ambient types for 'zokrates-js' to keep our code any-less.
//
// The real lib exposes `initialize()` that returns a provider with methods
// like compile, computeWitness, generateProof, verify, etc.
declare module "zokrates-js" {
  export type ZoKratesProvider = {
    // ZoKrates proof verification: returns boolean (or Promise<boolean>)
    verify: (vkey: unknown, proof: unknown, inputs: string[]) => boolean | Promise<boolean>;
  };

  export function initialize(): Promise<ZoKratesProvider>;
}
