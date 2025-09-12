// packages/core/src/validation/addCoreSchemas.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_IDS } from '../constants/canonicalIds.js';
import type { AjvRegistryLike } from './ajv-types.js';

export type CanonicalId = (typeof CANONICAL_IDS)[keyof typeof CANONICAL_IDS];

function resolveSchemasDir(custom?: string): string {
  if (custom) return custom;
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
    'urn:zkpip:mvs.proof-bundle.schema.json',
    'mvs.proof-bundle',
    'mvs/proof-bundle',
    'mvs.proof-bundle.schema.json',
    'mvs/verification/proofBundle',
  ],
  [CANONICAL_IDS.verification]: [
    'urn:zkpip:mvs.verification.schema.json',
    'mvs.verification',
    'mvs/verification',
    'mvs.verification.schema.json',
  ],
  [CANONICAL_IDS.core]: [
    'urn:zkpip:mvs.core.schema.json',
    'urn:zkpip:mvs.core.payload.schema.json',
    'mvs.core',
    'mvs/core',
    'mvs.core.schema.json',
    'mvs.core.payload.schema.json',
  ],
  [CANONICAL_IDS.cir]: [
    'urn:zkpip:mvs.cir.schema.json',
    'mvs.cir',
    'mvs/cir',
    'mvs.cir.schema.json',
    'mvs/verification/cir',
  ],
  [CANONICAL_IDS.issue]: [
    'urn:zkpip:mvs.issue.schema.json',
    'mvs.issue',
    'mvs/issue',
    'mvs.issue.schema.json',
  ],
  [CANONICAL_IDS.ecosystem]: [
    'urn:zkpip:mvs.ecosystem.schema.json',
    'mvs.ecosystem',
    'mvs/ecosystem',
    'mvs.ecosystem.schema.json',
  ],
} as const;

const NEW_URN_BY_CANONICAL: Record<string, string> = {
  [CANONICAL_IDS.proofBundle]: 'urn:zkpip:mvs:schemas:proofBundle.schema.json',
  [CANONICAL_IDS.verification]: 'urn:zkpip:mvs:schemas:verification.schema.json',
  [CANONICAL_IDS.cir]: 'urn:zkpip:mvs:schemas:cir.schema.json',
  [CANONICAL_IDS.issue]: 'urn:zkpip:mvs:schemas:issue.schema.json',
  [CANONICAL_IDS.ecosystem]: 'urn:zkpip:mvs:schemas:ecosystem.schema.json',
  [CANONICAL_IDS.core]: 'urn:zkpip:mvs:schemas:core.schema.json',
};

function detectKind(schema: unknown, file: string): CanonicalId | undefined {
  const id =
    typeof schema === 'object' &&
    schema !== null &&
    !Array.isArray(schema) &&
    typeof (schema as Record<string, unknown>)['$id'] === 'string'
      ? String((schema as Record<string, unknown>)['$id']).toLowerCase()
      : '';
  const f = file.toLowerCase();
  if (
    id.includes('proof-bundle') ||
    id.includes('proofbundle') ||
    f.includes('proof-bundle') ||
    f.includes('proofbundle')
  )
    return CANONICAL_IDS.proofBundle;
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
      addIfMissing(ajv, canonical, schemaObj);

      const newUrn = NEW_URN_BY_CANONICAL[canonical];
      if (newUrn) addIfMissing(ajv, newUrn, schemaObj);

      for (const a of ALIASES[canonical] || []) {
        addIfMissing(ajv, a, schemaObj);
      }

      const tailOld = canonical.split(':').pop()!;
      addIfMissing(ajv, `https://zkpip.org/schemas/${tailOld}`, schemaObj);

      if (newUrn) {
        const tailNew = newUrn.split(':').pop()!;
        addIfMissing(ajv, `https://zkpip.org/schemas/${tailNew}`, schemaObj);
      }
    }
  }

  if (opts?.debug || process.env.DEBUG_MVS_SCHEMAS) {
    console.log(`[addCoreSchemas] loaded ${files.length} schema(s) from ${dir}`);
  }
}
