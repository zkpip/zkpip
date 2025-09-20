// packages/core/src/validate/vectors.ts
import fs from 'node:fs';
import path from 'node:path';
import type { ErrorObject } from 'ajv';
import { addCoreSchemas } from '../validation/addCoreSchemas.js';
import { createAjv } from '../validation/ajv.js';
import { CANONICAL_IDS } from '../constants/canonicalIds.js';
import type { AjvLike } from '../validation/ajv-types.js';
import { pickSchemaId } from './pickSchemaId.js';
import { fileURLToPath } from 'node:url';

/** Recursively list *.json files under a path (no "any"). */
function listJsonFiles(inputPath: string): string[] {
  const st = fs.statSync(inputPath);
  if (st.isFile()) return inputPath.toLowerCase().endsWith('.json') ? [inputPath] : [];
  const out: string[] = [];
  const stack: string[] = [inputPath];
  while (stack.length) {
    const dir = stack.pop() as string;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (ent.isFile() && p.toLowerCase().endsWith('.json')) out.push(p);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/** Default schemas root used by addCoreSchemas() (relative to this module). */
function defaultSchemasRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '../../schemas');
}

function getGroup1(re: RegExp, s: string): string | undefined {
  const m = re.exec(s);
  return m?.[1];
}

function normalizeSchemaRef(schemaRef?: string): string | undefined {
  if (!schemaRef || typeof schemaRef !== 'string') return undefined;
  const s = schemaRef.trim();

  // canonical set...
  const canonicalSet = new Set<string>([
    CANONICAL_IDS.core,
    CANONICAL_IDS.verification,
    CANONICAL_IDS.ecosystem,
    CANONICAL_IDS.issue,
    CANONICAL_IDS.cir,
    CANONICAL_IDS.proofEnvelope,
    CANONICAL_IDS.proofEnvelope, // NEW
  ]);
  if (canonicalSet.has(s)) return s;

  // Dotted → canonical
  {
    const name = getGroup1(/^urn:zkpip:mvs\.([A-Za-z0-9]+)\.schema\.json$/i, s);
    if (name) {
      switch (name.toLowerCase()) {
        case 'core':
          return CANONICAL_IDS.core;
        case 'verification':
          return CANONICAL_IDS.verification;
        case 'ecosystem':
          return CANONICAL_IDS.ecosystem;
        case 'issue':
          return CANONICAL_IDS.issue;
        case 'cir':
          return CANONICAL_IDS.cir;
        case 'proofbundle':
          return CANONICAL_IDS.proofEnvelope;
        case 'proofenvelope':
          return CANONICAL_IDS.proofEnvelope;
      }
    }
  }

  // Colon :schemas: → canonical
  {
    const name = getGroup1(/^urn:zkpip:mvs:schemas:([A-Za-z0-9]+)\.schema\.json$/i, s);
    if (name) {
      switch (name.toLowerCase()) {
        case 'core':
          return CANONICAL_IDS.core;
        case 'verification':
          return CANONICAL_IDS.verification;
        case 'ecosystem':
          return CANONICAL_IDS.ecosystem;
        case 'issue':
          return CANONICAL_IDS.issue;
        case 'cir':
          return CANONICAL_IDS.cir;
        case 'proofbundle':
          return CANONICAL_IDS.proofEnvelope;
        case 'proofenvelope':
          return CANONICAL_IDS.proofEnvelope;
      }
    }
  }

  // Filename/https tail fallback
  const tail = s.split('/').pop()?.toLowerCase() ?? '';
  switch (tail) {
    case 'core.schema.json':
      return CANONICAL_IDS.core;
    case 'verification.schema.json':
      return CANONICAL_IDS.verification;
    case 'ecosystem.schema.json':
      return CANONICAL_IDS.ecosystem;
    case 'issue.schema.json':
      return CANONICAL_IDS.issue;
    case 'cir.schema.json':
      return CANONICAL_IDS.cir;
    case 'proofbundle.schema.json':
      return CANONICAL_IDS.proofEnvelope;
    case 'proofenvelope.schema.json':
      return CANONICAL_IDS.proofEnvelope;
  }

  return undefined;
}

function loadJson(abs: string): unknown {
  const txt = fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(txt) as unknown;
}

function formatAjvErrors(errors?: ErrorObject[] | null): string {
  if (!errors?.length) return '(no AJV errors captured)';
  return errors
    .map((e) => `${e.instancePath || '/'} ${e.message ?? ''} ${JSON.stringify(e.params)}`)
    .join('; ');
}

/** Validate one or many JSON files against a single picked schema per file. */
export async function validatePath(inputPath: string): Promise<void> {
  const files = listJsonFiles(inputPath);

  const ajv: AjvLike = createAjv();
  addCoreSchemas(ajv);

  const schemasRoot =
    process.env.ZKPIP_SCHEMAS_DIR ?? process.env.ZKPIP_SCHEMAS_ROOT ?? defaultSchemasRoot();

  for (const file of files) {
    const data = loadJson(file);

    // 1) Prefer explicit $schema inside the payload if present and recognized
    const explicit = normalizeSchemaRef(
      typeof (data as { $schema?: unknown })?.$schema === 'string'
        ? (data as { $schema: string }).$schema
        : undefined,
    );

    // 2) Otherwise, use filename-based picker (with canonical fallback inside)
    const targetId = explicit ?? pickSchemaId(file, schemasRoot);

    // Compile/get exactly that schema and validate once
    const validate = ajv.getSchema(targetId) ?? ajv.compile({ $ref: targetId });

    const ok = validate(data);
    if (!ok) {
      const msg = `Validation failed for ${file}:\n - ${targetId}: ${formatAjvErrors(validate.errors)}`;
      throw new Error(msg);
    }
  }
}
