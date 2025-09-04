declare module 'snarkjs' {
  export const groth16: {
    verify: (vkey: any, publicSignals: any[], proof: any) => Promise<boolean>;
  };

  const _default: {
    groth16: typeof groth16;
  };

  export default _default;
}
