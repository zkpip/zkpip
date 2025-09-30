# ZKPIP CLI

Zero-knowledge proof integration CLI (ESM, Node.js 22+).
Focus: **manifest canonicalization, signing, verification** + **developer keystore** + **trusted key policy** (M1), and proof vectors tooling.

> _All docs and code comments are in English (OSS)._

## Quickstart

```bash
# Install (dev)
npm -w @zkpip/cli run build && npm -w @zkpip/cli link

# Generate a dev key (stored under ~/.zkpip/keys)
zkpip keys generate --alg ed25519 --key-id zkpip:dev:me --json

# Sign a manifest (no --priv; uses keystore by --key-id)
zkpip manifest sign   --in samples/demo.manifest.json   --out out/signed.json   --key-id zkpip:dev:me   --mkdirs   --json

# Trust set from keystore (helper)
npm -w @zkpip/cli run trust:init -- zkpip:dev:me

# Verify using only the trust set
zkpip manifest verify   --in out/signed.json   --trust-set trust/keys.json   --json --use-exit-codes
```

---

## Top-level help

```bash
zkpip --help
zkpip help <command>
```

The help output ends with an **Error codes** epilogue (see also table below).

## Commands

```text
zkpip manifest <sign|verify>
zkpip keys <generate|list|show>
zkpip forge
zkpip verify
zkpip vectors <pull|sign|verify-seal|push>     # sign/verify-seal/push are experimental
```

---

## `manifest sign`

**Inputs**

- `--in <path>`: unsigned manifest JSON
- `--out <path>`: output signed manifest JSON
- `--key-id <id>`: embedded `signature.keyId`
- `--priv <path>` _(optional)_: PKCS#8 private key; if omitted, keystore is used by `--key-id`
- `--mkdirs` _(optional)_: create parent dir for `--out`
- `--json` _(optional)_: structured output

**Output JSON**

```json
{ "ok": true, "alg": "Ed25519", "keyId": "<id>", "out": "<path>" }
```

## `manifest verify`

**Inputs**

- `--in <path>`: signed manifest
- `--pub <path>` _(optional)_: SPKI public key PEM
- `--trust-set <path>` _(optional)_: JSON `{ "keys": [{ "keyId": "...", "publicPem" | "publicPemPath": "..." }] }`
- `--use-exit-codes`: exit 0 on success, 1 on failure
- `--json`: structured output

**Resolution**

1. If `--pub` is present, verify with it **and still enforce** membership when `--trust-set` provided.
2. Else if `--trust-set` is present, resolve public key by `signature.keyId`.
3. Else → error (`io_error`: no public key provided).

**Output JSON**

```json
{ "ok": true, "reason": null }
```

On failure:

```json
{ "ok": false, "reason": "signature_invalid" }
```

---

## `keys generate`

Creates Ed25519 keypair in **keystore** (default `~/.zkpip/keys/<slug>/private.pem|public.pem`).

- Permissions: private `0600`, public `0644`.
- Options: `--key-id <id>`, `--store <dir>`, `--overwrite`, `--json`.

## `keys list`

Lists entries in `--store` (default keystore root).

## `keys show`

Prints public key PEM for `--key-id` (plain PEM or with `--json` includes `publicPemPath`).

---

## `forge`

Generate a **ProofEnvelope** from adapter input triplets.

**Inputs**

- `--input <path>`: input JSON path (adapter-specific input or prepared object)
- `--out <path>`: output path for the envelope JSON
- `--adapter <id>`: one of `snarkjs-groth16 | snarkjs-plonk | zokrates-groth16`
- `--dry-run` _(optional)_: print to stdout only, **no file writes**
- `--strict` _(optional)_: treat suspicious fields as **errors** (forbid `$schema`, `$id`, artifact paths/URIs)
- `--seed 0x...` _(optional)_: hex seed for deterministic `envelopeId` in tests

**Output JSON (envelope shape)**

> Stable canonical fields; dynamic `envelopeId` unless `--seed` is provided.

```json
{
  "envelopeId": "env_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "protocol": "groth16",
  "curve": "bn128",
  "adapter": "snarkjs-groth16",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "input": { /* adapter input object */ }
}
```

**Exit codes**

- `0` – success
- `1` – error (respecting `ZKPIP_HARD_EXIT`, see below)

---

## `verify`

Verify a **ProofEnvelope** or a verification JSON input.

**Inputs**

- `--verification <path>|-`: verification JSON (or `-` for stdin); may contain/point to a ProofEnvelope
- `--adapter <id>` _(optional)_: enforce/override adapter
- `--dump-normalized <path>` _(optional)_: write adapter-normalized bundle for debugging
- `--use-exit-codes`: exit 0 on success, non-zero on failure
- `--json`: structured result

**Output JSON**

```json
{ "ok": true, "adapter": "snarkjs-groth16" }
```

On failure:

```json
{ "ok": false, "code": "schema_invalid", "message": "verification_key.IC missing" }
```

---

## Keys

Generate an Ed25519 keypair and register it in the keystore.

```sh
zkpip keys generate --store <dir> [--label <txt>] [--keyId <kid>] [--json]

---

## `vectors pull` (POC)

Fetch canonical vectors or any JSON from URL / file / data URI with safe defaults.

**Inputs**

- `--url <url>`: source (`https://`, `http://`, `file://`, `data:`)
- `--out-dir <dir>`: directory to write the fetched file (filename is derived)
- `--allow-http` _(optional)_: allow **plain HTTP** (defaults to blocked)
- `--max-mb <n>` _(optional)_: max allowed payload size (default: `5` MB)
- `--timeout-ms <n>` _(optional)_: read timeout (default: `15000`)

