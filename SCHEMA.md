# Vault Of Specs data schema

Modelled on MusicBrainz. Every record has a permanent `id` (UUID, like an MBID). Files live in `data/`, one JSON array per entity type.

| Vault Of Specs | MusicBrainz | File | Fields |
| --- | --- | --- | --- |
| Manufacturer | Label | `manufacturers.json` | `id`, `name`, `country` |
| Brand | Artist | `brands.json` | `id`, `name`, `manufacturerId` |
| Product line | Series | `product-lines.json` | `id`, `name`, `brandId` |
| Model | Release group | `models.json` | `id`, `name`, `brandId`, `productLineId`, `category`, `specs`, `sources`, `shopPages`, `rawSpecs`, `catalogKey` |
| Variant | Release | `variants.json` | `id`, `modelId`, `name` (e.g. color), `region`, `partNumber`, `barcode`, `releaseDate` (YYYY-MM-DD, YYYY-MM or YYYY) |

- `specs`: `{ "Capacity": "75000mAh", ... }`, unified names shown on every site.
- `sources`: `[{ "source": "HOCO", "url": "..." }]`, pages the specs came from (MusicBrainz URL relationships).
- `rawSpecs`: `[{ "url", "scannedAt", "specs" }]`, specs exactly as each source page lists them, kept so labels can be unified later.
- `shopPages`: shop pages linked to this model by hand (hotline.ua).
- `catalogKey`: the model's key in the OLX Model Tags catalog.

`brands.json` and `models.json` are generated from the OLX Model Tags catalog by `scripts/convert-olx-model-tags-catalog.cjs`; IDs are UUID v5 of the name, so they stay the same on every run. `manufacturers.json`, `product-lines.json` and `variants.json` are edited by hand.
