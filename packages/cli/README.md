# ZKPIP CLI

Zero-knowledge proof integration CLI (ESM, Node.js 22+).
Focus: **manifest canonicalization, signing, verification** + **developer keystore** + **trusted key policy** (M1).

## Quickstart

```bash
# Install (dev)
npm -w @zkpip/cli run build && npm -w @zkpip/cli link

# Generate a dev key (stored under ~/.zkpip/keys)
zkpip keys generate --alg ed25519 --key-id zkpip:dev:me --json

# Sign a manifest (no --priv; uses keystore by --key-id)
zkpip manifest sign \
  --in samples/demo.manifest.json \
  --out out/signed.json \
  --key-id zkpip:dev:me \
  --mkdirs \
  --json

# Trust set from keystore (helper)
npm -w @zkpip/cli run trust:init -- zkpip:dev:me

# Verify using only the trust set
zkpip manifest verify \
  --in out/signed.json \
  --trust-set trust/keys.json \
  --json --use-exit-codes
```

## Commands

```text
zkpip manifest <sign|verify>
zkpip keys <generate|list|show>
```

### `manifest sign`

* Inputs:

  * `--in <path>`: unsigned manifest JSON
  * `--out <path>`: output signed manifest JSON
  * `--key-id <id>`: embedded `signature.keyId`
  * `--priv <path>` *(optional)*: PKCS#8 private key; if omitted, keystore is used by `--key-id`
  * `--mkdirs` *(optional)*: create parent dir for `--out`
  * `--json` *(optional)*: structured output
* Output JSON:

  ```json
  { "ok": true, "alg": "Ed25519", "keyId": "<id>", "out": "<path>" }
  ```

### `manifest verify`

* Inputs:

  * `--in <path>`: signed manifest
  * `--pub <path>` *(optional)*: SPKI public key PEM
  * `--trust-set <path>` *(optional)*: JSON `{ keys: [{ keyId, publicPem | publicPemPath }] }`
  * `--use-exit-codes`: exit 0 on success, 1 on failure
  * `--json`: structured output
* Resolution:

  1. If `--pub` is present, verify with it **and still enforce** membership when `--trust-set` provided.
  2. Else if `--trust-set` is present, resolve public key by `signature.keyId`.
  3. Else → error (`io_error`: no public key provided).
* Output JSON:

  ```json
  { "ok": true, "reason": null }
  ```

  or on failure:

  ```json
  { "ok": false, "reason": "signature_invalid" }
  ```

### `keys generate`

* Creates Ed25519 keypair in **keystore** (default `~/.zkpip/keys/<slug>/private.pem|public.pem`).
* Permissions: private `0600`, public `0644`.
* Options: `--key-id <id>`, `--store <dir>`, `--overwrite`, `--json`.

### `keys list`

* Lists entries in `--store` (default keystore root).

### `keys show`

* Prints public key PEM for `--key-id` (plain PEM or with `--json` includes `publicPemPath`).

## Trusted key list (policy)

`trust/keys.json` format:

```json
{
  "keys": [
    { "keyId": "zkpip:dev:me", "publicPemPath": "keys/dev.pub" }
    // or:
    // { "keyId": "zkpip:dev:me", "publicPem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n" }
  ]
}
```

Helper to bootstrap from keystore:

```bash
npm -w @zkpip/cli run trust:init -- zkpip:dev:me
```

## Keystore metadata

Each key folder contains a `metadata.json` written on generation:

```json
{
  "keyId": "zkpip:dev:me",
  "alg": "ed25519",
  "createdAt": "2025-09-19T13:29:42.027Z"
}
```

* `keys list` surfaces the real `keyId` using this metadata (falls back to `(unknown)` if missing).
* `keys show --json` returns: `{ ok, keyId, alg, createdAt, publicPemPath, publicPem }`.

## Error reasons (stable, machine-readable) (stable, machine-readable)

* `signature_invalid` – signature does not match payload/public key
* `hash_mismatch` – payload modified after signing
* `untrusted_key` – `signature.keyId` not present in trust set
* `io_error` – file I/O or argument errors

With `--json` the CLI never prints stack traces; errors are returned as:

```json
{ "ok": false, "reason": "io_error", "message": "File not found: ..." }
```

## CI (M1)

