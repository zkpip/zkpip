// scripts/spec/validate-specs.ts
// ESM-only; strict TS; no "any". Validates schema + JCS hash/size + detached Ed25519 signature.

import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, webcrypto } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import type { AnySchema, ErrorObject } from 'ajv';
import { jcsCanonicalize, assertJson, loadJson, b64uToBytes } from './jcs.js';

type HashIndexEntry = { path: string; sha256: string; size: number };
type HashIndex = Record<string, HashIndexEntry>;
type VectorIdMap = Record<string, string>;

type Manifest = {
  version: '1';
  id: string;
  framework: string;
  proofSystem: 'groth16' | 'plonk';
  urls: readonly string[];
  sha256: string; // hex over JCS(verification.json) BYTES
  size: number; // length of JCS(verification.json) BYTES
  meta?: Record<string, string>;
  kid: string;
};

// --- Signature verification helpers ------------------------------------------

type Jwks = {
  readonly keys: readonly {
    readonly kty: 'OKP';
    readonly crv: 'Ed25519';
    readonly kid: string;
    readonly x: string; // base64url public key
  }[];
};

async function loadJwks(filePath: string): Promise<Map<string, string>> {
  const raw = await fs.readFile(filePath, 'utf8');
  const jwks = JSON.parse(raw) as Jwks;
  const map = new Map<string, string>();
  for (const k of jwks.keys) {
    if (k.kty === 'OKP' && k.crv === 'Ed25519' && k.kid && k.x) map.set(k.kid, k.x);
  }
  return map;
}

/** Minimal Ajv shape we rely on (structural typing). */
type ValidateFn = ((data: unknown) => boolean) & { errors?: ErrorObject[] };
interface AjvLike {
  addSchema: (schema: AnySchema | AnySchema[]) => AjvLike;
  getSchema: (idRef: string) => ValidateFn | undefined;
  addKeyword?: (def: unknown) => AjvLike;
  addFormat?: (name: string, format: unknown) => AjvLike;
}

// --- Byte-based hash helper (never hash strings here) ------------------------
function sha256HexBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

// --- Path sanitizers (defensive) ---------------------------------------------
function normalizeRelPath(rel: string): string {
  const trimmed = rel
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^\.\//, '');
  return path.normalize(trimmed);
}
function absFromRoot(root: string, rel: string): string {
  const norm = normalizeRelPath(rel);
  return path.isAbsolute(norm) ? norm : path.join(root, norm);
}

/** Type guard to ensure an unknown value behaves like Ajv. */
function isAjvLike(x: unknown): x is AjvLike {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return typeof o.addSchema === 'function' && typeof o.getSchema === 'function';
}

async function enableFormats(ajv: AjvLike): Promise<void> {
  try {
    const mod: unknown = await import('ajv-formats');
    const addFormats =
      (mod as { default?: (a: unknown) => unknown }).default ??
      (mod as unknown as (a: unknown) => unknown);
    addFormats(ajv as unknown);
  } catch {
    // Minimal fallback: accept http(s) and file: URIs
    ajv.addFormat?.('uri', {
      type: 'string',
      validate: (s: unknown) => typeof s === 'string' && /^(?:https?:|file:)[^\s]+$/u.test(s),
    });
  }
}

/** Robust Ajv loader: core factory → Ajv 2020 → base Ajv (draft-07). */
async function makeAjv(root: string): Promise<AjvLike> {
  const coreFactory = path.join(root, 'packages/core/src/validation/createAjvs.ts');
  try {
    const mod: unknown = await import(pathToFileURL(coreFactory).href);
    const createAjvs = (mod as { createAjvs?: () => { json: unknown } }).createAjvs;
    if (typeof createAjvs === 'function') {
      const { json } = createAjvs();
      if (isAjvLike(json)) return json;
    }
  } catch {
    /* fall through */
  }

  try {
    const mod2020: unknown = await import('ajv/dist/2020');
    const Ajv2020Ctor = (mod2020 as { default: new (opts: object) => unknown }).default;
    const inst = new Ajv2020Ctor({ allErrors: true, strict: true });
    if (isAjvLike(inst)) return inst;
  } catch {
    /* fall through */
  }

  const mod: unknown = await import('ajv');
  const AjvCtor = (mod as { default: new (opts: object) => unknown }).default;
  const inst = new AjvCtor({ allErrors: true, strict: true });
  if (isAjvLike(inst)) return inst;

  throw new Error('Failed to initialize an Ajv-like validator instance.');
}

