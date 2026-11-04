import fs from 'node:fs/promises'
import { compile } from 'json-schema-to-typescript'

// json-schema-to-typescript currently consumes draft-07 tuple `items`.
// Convert only the schema dialect, without redefining any protocol fields.
function draft7(value) {
  if (Array.isArray(value)) return value.map(draft7)
  if (!value || typeof value !== 'object') return value
  const result = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, draft7(v)]))
  if (result.prefixItems) {
    result.items = result.prefixItems
    delete result.prefixItems
  }
  delete result.$schema
  return result
}
const schema = JSON.parse(await fs.readFile('schemas/origin.analysis.v1.json', 'utf8'))
const output = await compile(draft7(schema), 'Analysis', {
  bannerComment: '/* Generated from the Pydantic JSON Schema. Do not edit. */',
  additionalProperties: false,
})
await fs.writeFile('apps/web/src/data/analysis.generated.ts', output)
