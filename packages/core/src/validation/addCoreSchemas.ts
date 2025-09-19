// packages/core/src/validation/addCoreSchemas.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_IDS } from '../constants/canonicalIds.js';
import type { AjvRegistryLike } from './ajv-types.js';

export type CanonicalId = (typeof CANONICAL_IDS)[keyof typeof CANONICAL_IDS];

function resolveSchemasDir(custom?: string): string {
  // accept explicit option first
  if (custom && custom.length > 0) return custom;
  // then environment variables (both names supported)
  const env = process.env.ZKPIP_SCHEMAS_DIR ?? process.env.ZKPIP_SCHEMAS_ROOT;
  if (env && env.length > 0) return env;
  // fallback: repo default
  return fileURLToPath(new URL('../../schemas/', import.meta.url));
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.isFile() && ent.name.endsWith('.schema.json')) acc.push(p);
  }
  return acc;
}

function hasSchema(ajv: AjvRegistryLike, key: string): boolean {
  try {
    return !!ajv.getSchema(key);
  } catch {
    return false;
  }
}

function addIfMissing(ajv: AjvRegistryLike, key: string, schemaObj: object) {
  if (!key) return;
  if (!hasSchema(ajv, key)) ajv.addSchema(schemaObj, key);
}

const ALIASES: Record<CanonicalId, string[]> = {
  [CANONICAL_IDS.proofBundle]: [
    /* ... unchanged ... */
  ],

  [CANONICAL_IDS.verification]: [
    /* ... */
  ],
  [CANONICAL_IDS.core]: [
    /* ... */
  ],
  [CANONICAL_IDS.cir]: [
    /* ... */
  ],
  [CANONICAL_IDS.issue]: [
    /* ... */
  ],
  [CANONICAL_IDS.ecosystem]: [
    /* ... */
  ],
  [CANONICAL_IDS.proofEnvelope]: [
    'urn:zkpip:mvs.proof-envelopes.schema.json', // tolerant legacy typos
    'urn:zkpip:mvs.proof-envelope.schema.json',
    'mvs.proof-envelope',
    'mvs/proof-envelope',
    'mvs.proofEnvelope.schema.json',
    'mvs/verification/proofEnvelope',
  ],
} as const;

const NEW_URN_BY_CANONICAL: Record<string, string> = {
  [CANONICAL_IDS.proofBundle]: 'urn:zkpip:mvs:schemas:proofBundle.schema.json',
  [CANONICAL_IDS.verification]: 'urn:zkpip:mvs:schemas:verification.schema.json',
  [CANONICAL_IDS.cir]: 'urn:zkpip:mvs:schemas:cir.schema.json',
  [CANONICAL_IDS.issue]: 'urn:zkpip:mvs:schemas:issue.schema.json',
  [CANONICAL_IDS.ecosystem]: 'urn:zkpip:mvs:schemas:ecosystem.schema.json',
  [CANONICAL_IDS.core]: 'urn:zkpip:mvs:schemas:core.schema.json',
  [CANONICAL_IDS.proofEnvelope]: 'urn:zkpip:mvs:schemas:proofEnvelope.schema.json',
};