**Examples**

```bash
# Deterministic test (no network)
zkpip vectors pull --url "data:application/json,%7B%22hello%22%3A%22world%22%7D" --out-dir /tmp

# From file:// (absolute path only; traversal is blocked)
zkpip vectors pull --url file:///home/me/proof.json --out-dir /tmp

# Allow HTTP explicitly
zkpip vectors pull --url http://example.com/data.json --out-dir /tmp --allow-http
```

The command prints the saved file path to stdout.

On error it exits non‑zero and prints a machine‑readable JSON error to stderr.

---

## Experimental (dev-seal) — `vectors sign` / `vectors verify-seal`

> Preview: local Ed25519 “dev-seal” (key in `./.zkpip/key`). Subject to change.

- `zkpip vectors sign --in <canonical.json> --out <vector+seal.json>`
- `zkpip vectors verify-seal --in <vector+seal.json>`

Vector ID is derived as `urn:zkpip:vector:sha256:<hex>` from canonical hash; seal metadata contains signer and timestamp.

---

## Experimental (dev) — `vectors push`

> Preview: disk backend with S3-compatible interface (to be replaced by AWS S3/KMS).

- `zkpip vectors push --id <urn> --in <file> [--out-dir .zkpip/vectors]`

---

## Trusted key list (policy)

`trust/keys.json` format:

```json
{
  "keys": [
    { "keyId": "zkpip:dev:me", "publicPemPath": "keys/dev.pub" }
  ]
}
```

Helper to bootstrap from keystore:

```bash
npm -w @zkpip/cli run trust:init -- zkpip:dev:me
```

---

## Keystore metadata

Each key folder contains a `metadata.json` written on generation:

```json
{
  "keyId": "zkpip:dev:me",
  "alg": "ed25519",
  "createdAt": "2025-09-19T13:29:42.027Z"
}
```

- `keys list` surfaces the real `keyId` using this metadata (falls back to `(unknown)` if missing).
- `keys show --json` returns: `{ "ok": true, "keyId": "...", "alg": "Ed25519", "createdAt": "...", "publicPemPath": "...", "publicPem": "..." }`.

---

### Guard error codes (as shown in CLI help epilogue)

These are low-level guard errors surfaced by `vectors pull` and path/transport validation.  
They may map to the machine-readable error field shown above.

| CLI epilogue code         | Meaning                                  | Maps to `error` (if emitted)     |
|---------------------------|------------------------------------------|----------------------------------|
| `ZK_CLI_ERR_FILE_HOST`    | `file://` must not include a host        | `http_blocked` (context-dependent) |
| `ZK_CLI_ERR_FILE_RELATIVE`| `file://` must use an absolute path      | `io_error` (path misuse)         |
| `ZK_CLI_ERR_PATH_TRAVERSAL`| Dot-segment traversal is not allowed     | `io_error`                        |
| `ZK_CLI_ERR_HTTP_DISABLED`| `http://` blocked without `--allow-http` | `http_blocked`                   |
| `ZK_CLI_ERR_MAX_MB`       | Download exceeds size limit              | `size_limit_exceeded`            |
| `ZK_CLI_ERR_TIMEOUT`      | Read timeout exceeded                    | `timeout`                        |
| `ZK_CLI_ERR_STRICT_FIELDS`| Disallowed fields in `--strict` mode     | `strict_violation`               |
| `ZK_CLI_ERR_PROTOCOL`     | Unsupported source protocol              | `io_error`                       |

> Note: the CLI always prints the **machine-readable** `error`/`stage` in JSON mode for `verify` (e.g. `io_error`, `schema_invalid`, `verify_error`). Guard codes above appear in the help epilogue and stderr logs to aid debugging.

**Environment**

- `ZKPIP_HARD_EXIT=1` → hard exit (`process.exit(1)`), otherwise **soft**: set `process.exitCode = 1` and throw.

---

## CI (M1)

- Conformance vectors (generated): `can/manifest/{valid,invalid}`
- GitHub Actions highlights:
  - build core + cli
  - generate ephemeral Ed25519 (`keys/ci.key|ci.pub`)
  - `npm -w @zkpip/cli run can:gen && can:verify`
  - optional trust verify:

    ```bash
    echo '{ "keys":[{"keyId":"zkpip:ci","publicPemPath":"keys/ci.pub"}] }' > trust/keys.json
    node packages/cli/dist/index.js manifest verify       --in can/manifest/valid/ok.signed.json       --trust-set trust/keys.json       --json --use-exit-codes
    ```

---

## Tests & coverage (dev)

```bash
# run all tests
npm -w @zkpip/cli exec vitest run

# run with coverage (preferred via script)
npm -w @zkpip/cli run test:cov
```

Vitest config should include:

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.{test,spec}.ts']
  }
})
```

---

## Batch verification & sealing (design preview)

> Planned. Single-file local verification remains free for the 4 basic bridges; batch uses API and yields **one bundle seal** per batch.

```bash
zkpip verify-batch   --dir proofs/   --pattern "**/*.json"   --bridge snarkjs-plonk   --trust-set trust/keys.json   --envelope-name "shopify-checkout-2025-09-19"   --out reports/batch-report.ndjson   --concurrency 8   --keep-going   --json
```

(See original README for full draft.)

---

## Security notes

- Never commit private keys. Keystore private files use `0600`.
- For production, plan to switch to **KMS signer** (AWS KMS integration, M1/B).
