// Converts the OLX Model Tags catalog (karpuzikov/userscripts) into Vault Of Specs tables (see SCHEMA.md).
// Usage: node scripts/convert-olx-model-tags-catalog.cjs <olx-model-tags-catalog.json> <olx-model-tags-rawspecs.json>
// IDs are UUID v5 of kind + name, so re-running keeps every ID stable. Each catalog model becomes a Model sold by its Brand,
// based on its own Design (rebadges are merged by hand later) that holds the specs and their source URLs.
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
  return namedTag ? { name: namedTag[1].trim(), value: namedTag[2].trim() } : null;
}

const [catalogPath, rawSpecsPath] = process.argv.slice(2);
if (!catalogPath || !rawSpecsPath) throw new Error('Usage: node scripts/convert-olx-model-tags-catalog.cjs <catalog.json> <rawspecs.json>');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const rawSpecsByUrl = JSON.parse(fs.readFileSync(rawSpecsPath, 'utf8'));

const commonFields = { disambiguation: '', annotation: '' };
const brands = new Map(), categories = new Map(), urls = new Map(), designs = [], models = [], relationships = [], rawSpecs = [];
const entityRef = (type, id) => ({ type, id });
const ensureUrl = (url) => {
  if (!urls.has(url)) urls.set(url, { id: createStableUuid('url', url), url });
  return urls.get(url).id;
};
const addRelationship = (type, entity0, entity1, attributes = {}) => relationships.push({
  id: createStableUuid('relationship', `${type}:${entity0.id}:${entity1.id}:${JSON.stringify(attributes)}`),
  type, entity0, entity1, attributes, beginDate: null, endDate: null, ended: false, sourceUrlId: null,
});

const shopPagesByModelName = new Map();
for (const [pageKey, modelName] of Object.entries(catalog.productLinks || {})) {
  shopPagesByModelName.set(modelName.toLowerCase(), [...(shopPagesByModelName.get(modelName.toLowerCase()) || []), `https://${pageKey}/`]);
}

for (const [catalogKey, catalogModel] of Object.entries(catalog.models)) {
  // shortcut: brand = first word of the model name; give the catalog a brand field once a brand name has a space.
  const brandName = catalogModel.name.split(' ')[0];
  if (!brands.has(brandName.toLowerCase())) brands.set(brandName.toLowerCase(), { id: createStableUuid('brand', brandName), name: brandName, ...commonFields, areaId: null, beginDate: null, endDate: null });
  const categoryName = catalogModel.group || 'Uncategorized';
  if (!categories.has(categoryName)) categories.set(categoryName, { id: createStableUuid('category', categoryName), name: categoryName, ...commonFields, parentId: null, type: null });
  const sourceUrlIds = Object.values(catalogModel.sources || {}).map(ensureUrl);
  const design = {
    id: createStableUuid('design', catalogModel.name), name: catalogModel.name, ...commonFields, categoryId: categories.get(categoryName).id,
    // With several sources (phones: DXOMARK, GSMArena…) the catalog does not record which value came from which page.
    specs: catalogModel.tags.map(splitTagIntoSpec).filter(Boolean).map((spec) => ({ ...spec, sourceUrlId: sourceUrlIds.length === 1 ? sourceUrlIds[0] : null })),
  };
  const model = { id: createStableUuid('model', catalogModel.name), name: catalogModel.name, ...commonFields, categoryId: design.categoryId, specs: [], catalogKey };
  designs.push(design);
  models.push(model);
  addRelationship('sells', entityRef('brand', brands.get(brandName.toLowerCase()).id), entityRef('model', model.id));
  addRelationship('based on', entityRef('model', model.id), entityRef('design', design.id), { rebadge: false });
  for (const urlId of sourceUrlIds) addRelationship('has URL', entityRef('design', design.id), entityRef('url', urlId), { role: 'spec source' });
  for (const url of shopPagesByModelName.get(catalogModel.name.toLowerCase()) || []) addRelationship('has URL', entityRef('model', model.id), entityRef('url', ensureUrl(url)), { role: 'shop page' });
  for (const [url, page] of Object.entries(rawSpecsByUrl)) {
    if (url.startsWith('http') && page.model?.toLowerCase() === catalogModel.name.toLowerCase()) rawSpecs.push({ urlId: ensureUrl(url), entity: entityRef('design', design.id), scannedAt: page.scannedAt, specs: page.specs });
  }
}

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
const writeTable = (fileName, records) => fs.writeFileSync(`data/${fileName}`, JSON.stringify(records, null, 1) + '\n');
writeTable('brands.json', [...brands.values()].sort(byName));
writeTable('categories.json', [...categories.values()].sort(byName));
writeTable('designs.json', designs.sort(byName));
writeTable('models.json', models.sort(byName));
writeTable('urls.json', [...urls.values()].sort((a, b) => a.url.localeCompare(b.url)));
writeTable('relationships.json', relationships.sort((a, b) => a.id.localeCompare(b.id)));
writeTable('raw-specs.json', rawSpecs.sort((a, b) => a.urlId.localeCompare(b.urlId)));
// Not in the catalog: edited by hand, only created here when missing.
for (const fileName of ['companies.json', 'facilities.json', 'product-lines.json', 'variants.json', 'materials.json', 'areas.json', 'aliases.json', 'redirects.json', 'tags.json']) {
  if (!fs.existsSync(`data/${fileName}`)) writeTable(fileName, []);
}
console.log(`${brands.size} brands, ${models.length} models, ${designs.length} designs, ${urls.size} URLs, ${relationships.length} relationships, ${rawSpecs.length} raw spec pages`);
