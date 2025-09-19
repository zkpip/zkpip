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

## Error reasons (stable, machine-readable)

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

## Security notes

* Never commit private keys. Keystore private files use `0600`.
* For production, plan to switch to **KMS signer** (AWS KMS integration, M1/B).
