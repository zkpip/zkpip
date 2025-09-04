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

  export const groth16: {
    verify: (
      vkey: VerificationKey,
      publicSignals: ReadonlyArray<PublicSignal>,
      proof: Groth16Proof,
    ) => Promise<boolean>;
  };

  const _default: {
    groth16: typeof groth16;
  };

  export default _default;
}
