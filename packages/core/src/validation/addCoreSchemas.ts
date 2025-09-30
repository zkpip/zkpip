// English comments, strict TS, no `any`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_IDS } from '../constants/canonicalIds.js';
import type { AjvRegistryLike } from './ajv-types.js';
import { addSchemaOnce } from '../validation/ajvSafeAdd.js';

export type CanonicalId = (typeof CANONICAL_IDS)[keyof typeof CANONICAL_IDS];

function resolveSchemasDir(custom?: string): string {
  if (custom && custom.length > 0) return custom;
  const env = process.env.ZKPIP_SCHEMAS_DIR ?? process.env.ZKPIP_SCHEMAS_ROOT;
  if (env && env.length > 0) return env;
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

function toKebab(x: string): string {
  return x.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[_\s]+/g, '-').toLowerCase();
}

// Optional aliases per canonical id (kept as-is)
const ALIASES: Partial<Record<CanonicalId, readonly string[]>> = {
  [CANONICAL_IDS.proofEnvelope]: [
    'urn:zkpip:mvs.proof-envelopes.schema.json',
    'urn:zkpip:mvs.proof-envelope.schema.json',
    'mvs.proof-envelope',
    'mvs/proof-envelope',
    'mvs.proofEnvelope.schema.json',
    'mvs/verification/proofEnvelope',
  ],
};

const NEW_URN_BY_CANONICAL: Record<CanonicalId, string> = {
  [CANONICAL_IDS.proofEnvelope]: 'urn:zkpip:mvs:schemas:proofEnvelope.schema.json',
  [CANONICAL_IDS.verification]: 'urn:zkpip:mvs:schemas:verification.schema.json',
  [CANONICAL_IDS.cir]:          'urn:zkpip:mvs:schemas:cir.schema.json',
  [CANONICAL_IDS.issue]:        'urn:zkpip:mvs:schemas:issue.schema.json',
  [CANONICAL_IDS.ecosystem]:    'urn:zkpip:mvs:schemas:ecosystem.schema.json',
  [CANONICAL_IDS.core]:         'urn:zkpip:mvs:schemas:core.schema.json',
};

