// packages/core/src/validation/addCoreSchemas.ts

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_IDS } from '../constants/canonicalIds.js';
import type { AjvRegistryLike } from './ajv-types.js';

export type CanonicalId = (typeof CANONICAL_IDS)[keyof typeof CANONICAL_IDS];

function resolveSchemasDir(custom?: string): string {
  // Prefer explicit option first.
  if (custom && custom.length > 0) return custom;
  // Then environment variables (both names supported).
  const env = process.env.ZKPIP_SCHEMAS_DIR ?? process.env.ZKPIP_SCHEMAS_ROOT;
  if (env && env.length > 0) return env;
  // Fallback: repo default (packages/core/schemas/)
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
    return Boolean(ajv.getSchema(key));
  } catch {
    return false;
  }
}

function addIfMissing(ajv: AjvRegistryLike, key: string, schemaObj: object): void {
  if (!key) return;
  if (!hasSchema(ajv, key)) ajv.addSchema(schemaObj, key);
}

// More precise typing: aliases are optional per canonical id.
const ALIASES: Partial<Record<CanonicalId, readonly string[]>> = {
  [CANONICAL_IDS.proofEnvelope]: [
    // tolerant legacy/typo aliases
    'urn:zkpip:mvs.proof-envelopes.schema.json',
    'urn:zkpip:mvs.proof-envelope.schema.json',
    'mvs.proof-envelope',
    'mvs/proof-envelope',
    'mvs.proofEnvelope.schema.json',
    'mvs/verification/proofEnvelope'
  ]
};

const NEW_URN_BY_CANONICAL: Record<CanonicalId, string> = {
  [CANONICAL_IDS.proofEnvelope]: 'urn:zkpip:mvs:schemas:proofEnvelope.schema.json',
  [CANONICAL_IDS.verification]: 'urn:zkpip:mvs:schemas:verification.schema.json',
  [CANONICAL_IDS.cir]:          'urn:zkpip:mvs:schemas:cir.schema.json',
  [CANONICAL_IDS.issue]:        'urn:zkpip:mvs:schemas:issue.schema.json',
  [CANONICAL_IDS.ecosystem]:    'urn:zkpip:mvs:schemas:ecosystem.schema.json',
  [CANONICAL_IDS.core]:         'urn:zkpip:mvs:schemas:core.schema.json'
};

function toKebab(x: string): string {
  return x.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[_\s]+/g, '-').toLowerCase();
}