* Conformance vectors (generated): `can/manifest/{valid,invalid}`
* GitHub Actions:

  * build core+cli
  * generate ephemeral Ed25519 (`keys/ci.key|ci.pub`)
  * `npm -w @zkpip/cli run can:gen && can:verify`
  * optional trust verify:

    ```bash
    echo '{ "keys":[{"keyId":"zkpip:ci","publicPemPath":"keys/ci.pub"}] }' > trust/keys.json
    node packages/cli/dist/index.js manifest verify \
      --in can/manifest/valid/ok.signed.json \
      --trust-set trust/keys.json \
      --json --use-exit-codes
    ```

## Tests & coverage (dev)

```bash
# run all tests
npm -w @zkpip/cli exec vitest run

# run with coverage (preferred via script)
npm -w @zkpip/cli run test:cov
```

Vitest config should include both patterns:

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.{test,spec}.ts']
  }
})
```

## Batch verification & sealing (design preview)

> This feature is planned for Display/Light plans. Single verification stays **free** for the 4 basic bridges; batch = **one bundle seal** via API.

### CLI shape (draft)

```bash
# discover files under a directory and verify via API as one batch (bundle seal)
zkpip verify-batch \
  --dir proofs/ \
  --pattern "**/*.json" \
  --bridge snarkjs-plonk \
  --trust-set trust/keys.json \
  --envelope-name "shopify-checkout-2025-09-19" \
  --out reports/batch-report.ndjson \
  --concurrency 8 \
  --keep-going \
  --json
```

**Flags (proposed):**

* `--dir <folder>`: root to scan; combine with `--pattern` & `--exclude`.
* `--pattern <glob>` (repeatable): file glob(s), default `**/*`.
* `--exclude <glob>` (repeatable).
* `--bridge <id>`: proof-bridge to interpret files; per-bridge defaults for expected shapes.
* `--trust-set <path>`: optional trust enforcement.
* `--api-key <key>` / `--endpoint <url>`: override config (see below).
* `--envelope-name <name>`: human label for the batch; used by SealScan.
* `--out <path>`: write NDJSON with per-file results + a final summary line.
* `--concurrency <n>`: local parallelism (upload/verify windowing).
* `--keep-going` / `--fail-fast` (default: keep-going).
* `--dry-run`: list what would be sent; no network.
* `--mkdirs`: create parent dirs for `--out`.

**Output contract:**

* NDJSON lines for each processed file:

  ```json
  { "file":"proofs/a.json", "ok":true, "bridgeId":"snarkjs-plonk", "reason":null, "sealId":"..." }
  { "file":"proofs/b.json", "ok":false, "reason":"invalid_envelope_content", "message":"..." }
  ...
  { "summary": { "total": 100, "ok": 98, "failed": 2, "bundleSealId": "..." } }
  ```
* Non-matching/unsupported files are emitted with `reason:"unsupported_format"` and skipped.

### API (draft)

* `POST /v1/batches` → `{ batchId, uploadUrls[] }`
* `PUT <uploadUrl>` per file (signed URL), or `POST /v1/batches/:id/files` with body
* `POST /v1/batches/:id/verify` → starts verification + bundle seal
* `GET /v1/batches/:id` → status + results (streamable NDJSON)

**Config file:** `~/.zkpip/config.json`

```json
{
  "endpoint": "https://api.zkpip.io",
  "apiKey": "<secret>",
  "orgName": "Imagella LLC",       // optional: shown on SealScan if Display plan enabled
  "telemetry": true                  // opt-in usage metrics
}
```

**DX guarantees:**

* Resumable: `--resume <batchId>` to continue failed uploads.
* Idempotent: re-running with same `--envelope-name` deduplicates.
* Rate limits surfaced in CLI with backoff; `429` handled automatically.
* Privacy: file paths hashed in telemetry; content never logged client-side.

**Pricing rule (high level):**

* Local single verifies (CPU-only) remain free for 4 basic bridges.
* Batch uses API → 1 **bundle seal** per batch (counts toward plan).
* SealScan shows bundle page with optional org/dev name (from config).

---

## Security notes

* Never commit private keys. Keystore private files use `0600`.

* For production, plan to switch to **KMS signer** (AWS KMS integration, M1/B).

* Never commit private keys. Keystore private files use `0600`.

* For production, plan to switch to **KMS signer** (AWS KMS integration, M1/B).