export function detectKind(schema: unknown, file: string): CanonicalId | undefined {
  const idRaw =
    typeof schema === 'object' &&
    schema !== null &&
    !Array.isArray(schema) &&
    typeof (schema as Record<string, unknown>)['$id'] === 'string'
      ? String((schema as Record<string, unknown>)['$id'])
      : '';
  const id = idRaw.toLowerCase();
  const f = file.toLowerCase();

  if (id.includes('proofenvelope') || id.includes('proof-envelope') || f.includes('proofenvelope') || f.includes('proof-envelope')) {
    return CANONICAL_IDS.proofEnvelope;
  }
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

/** Per-call guards to avoid duplicate adds regardless of Ajv.getSchema() state. */
type Seen = {
  ids: Set<string>;
  keys: Set<string>;
};

/** Add the base schema exactly once (by $id if present, else by an explicit key). */
function addBaseOnce(
  ajv: AjvRegistryLike,
  seen: Seen,
  schemaObj: object & { $id?: string | undefined },
  keyIfNoId: string,
): string {
  const id = typeof schemaObj.$id === 'string' ? schemaObj.$id : undefined;

  if (id) {
    if (!seen.ids.has(id)) {
      addSchemaOnce(ajv, schemaObj);   // this adds by $id
      seen.ids.add(id);
      seen.keys.add(id);               // treat id as a key too
    }
    return id;
  }

  // No $id → register by provided key (e.g., relative file path)
  if (!seen.keys.has(keyIfNoId)) {
    ajv.addSchema(schemaObj, keyIfNoId);
    seen.keys.add(keyIfNoId);
  }
  return keyIfNoId;
}

/** Add an alias key as a $ref wrapper exactly once. */
function addAliasRefOnce(ajv: AjvRegistryLike, seen: Seen, targetId: string, alias: string): void {
  if (!alias || alias === targetId) return;
  if (seen.keys.has(alias)) return;
  ajv.addSchema({ $ref: targetId } as object, alias);
  seen.keys.add(alias);
}

/** Add a family of short aliases for a logical name, all as $ref wrappers. */
function addShortAliases(ajv: AjvRegistryLike, seen: Seen, targetId: string, name: string): void {
  const keb = toKebab(name);
  const dot = `mvs.${name}.schema.json`;
  const slash = `mvs/${name}.schema.json`;
  const shortSlash = `mvs/${keb}`;
  const shortSlashCamel = `mvs/${name}`;
  const shortDot = `mvs.${keb}.schema.json`;

  addAliasRefOnce(ajv, seen, targetId, dot);
  addAliasRefOnce(ajv, seen, targetId, slash);
  addAliasRefOnce(ajv, seen, targetId, shortSlash);
  addAliasRefOnce(ajv, seen, targetId, shortSlashCamel);
  addAliasRefOnce(ajv, seen, targetId, shortDot);
  addAliasRefOnce(ajv, seen, targetId, `mvs.${name}`);
  addAliasRefOnce(ajv, seen, targetId, `mvs.${keb}`);
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

  if (usingEnv) {
    const required = [
      'mvs.core.schema.json',
      'mvs.ecosystem.schema.json',
      'mvs.issue.schema.json',
      'mvs.verification.schema.json',
      'mvs.proofEnvelope.schema.json',
    ];
    for (const rel of required) {
      const abs = path.join(dir, rel);
      if (!fs.existsSync(abs)) throw new Error(`Schema file not found: missing "${rel}" in "${dir}"`);
    }
  }

  const files = walk(dir);
  const seen: Seen = { ids: new Set<string>(), keys: new Set<string>() };

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const schemaObj = JSON.parse(raw) as object & { $id?: string | undefined };

    const rel = path.relative(dir, file).replace(/\\/g, '/'); // Windows-friendly
    const baseKey = rel; // used when no $id

    // 1) Base registration (by $id if present else by rel key)
    const baseIdOrKey = addBaseOnce(ajv, seen, schemaObj, baseKey);

    // 2) Canonical family and target id/key (where aliases will point)
    const canonical = detectKind(schemaObj, file);
    const newUrn = canonical ? NEW_URN_BY_CANONICAL[canonical] : undefined;
    const targetId = baseIdOrKey ?? newUrn ?? (canonical ?? baseKey);

    // 3) Canonical id and official colon-form URN
    if (canonical) {
      addAliasRefOnce(ajv, seen, targetId, canonical);
      if (newUrn) addAliasRefOnce(ajv, seen, targetId, newUrn);

      for (const a of ALIASES[canonical] ?? []) addAliasRefOnce(ajv, seen, targetId, a);

      // https aliases (from tails)
      const tailFromCanonical = canonical.split(':').pop()!;
      addAliasRefOnce(ajv, seen, targetId, `https://zkpip.org/schemas/${tailFromCanonical}`);
      if (newUrn) {
        const tailNew = newUrn.split(':').pop()!;
        addAliasRefOnce(ajv, seen, targetId, `https://zkpip.org/schemas/${tailNew}`);
      }

      // dotted <-> colon normalization based on runtime $id (if present)
      const baseId = typeof schemaObj.$id === 'string' ? schemaObj.$id : undefined;
      if (baseId) {
        const dotted = /^urn:zkpip:mvs\.([A-Za-z0-9]+)\.schema\.json$/i.exec(baseId);
        const colon  = /^urn:zkpip:mvs:schemas:([A-Za-z0-9]+)\.schema\.json$/i.exec(baseId);
        if (dotted) addAliasRefOnce(ajv, seen, targetId, `urn:zkpip:mvs:schemas:${dotted[1]}.schema.json`);
        if (colon)  addAliasRefOnce(ajv, seen, targetId, `urn:zkpip:mvs.${colon[1]}.schema.json`);
      }

      // Name-based short aliases
      const nameFromCanonical =
        /^urn:zkpip:mvs\.([A-Za-z0-9]+)\.schema\.json$/i.exec(canonical)?.[1] ??
        /^urn:zkpip:mvs:schemas:([A-Za-z0-9]+)\.schema\.json$/i.exec(canonical)?.[1];

      if (nameFromCanonical) {
        const low = nameFromCanonical.toLowerCase();

        addAliasRefOnce(ajv, seen, targetId, nameFromCanonical);
        addAliasRefOnce(ajv, seen, targetId, `${nameFromCanonical}.schema.json`);
        addAliasRefOnce(ajv, seen, targetId, toKebab(nameFromCanonical));
        addAliasRefOnce(ajv, seen, targetId, `${toKebab(nameFromCanonical)}.schema.json`);

        addShortAliases(ajv, seen, targetId, nameFromCanonical);

        if (low === 'proofbundle') {
          addAliasRefOnce(ajv, seen, targetId, 'mvs/verification/proofEnvelope');
          addAliasRefOnce(ajv, seen, targetId, 'mvs/proof-envelope');
        }
        if (low === 'cir') {
          addAliasRefOnce(ajv, seen, targetId, 'mvs/verification/cir');
          addAliasRefOnce(ajv, seen, targetId, 'mvs/cir');
        }
      }
    }

    // 4) Path-based aliases (relative stem variants)
    const stem = rel.replace(/\.schema\.json$/i, '');
    if (stem && !stem.endsWith('.json')) {
      addAliasRefOnce(ajv, seen, targetId, stem);
      addAliasRefOnce(ajv, seen, targetId, `${stem}.schema.json`);

      const lastSlash = stem.lastIndexOf('/');
      const dirPart = lastSlash >= 0 ? stem.slice(0, lastSlash) : '';
      const basePart = lastSlash >= 0 ? stem.slice(lastSlash + 1) : stem;
      const kebabBase = toKebab(basePart);
      const kebabStem = dirPart ? `${dirPart}/${kebabBase}` : kebabBase;

      addAliasRefOnce(ajv, seen, targetId, kebabStem);
      addAliasRefOnce(ajv, seen, targetId, `${kebabStem}.schema.json`);
    }

    // --- Special-case: SEAL schema aliases (location-agnostic)
    const baseId = typeof schemaObj.$id === 'string' ? schemaObj.$id : undefined;
    if (baseId && /^urn:zkpip:schema:seal(\.v1)?$/i.test(baseId)) {
      const sealAliases = [
        'mvs/seal.schema.json',
        'mvs/seal.v1.schema.json',
        'mvs/seal',
        'mvs/seal.v1',
        'seal.schema.json',
        'seal.v1.schema.json',
        'urn:zkpip:schema:seal',
      ];
      for (const a of sealAliases) addAliasRefOnce(ajv, seen, targetId, a);
    }
  }

  if (opts?.debug || process.env.DEBUG_MVS_SCHEMAS) {
    console.log(`[addCoreSchemas] loaded ${files.length} schema(s) from ${dir}`);
  }
}