function addShortAliases(ajv: AjvRegistryLike, schemaObj: object, name: string): void {
  // proofEnvelope -> proof-envelope
  const keb = toKebab(name);
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

export function detectKind(schema: unknown, file: string): CanonicalId | undefined {
  // Normalize for robust substring checks.
  const idRaw =
    typeof schema === 'object' &&
    schema !== null &&
    !Array.isArray(schema) &&
    typeof (schema as Record<string, unknown>)['$id'] === 'string'
      ? String((schema as Record<string, unknown>)['$id'])
      : '';
  const id = idRaw.toLowerCase();
  const f = file.toLowerCase();

  // Prefer envelope whenever any envelope-related token is present.
  if (id.includes('proofenvelope') || id.includes('proof-envelope') || f.includes('proofenvelope') || f.includes('proof-envelope')) {
    return CANONICAL_IDS.proofEnvelope;
  }

  // Legacy bundle tokens map to envelope.
  if (id.includes('proofbundle') || f.includes('proofbundle')) {
    return CANONICAL_IDS.proofEnvelope;
  }

  if (id.includes('verification') || f.includes('verification')) return CANONICAL_IDS.verification;
  if (id.includes('ecosystem') || f.includes('ecosystem'))     return CANONICAL_IDS.ecosystem;
  if (id.includes('issue') || f.includes('issue'))             return CANONICAL_IDS.issue;
  if (id.includes('cir') || id.includes('circuit') || f.includes('cir')) return CANONICAL_IDS.cir;
  if (id.includes('core') || f.includes('core'))               return CANONICAL_IDS.core;

  return undefined;
}

export function addCoreSchemas(
  ajv: AjvRegistryLike,
  opts?: { schemasDir?: string; debug?: boolean }
): void {
  const dir = resolveSchemasDir(opts?.schemasDir);
  const envDir = process.env.ZKPIP_SCHEMAS_DIR ?? process.env.ZKPIP_SCHEMAS_ROOT ?? '';
  const usingEnv = envDir.length > 0;

  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`Schema file not found: directory "${dir}" does not exist or is not a directory`);
  }

  // STRICT mode for env-provided schema roots (optional).
  if (usingEnv) {
    const required = [
      'mvs.core.schema.json',
      'mvs.ecosystem.schema.json',
      'mvs.issue.schema.json',
      'mvs.verification.schema.json',
      'mvs.proofEnvelope.schema.json' // baseline
    ];
    for (const rel of required) {
      const abs = path.join(dir, rel);
      if (!fs.existsSync(abs)) throw new Error(`Schema file not found: missing "${rel}" in "${dir}"`);
    }
  }

  const files = walk(dir);

  for (const file of files) {
    const schemaObj = JSON.parse(fs.readFileSync(file, 'utf8'));

    const id = typeof (schemaObj as { $id?: unknown }).$id === 'string' ? (schemaObj as { $id: string }).$id : undefined;
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
      // Ensure canonical id is present.
      addIfMissing(ajv, canonical, schemaObj);

      // Add the official colon-form URN for this canonical id.
      const newUrn = NEW_URN_BY_CANONICAL[canonical];
      if (newUrn) addIfMissing(ajv, newUrn, schemaObj);

      // Static alias table (if present).
      for (const a of ALIASES[canonical] ?? []) addIfMissing(ajv, a, schemaObj);

      // https aliases derived from "tail"
      const tailFromCanonical = canonical.split(':').pop()!;
      addIfMissing(ajv, `https://zkpip.org/schemas/${tailFromCanonical}`, schemaObj);
      if (newUrn) {
        const tailNew = newUrn.split(':').pop()!;
        addIfMissing(ajv, `https://zkpip.org/schemas/${tailNew}`, schemaObj);
      }

      // dotted <-> colon autonormalization based on the runtime $id (if present)
      const dotted = /^urn:zkpip:mvs\.([A-Za-z0-9]+)\.schema\.json$/i.exec(id ?? '');
      const colon  = /^urn:zkpip:mvs:schemas:([A-Za-z0-9]+)\.schema\.json$/i.exec(id ?? '');
      if (dotted) addIfMissing(ajv, `urn:zkpip:mvs:schemas:${dotted[1]}.schema.json`, schemaObj);
      if (colon)  addIfMissing(ajv, `urn:zkpip:mvs.${colon[1]}.schema.json`, schemaObj);

      // Compute logical name ("core", "cir", "proofEnvelope", ...)
      const nameFromCanonical =
        /^urn:zkpip:mvs\.([A-Za-z0-9]+)\.schema\.json$/i.exec(canonical)?.[1] ??
        /^urn:zkpip:mvs:schemas:([A-Za-z0-9]+)\.schema\.json$/i.exec(canonical)?.[1];

      if (nameFromCanonical) {
        const low = nameFromCanonical.toLowerCase();
        const keb = toKebab(nameFromCanonical);

        // filename-style bare names
        addIfMissing(ajv, nameFromCanonical, schemaObj);
        addIfMissing(ajv, `${nameFromCanonical}.schema.json`, schemaObj);
        addIfMissing(ajv, keb, schemaObj);
        addIfMissing(ajv, `${keb}.schema.json`, schemaObj);

        // Short forms
        addShortAliases(ajv, schemaObj, nameFromCanonical);

        // Explicit legacy/subpath aliases
        if (low === 'proofbundle') {
          addIfMissing(ajv, 'mvs/verification/proofEnvelope', schemaObj);
          addIfMissing(ajv, 'mvs/proof-envelope', schemaObj);
        }
        if (low === 'cir') {
          addIfMissing(ajv, 'mvs/verification/cir', schemaObj);
          addIfMissing(ajv, 'mvs/cir', schemaObj);
        }
      }
    }

    // Also alias by relative path stem (path-based lookups)
    const rel = path.relative(dir, file).replace(/\\/g, '/'); // Win compat
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

  if (opts?.debug || process.env.DEBUG_MVS_SCHEMAS) {
    console.log(`[addCoreSchemas] loaded ${files.length} schema(s) from ${dir}`);
  }
}