async function listManifests(dir: string): Promise<string[]> {
  const ents = await fs.readdir(dir, { withFileTypes: true });
  const files = ents
    .filter((e) => e.isFile() && e.name.endsWith('.manifest.json'))
    .map((e) => path.join(dir, e.name));
  files.sort();
  return files;
}

function ok(msg: string): void {
  console.log(`✅ ${msg}`);
}
function warn(msg: string): void {
  console.warn(`⚠️  ${msg}`);
}
function fail(msg: string): void {
  console.error(`❌ ${msg}`);
}

async function main(): Promise<void> {
  // Optional args: --schemaDir --manifestDir --hashIndex --idMap
  const args = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i += 2) {
    const k = process.argv[i],
      v = process.argv[i + 1];
    if (!k || !v) break;
    args.set(k.replace(/^--/, ''), v);
  }

  const root = process.cwd();
  const schemaDir = args.get('schemaDir') ?? 'docs/spec';
  const manifestDir = args.get('manifestDir') ?? 'docs/spec/examples/canvectors';
  const hashIndexPath = args.get('hashIndex') ?? 'docs/spec/hash-index.json';
  const idMapPath = args.get('idMap') ?? 'docs/spec/examples/vector-id-map.json';

  const peSchemaPath = path.join(root, schemaDir, 'ProofEnvelope-v1.schema.json');
  const acSchemaPath = path.join(root, schemaDir, 'Adapter-Contract-v1.schema.json');
  const mfSchemaPath = path.join(root, schemaDir, 'CanVectors-Manifest-v1.schema.json');

  const ajv = await makeAjv(root);

  // Load JWKS (kid → x)
  const jwksPath = args.get('jwks') ?? path.join(root, 'docs/spec/keys.jwks');
  const pubKeyMap = await loadJwks(jwksPath);

  if (typeof ajv.addKeyword === 'function') {
    ajv.addKeyword({
      keyword: 'x-canonicalization',
      schemaType: 'string',
      validate: () => true, // non-evaluating, always valid
    });
  }
  await enableFormats(ajv);

  const pe = await loadJson<AnySchema>(peSchemaPath);
  const ac = await loadJson<AnySchema>(acSchemaPath);
  const mf = await loadJson<AnySchema>(mfSchemaPath);
  ajv.addSchema(pe).addSchema(ac).addSchema(mf);

  const validateManifest = ajv.getSchema('urn:zkpip:schemas:canvectors-manifest:v1');
  if (!validateManifest)
    throw new Error('Manifest schema not registered (urn:zkpip:schemas:canvectors-manifest:v1)');
  ok('Loaded Ajv (core or fallback) and registered schemas.');

  const idx = await loadJson<HashIndex>(path.join(root, hashIndexPath));
  const idMap = await loadJson<VectorIdMap>(path.join(root, idMapPath));
  ok(`Loaded hash-index (${Object.keys(idx).length}) and id-map (${Object.keys(idMap).length})`);

  const manifests = await listManifests(path.join(root, manifestDir));
  if (manifests.length === 0) {
    warn(`No manifests found in ${manifestDir}`);
    return;
  }

  console.log(`\n==> Validating ${manifests.length} manifest(s):\n`);
  let errors = 0;

  for (const mp of manifests) {
    const m = await loadJson<Manifest>(mp);

    // 1) Schema check
    const okSchema = validateManifest(m);
    if (!okSchema) {
      const errs = (validateManifest.errors ?? []) as ErrorObject[];
      fail(
        `${path.basename(mp)}: schema_invalid → ${errs.map((e) => `${e.instancePath} ${e.message}`).join(' | ')}`,
      );
      errors++;
      continue;
    }

    // 2) Presence in indexes
    if (!idx[m.id]) {
      fail(`${path.basename(mp)}: id not in hash-index → ${m.id}`);
      errors++;
      continue;
    }
    if (!idMap[m.id]) {
      fail(`${path.basename(mp)}: id not in vector-id-map → ${m.id}`);
      errors++;
      continue;
    }

    // 3) Recompute JCS hash/size over BYTES (must match make-manifests)
    const verRel = idMap[m.id];
    const verAbs = absFromRoot(root, verRel);

    try {
      const payloadUnknown = await loadJson(verAbs);
      assertJson(payloadUnknown, 'payload');

      const canonicalBytes = jcsCanonicalize(payloadUnknown);
      const digest = sha256HexBytes(canonicalBytes);
      const size = canonicalBytes.length;

      const baseName = path.basename(mp);
      let okLine = `${baseName}: schema_ok`;

      if (digest !== m.sha256) {
        fail(`${baseName}: hash_mismatch (manifest=${m.sha256} calc=${digest})`);
        errors++;
      } else {
        okLine += ' · hash_ok';
      }

      if (size !== m.size) {
        fail(`${baseName}: size_mismatch (manifest=${m.size} calc=${size})`);
        errors++;
      } else {
        okLine += ' · size_ok';
      }

      // 4) Detached Ed25519 signature over the *manifest* JCS BYTES
      let sigOk = false;
      try {
        const sigPath = mp.replace(/\.manifest\.json$/i, '.manifest.sig');
        const sigB64u = (await fs.readFile(sigPath, 'utf8')).trim();

        const kid = (m as { readonly kid?: string }).kid ?? '';
        const x = kid ? pubKeyMap.get(kid) : undefined;

        if (!sigB64u) {
          fail(`${baseName}: signature_missing`);
          errors++;
        } else if (!kid) {
          fail(`${baseName}: kid_missing`);
          errors++;
        } else if (!x) {
          fail(`${baseName}: kid_unknown`);
          errors++;
        } else {
          // Canonicalize the manifest object to BYTES (exactly like signer)
          const manifestObjUnknown = await loadJson(mp);
          assertJson(manifestObjUnknown, 'manifest');
          const msgBytes = jcsCanonicalize(manifestObjUnknown);

          const sigRaw = b64uToBytes(sigB64u); // version-proof decoder

          // Optional CI diagnostics
          if (process.env.CI) {
            const canonHashHex = createHash('sha256').update(msgBytes).digest('hex');
            console.error(
              `[SIG DEBUG] kid=${kid} sig.len=${sigRaw.length} canon.sha256=${canonHashHex}`,
            );
          }

          if (sigRaw.length !== 64) {
            fail(`${baseName}: signature_invalid`);
            errors++;
          } else {
            const jwk = { kty: 'OKP', crv: 'Ed25519', x, ext: true } as const;
            const key = await webcrypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, [
              'verify',
            ]);
            const ok = await webcrypto.subtle.verify({ name: 'Ed25519' }, key, sigRaw, msgBytes);
            if (ok) {
              okLine += ' · sig_ok';
              sigOk = true;
            } else {
              fail(`${baseName}: signature_invalid`);
              errors++;
            }
          }
        }
      } catch {
        fail(`${baseName}: signature_missing`);
        errors++;
      }

      // Print green line only if all passed
      if (digest === m.sha256 && size === m.size && sigOk) ok(okLine);
    } catch {
      fail(`${path.basename(mp)}: cannot read referenced file → ${verRel}`);
      errors++;
    }
  }

  console.log('\n==> Summary');
  if (errors > 0) {
    fail(`Validation finished with ${errors} error(s).`);
    process.exit(1);
  }
  ok('All manifests passed schema + hash + size + sig checks.');
}

await main();
