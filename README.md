# Vault Of Specs

Open product database: brands, products and their specs, with links to the pages the specs came from. Under construction ⚠️

Site: https://karpuzikov.github.io/vault-of-specs/

Data comes from the [OLX Model Tags](https://github.com/karpuzikov/userscripts/tree/main/browser-tools/olx-model-tags) catalog (`olx-model-tags-catalog.json`, `olx-model-tags-rawspecs.json`); the userscript captures specs from official brand sites and writes them there. This site only reads `data/`.

Data model: [SCHEMA.md](SCHEMA.md) (MusicBrainz-style: manufacturers, brands, product lines, models, variants). `data/brands.json` and `data/models.json` are regenerated from the catalog with `node scripts/convert-olx-model-tags-catalog.cjs <catalog.json> <rawspecs.json>`.
