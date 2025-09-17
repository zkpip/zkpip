// ESM-only; no "any"; English comments
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, webcrypto } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import type { AnySchema, ErrorObject } from 'ajv';

type HashIndexEntry = { path: string; sha256: string; size: number };
type HashIndex = Record<string, HashIndexEntry>;
type VectorIdMap = Record<string, string>;

type Manifest = {
  version: '1';
  id: string;
  framework: string;
  proofSystem: 'groth16' | 'plonk';
  urls: readonly string[];
  sha256: string;
  size: number;
  meta?: Record<string, string>;
  kid: string;
};

// --- Signature verification helpers

type Jwks = {
  readonly keys: readonly {
    readonly kty: 'OKP';
    readonly crv: 'Ed25519';
    readonly kid: string;
    readonly x: string;
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

// --- Hash helper --------------------------------------------------------------
function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

// --- Path sanitizers (defensive) ----------------------------------------------
function normalizeRelPath(rel: string): string {
  // Trim whitespace/CRLF/BOM, drop leading "./", collapse segments
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
    // Prefer official plugin
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
  // 1) Try repo's core Ajv factory
  const coreFactory = path.join(root, 'packages/core/src/validation/createAjvs.ts');
  try {
    const mod: unknown = await import(pathToFileURL(coreFactory).href);
    const createAjvs = (mod as { createAjvs?: () => { json: unknown } }).createAjvs;
    if (typeof createAjvs === 'function') {
      const { json } = createAjvs();
      if (isAjvLike(json)) return json;
    }
  } catch {
    /* ignore; fallback below */
  }

  // 2) Try Ajv 2020 dialect
  try {
    const mod2020: unknown = await import('ajv/dist/2020');
    const Ajv2020Ctor = (mod2020 as { default: new (opts: object) => unknown }).default;
    const inst = new Ajv2020Ctor({ allErrors: true, strict: true });
    if (isAjvLike(inst)) return inst;
  } catch {
    /* ignore; fallback below */
  }

  // 3) Base Ajv (draft-07 default)
  const mod: unknown = await import('ajv');
  const AjvCtor = (mod as { default: new (opts: object) => unknown }).default;
  const inst = new AjvCtor({ allErrors: true, strict: true });
  if (isAjvLike(inst)) return inst;

  throw new Error('Failed to initialize an Ajv-like validator instance.');
}

// Minimal RFC8785-like canonicalization (identical to validator)
function jcsCanonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${(value as unknown[]).map(jcsCanonicalize).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const entries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
    const inner = entries.map(([k, v]) => `${JSON.stringify(k)}:${jcsCanonicalize(v)}`).join(',');
    return `{${inner}}`;
  }
  return JSON.stringify(value);
}

async function loadJson<T = unknown>(p: string): Promise<T> {
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(raw) as T;
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

  // Loading JWKS
  const pubKeyMap = await loadJwks('docs/spec/keys.jwks');

  if (typeof ajv.addKeyword === 'function') {
    ajv.addKeyword({
      keyword: 'x-canonicalization',
      schemaType: 'string',
      // Non-evaluating, always-valid keyword; keeps strict mode happy
      validate: () => true,
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

    // 2) Existence in indexes
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

    // 3) Recompute JCS hash/size
    const verRel = idMap[m.id];
    const verAbs = absFromRoot(root, verRel);
    try {
      // 1) verify referenced verification.json (hash + size)
      const payload = await loadJson(verAbs);
      const canonical = jcsCanonicalize(payload);
      const digest = sha256Hex(canonical);
      const size = Buffer.byteLength(canonical, 'utf8');

      let okLine = `${path.basename(mp)}: schema_ok`;
      const baseName = path.basename(mp);

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

      // 2) detached Ed25519 signature over the *manifest* (JCS string of manifest JSON)
      //    - manifest.sig must exist
      //    - kid must resolve to x in JWKS map (pubKeyMap loaded earlier)
      //    - verify detached signature
      let sigOk = false;
      try {
        // 1) .sig reading (trim), path from manifest
        const sigPath: string = mp.replace(/\.manifest\.json$/i, '.manifest.sig');
        const sigB64u: string = (await fs.readFile(sigPath, 'utf8')).trim();

        const kid: string = (m as { readonly kid?: string }).kid ?? '';
        const x: string | undefined = kid ? pubKeyMap.get(kid) : undefined;

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
          // 2) canonize with the signer
          const manifestObj = await loadJson(mp); // JsonValue compatible
          const manifestCanon: string = jcsCanonicalize(manifestObj);

          // 3) convert to bytes
          const msgBytes: Uint8Array = Buffer.from(manifestCanon, 'utf8');
          const sigRaw: Uint8Array = Buffer.from(sigB64u, 'base64url');

          // sanity: Ed25519 raw signature = 64 bytes
          if (sigRaw.length !== 64) {
            fail(`${baseName}: signature_invalid`);
            errors++;
          } else {
            // 4) Public key import from JWKS (OKP / Ed25519)
            const jwk = { kty: 'OKP', crv: 'Ed25519', x, ext: true } as const;
            const key: CryptoKey = await webcrypto.subtle.importKey(
              'jwk',
              jwk,
              { name: 'Ed25519' },
              false,
              ['verify'],
            );

            // 5) Detached verify
            const ok: boolean = await webcrypto.subtle.verify(
              { name: 'Ed25519' },
              key,
              sigRaw,
              msgBytes,
            );

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

      // 3) only print the green line if all three checks passed
      if (digest === m.sha256 && size === m.size && sigOk) {
        ok(okLine);
      }
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
