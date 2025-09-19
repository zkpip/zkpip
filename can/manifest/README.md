# Manifest conformance vectors (generated)

These fixtures are generated at runtime (locally/CI) using ephemeral Ed25519 keys.
We do not commit any signed artifacts here.

- `valid/ok.signed.json`: signed from `samples/demo.manifest.json`
- `invalid/signature_invalid.json`: signature mutated
- `invalid/hash_mismatch.json`: payload modified after signing
- `invalid/missing_signature.json`: signature removed

Use `npm -w @zkpip/cli run can:gen` to generate, and `npm -w @zkpip/cli run can:verify` to check.
