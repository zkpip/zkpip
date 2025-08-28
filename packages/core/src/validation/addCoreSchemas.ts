// validation/addCoreSchemas.ts
import type Ajv2020 from "ajv/dist/2020";
import coreSchema0        from "../../schemas/mvs.core.schema.json"        assert { type: "json" };
import verificationSchema0 from "../../schemas/mvs.verification.schema.json" assert { type: "json" };
import issueSchema0        from "../../schemas/mvs.issue.schema.json"        assert { type: "json" };
import ecosystemSchema0    from "../../schemas/mvs.ecosystem.schema.json"    assert { type: "json" };
import proofBundleSchema0  from "../../schemas/mvs.proof-bundle.schema.json" assert { type: "json" };
import cirSchema0          from "../../schemas/mvs.cir.schema.json"          assert { type: "json" };

import { CANONICAL_IDS } from "../schemaUtils";
// CanonicalId = "mvs.proof-bundle" | "mvs.cir" | "mvs.verification" | "mvs.issue" | "mvs.ecosystem"

export type CanonicalId =
  | "mvs.proof-bundle"
  | "mvs.cir"
  | "mvs.verification"
  | "mvs.issue"
  | "mvs.ecosystem";

function addAlias(ajv: Ajv2020, alias: string, targetUrn: string) {
  if (ajv.getSchema(alias)) return;
  // Vékony alias séma: saját $id = alias, és $ref a kanonikus URN-re
  ajv.addSchema({ $id: alias, $ref: targetUrn });
}

function register(
  ajv: Ajv2020,
  shortId: "mvs.proof-bundle" | "mvs.cir" | "mvs.verification" | "mvs.issue" | "mvs.ecosystem" | "mvs.core",
  urn: string,
  raw: Record<string, unknown>
) {
  // 1) Kanonikus séma a saját URN-jével
  const base = (raw as any).$id === urn ? raw : { ...raw, $id: urn };
  if (!ajv.getSchema(urn)) {
    ajv.addSchema(base); // $id = urn alapján regisztráljuk
  }

  // 2) Aliasok: rövid (pont), rövid (perjel), fájlnév, https
  const shortDot   = shortId;                     // pl. "mvs.proof-bundle"
  const shortSlash = shortId.replace(".", "/");   // pl. "mvs/proof-bundle"
  const file       = urn.split(":").pop()!;       // pl. "mvs.proof-bundle.schema.json"
  const https      = `https://zkpip.org/schemas/${file}`;

  addAlias(ajv, shortDot,   urn);
  addAlias(ajv, shortSlash, urn);
  addAlias(ajv, file,       urn);
  addAlias(ajv, https,      urn);
}

export function addCoreSchemas(ajv: Ajv2020) {
  // Core first!!!
  register(ajv, "mvs.core",         CANONICAL_IDS.core,         coreSchema0);

  register(ajv, "mvs.verification", CANONICAL_IDS.verification, verificationSchema0);
  register(ajv, "mvs.issue",        CANONICAL_IDS.issue,        issueSchema0);
  register(ajv, "mvs.ecosystem",    CANONICAL_IDS.ecosystem,    ecosystemSchema0);
  register(ajv, "mvs.proof-bundle", CANONICAL_IDS.proofBundle,  proofBundleSchema0);
  register(ajv, "mvs.cir",          CANONICAL_IDS.cir,          cirSchema0);
}
