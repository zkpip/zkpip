// packages/core/src/verify/types.ts
export type PublicKeyProvider =
  (keyId: string) => string | null | undefined;

export type VerifySealOptions = Readonly<{
  getPublicKey?: PublicKeyProvider;
}>;