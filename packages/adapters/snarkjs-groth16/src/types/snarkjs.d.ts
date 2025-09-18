// Minimal type shim for snarkjs we actually use in this adapter.
// Keep it narrow; extend only if needed.

declare module 'snarkjs' {
  export const groth16: {
    verify(
      vkey: import('@zkpip/adapters-core').JsonValue,
      publicSignals: readonly import('@zkpip/adapters-core').PublicValue[],
      proof: import('@zkpip/adapters-core').JsonValue,
    ): Promise<boolean>;
  };
}