function toKebab(x: string): string {
  return x
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function addShortAliases(ajv: AjvRegistryLike, schemaObj: object, name: string) {
  const keb = toKebab(name); // proofBundle -> proof-bundle
  const dot = `mvs.${name}.schema.json`;
  const slash = `mvs/${name}.schema.json`;
  const shortSlash = `mvs/${keb}`;
  const shortSlashCamel = `mvs/${name}`;
  const shortDot = `mvs.${keb}.schema.json`;

  addIfMissing(ajv, dot, schemaObj);
  addIfMissing(ajv, slash, schemaObj);
  addIfMissing(ajv, shortSlash, schemaObj);
  addIfMissing(ajv, shortSlashCamel, schemaObj);
  addIfMissing(ajv, shortDot, schemaObj);
  addIfMissing(ajv, `mvs.${name}`, schemaObj);
  addIfMissing(ajv, `mvs.${keb}`, schemaObj);
}

function detectKind(schema: unknown, file: string): CanonicalId | undefined {
  const id =
    typeof schema === 'object' &&
    schema !== null &&
    !Array.isArray(schema) &&
    typeof (schema as Record<string, unknown>)['$id'] === 'string'
      ? String((schema as Record<string, unknown>)['$id']).toLowerCase()
      : '';
  const f = file.toLowerCase();

  // NEW — prefer envelope over bundle when both substrings exist
  if (
    id.includes('proofenvelope') ||
    id.includes('proof-envelope') ||
    f.includes('proof-envelope') ||
    f.includes('proofenvelope')
  ) {
    return CANONICAL_IDS.proofEnvelope;
  }

  if (
    id.includes('proof-bundle') ||
    id.includes('proofbundle') ||
    f.includes('proof-bundle') ||
    f.includes('proofbundle')
  ) {
    return CANONICAL_IDS.proofBundle;
  }
  if (id.includes('verification') || f.includes('verification')) return CANONICAL_IDS.verification;
  if (id.includes('ecosystem') || f.includes('ecosystem')) return CANONICAL_IDS.ecosystem;
  if (id.includes('issue') || f.includes('issue')) return CANONICAL_IDS.issue;
  if (id.includes('cir') || id.includes('circuit') || f.includes('cir')) return CANONICAL_IDS.cir;
  if (id.includes('core') || f.includes('core')) return CANONICAL_IDS.core;
  return undefined;
}

export function addCoreSchemas(
  ajv: AjvRegistryLike,
  opts?: { schemasDir?: string; debug?: boolean },
): void {
  const dir = resolveSchemasDir(opts?.schemasDir);
  const envDir = process.env.ZKPIP_SCHEMAS_DIR ?? process.env.ZKPIP_SCHEMAS_ROOT ?? '';
  const usingEnv = envDir.length > 0;

  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(
      `Schema file not found: directory "${dir}" does not exist or is not a directory`,
    );
  }

  // --- STRICT: env esetén megköveteljük az alap sémákat ---
  if (usingEnv) {
    const required = [
      'mvs.core.schema.json',
      'mvs.ecosystem.schema.json',
      'mvs.issue.schema.json',
      'mvs.verification.schema.json',
      'mvs.proofEnvelope.schema.json', // NEW baseline
    ];
    for (const rel of required) {
      const abs = path.join(dir, rel);
      if (!fs.existsSync(abs)) {
        throw new Error(`Schema file not found: missing "${rel}" in "${dir}"`);
      }
    }
  }

  const files = walk(dir);

  for (const file of files) {
    const schemaObj = JSON.parse(fs.readFileSync(file, 'utf8'));

    const id = typeof schemaObj.$id === 'string' ? schemaObj.$id : undefined;
    if (id) addIfMissing(ajv, id, schemaObj);
    else {
      try {
        ajv.addSchema(schemaObj);
      } catch {
        /* ignore */
      }
    }

    const canonical = detectKind(schemaObj, file);
    if (canonical) {
      // keep: canonical + colon-URN + static alias table
      addIfMissing(ajv, canonical, schemaObj);

      const newUrn = NEW_URN_BY_CANONICAL[canonical];
      if (newUrn) addIfMissing(ajv, newUrn, schemaObj);

      for (const a of ALIASES[canonical] || []) addIfMissing(ajv, a, schemaObj);

      // keep: https aliases derived from “tail”
      const tailOld = canonical.split(':').pop()!;
      addIfMissing(ajv, `https://zkpip.org/schemas/${tailOld}`, schemaObj);

      if (newUrn) {
        const tailNew = newUrn.split(':').pop()!;
        addIfMissing(ajv, `https://zkpip.org/schemas/${tailNew}`, schemaObj);
      }

      // keep: dotted ↔ :schemas: auto-alias
      const dotted = /^urn:zkpip:mvs\.([A-Za-z0-9]+)\.schema\.json$/i.exec(id ?? '');
      const colon = /^urn:zkpip:mvs:schemas:([A-Za-z0-9]+)\.schema\.json$/i.exec(id ?? '');
      if (dotted) addIfMissing(ajv, `urn:zkpip:mvs:schemas:${dotted[1]}.schema.json`, schemaObj);
      if (colon) addIfMissing(ajv, `urn:zkpip:mvs.${colon[1]}.schema.json`, schemaObj);

      // NEW: compute logical name (“core”, “cir”, “proofBundle”, “proofEnvelope”, …)
      const nameFromCanonical =
        /^urn:zkpip:mvs\.([A-Za-z0-9]+)\.schema\.json$/i.exec(canonical)?.[1] ??
        /^urn:zkpip:mvs:schemas:([A-Za-z0-9]+)\.schema\.json$/i.exec(canonical)?.[1];

      if (nameFromCanonical) {
        const low = nameFromCanonical.toLowerCase();
        const keb = toKebab(nameFromCanonical);

        // bare name aliases (filename-style)
        addIfMissing(ajv, nameFromCanonical, schemaObj);
        addIfMissing(ajv, `${nameFromCanonical}.schema.json`, schemaObj);
        addIfMissing(ajv, keb, schemaObj);
        addIfMissing(ajv, `${keb}.schema.json`, schemaObj);

        // már meglévők mellé ezek maradhatnak:
        addShortAliases(ajv, schemaObj, nameFromCanonical);

        // explicit legacy / subpath aliasok
        if (low === 'proofbundle') {
          addIfMissing(ajv, 'mvs/verification/proofBundle', schemaObj);
          addIfMissing(ajv, 'mvs/proof-bundle', schemaObj);
        }
        if (low === 'cir') {
          addIfMissing(ajv, 'mvs/verification/cir', schemaObj);
          addIfMissing(ajv, 'mvs/cir', schemaObj);
        }
      }
    }

    {
      const rel = path.relative(dir, file).replace(/\\/g, '/'); // win compat
      const stem = rel.replace(/\.schema\.json$/i, '');
      if (stem && !stem.endsWith('.json')) {
        addIfMissing(ajv, stem, schemaObj);
        addIfMissing(ajv, `${stem}.schema.json`, schemaObj);

        const lastSlash = stem.lastIndexOf('/');
        const dirPart = lastSlash >= 0 ? stem.slice(0, lastSlash) : '';
        const basePart = lastSlash >= 0 ? stem.slice(lastSlash + 1) : stem;
        const kebabBase = toKebab(basePart);
        const kebabStem = dirPart ? `${dirPart}/${kebabBase}` : kebabBase;

        addIfMissing(ajv, kebabStem, schemaObj);
        addIfMissing(ajv, `${kebabStem}.schema.json`, schemaObj);
      }
    }
  }

  if (opts?.debug || process.env.DEBUG_MVS_SCHEMAS) {
    console.log(`[addCoreSchemas] loaded ${files.length} schema(s) from ${dir}`);
  }
}
