// zkpip/packages/cli/src/types/snarkjs.d.ts

declare module 'snarkjs' {
  export type VerificationKey = Record<string, unknown>;

  export type PublicSignal = string | number | bigint;

  export type Groth16Proof = Record<string, unknown> & {
    pi_a?: readonly [string | bigint, string | bigint];
    pi_b?: readonly [
      readonly [string | bigint, string | bigint],
      readonly [string | bigint, string | bigint],
    ];
    pi_c?: readonly [string | bigint, string | bigint];
    protocol?: 'groth16';
    curve?: string;
  };

  export namespace groth16 {
    function verify(
      vkey: unknown,
      publicSignals: ReadonlyArray<string | number | bigint>,
      proof: unknown,
    ): Promise<boolean>;
  }

  export namespace plonk {
    function verify(
      vkey: unknown,
      publicSignals: ReadonlyArray<string | number | bigint>,
      proof: unknown,
    ): Promise<boolean>;
  }  

  const _default: { groth16: typeof groth16; plonk: typeof plonk };
  export default _default;
  export { groth16, plonk };
}
