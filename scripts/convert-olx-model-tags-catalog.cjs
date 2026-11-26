// Converts the OLX Model Tags catalog (karpuzikov/userscripts) into Vault Of Specs data files (see SCHEMA.md).
// Usage: node scripts/convert-olx-model-tags-catalog.cjs <olx-model-tags-catalog.json> <olx-model-tags-rawspecs.json>
// IDs are UUID v5 of the name, so re-running keeps every ID stable.
const fs = require('fs');
const crypto = require('crypto');

const VAULT_OF_SPECS_UUID_NAMESPACE = '6f1c4e2a-8b7d-4c3e-9a5f-1d2b3c4e5f60';

function createStableUuid(kind, name) {
  const namespaceBytes = Buffer.from(VAULT_OF_SPECS_UUID_NAMESPACE.replace(/-/g, ''), 'hex');
  const hash = crypto.createHash('sha1').update(namespaceBytes).update(`${kind}:${name.toLowerCase()}`).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function splitTagIntoSpec(tag) {
  const namedTag = tag.match(/^([^\d:][^:]{0,30}):\s+(.+)$/); // same rule as the userscript
  return namedTag ? [namedTag[1].trim(), namedTag[2].trim()] : null;
}

const [catalogPath, rawSpecsPath] = process.argv.slice(2);
if (!catalogPath || !rawSpecsPath) throw new Error('Usage: node scripts/convert-olx-model-tags-catalog.cjs <catalog.json> <rawspecs.json>');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const rawSpecs = JSON.parse(fs.readFileSync(rawSpecsPath, 'utf8'));

const brandsByName = new Map();
const shopPagesByModelName = new Map();
for (const [pageKey, modelName] of Object.entries(catalog.productLinks || {})) {
  const key = modelName.toLowerCase();
  shopPagesByModelName.set(key, [...(shopPagesByModelName.get(key) || []), `https://${pageKey}/`]);
}
const rawSpecsByModelName = new Map();
for (const [url, page] of Object.entries(rawSpecs)) {
  if (!url.startsWith('http') || !page.model) continue;
  const key = page.model.toLowerCase();
  rawSpecsByModelName.set(key, [...(rawSpecsByModelName.get(key) || []), { url, scannedAt: page.scannedAt, specs: page.specs }]);
}

// shortcut: brand = first word of the model name; a "brand" field in the catalog would replace this once a brand name has a space.
const models = Object.entries(catalog.models).map(([catalogKey, model]) => {
  const brandName = model.name.split(' ')[0];
  if (!brandsByName.has(brandName.toLowerCase())) brandsByName.set(brandName.toLowerCase(), { id: createStableUuid('brand', brandName), name: brandName, manufacturerId: null });
  return {
    id: createStableUuid('model', model.name),
    name: model.name,
    brandId: brandsByName.get(brandName.toLowerCase()).id,
    productLineId: null,
    category: model.group || '',
    specs: Object.fromEntries(model.tags.map(splitTagIntoSpec).filter(Boolean)),
    sources: Object.entries(model.sources || {}).map(([source, url]) => ({ source, url })),
    shopPages: shopPagesByModelName.get(model.name.toLowerCase()) || [],
    rawSpecs: rawSpecsByModelName.get(model.name.toLowerCase()) || [],
    catalogKey,
  };
}).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

const writeDataFile = (fileName, records) => fs.writeFileSync(`data/${fileName}`, JSON.stringify(records, null, 1) + '\n');
// Not in the catalog yet: these files are edited by hand and only created here when missing.
for (const fileName of ['manufacturers.json', 'product-lines.json', 'variants.json']) if (!fs.existsSync(`data/${fileName}`)) writeDataFile(fileName, []);
writeDataFile('brands.json', [...brandsByName.values()].sort((a, b) => a.name.localeCompare(b.name)));
writeDataFile('models.json', models);
console.log(`${brandsByName.size} brands, ${models.length} models`);
