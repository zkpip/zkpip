// Verifies that the locally bundled $id/$schema match the pinned values.
import { readFileSync } from 'node:fs';

type SchemaDoc = { $id?: string; $schema?: string };

const pinned = JSON.parse(readFileSync('packages/core/src/schema/pinned.json','utf8')) as {
  $id: string; $schema: string;
};

const local = JSON.parse(readFileSync('packages/core/dist/schema/zkpip.schema.json','utf8')) as SchemaDoc;

if (local.$id !== pinned.$id || local.$schema !== pinned.$schema) {
  console.error('Schema drift detected: local vs pinned mismatch.');
  process.exitCode = 1;
} else {
  console.log('Schema drift check: OK');
}
