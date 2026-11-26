# Vault Of Specs data schema

Shaped like MusicBrainz so it can later be imported into a renamed `musicbrainz-server` fork: entity tables with permanent UUIDs, one generic relationship table with typed links, aliases, disambiguation and merge redirects. Files live in `data/`, one JSON array per table.

## Entities

| Vault Of Specs | MusicBrainz | File | What it is |
| --- | --- | --- | --- |
| Company | Label | `companies.json` | Manufacturer, ODM/OEM, distributor, retailer, parent company |
| Facility | Place | `facilities.json` | Factory, plant, workshop, warehouse |
| Brand | Artist | `brands.json` | Name products are sold under |
| Product line | Series | `product-lines.json` | Ordered family of models (Hoco J series, GeForce RTX 40) |
| Design | Work | `designs.json` | The engineered thing itself; rebadged products share one design. Parts are designs too |
| Model | Release group | `models.json` | A brand's named product (Hoco J94 Overlord) |
| Variant | Release | `variants.json` | A purchasable edition: color, region, part number, barcode, release date, packaging |
| Material | Instrument | `materials.json` | Fabric, alloy, plastic, dye; hierarchical (cotton → organic cotton) |
| Category | Genre | `categories.json` | Power banks, GPUs, scarves; hierarchical |
| Area | Area | `areas.json` | Country, region, city; hierarchical |
| URL | URL | `urls.json` | Official pages, spec sources, shop pages |

Every entity has `id` (UUID, never reused), `name`, `disambiguation` (tells same-named entities apart), `annotation` (free text). Type-specific fields:

- Company: `type` (manufacturer, odm, distributor, retailer, holding), `areaId`, `beginDate`, `endDate`
- Facility: `type` (factory, assembly plant, workshop, warehouse), `areaId`, `address`, `coordinates`
- Brand: `areaId`, `beginDate`, `endDate`
- Product line: `ordering` (`manual` or `releaseDate`)
- Design: `categoryId`, `specs` (see below)
- Model: `categoryId`, `specs` (model-level overrides of its design's specs)
- Variant: `modelId`, `color`, `region` (`areaId`), `partNumber`, `barcode`, `releaseDate` (YYYY, YYYY-MM or YYYY-MM-DD), `packaging`, `status` (official, discontinued, bootleg), `specs`
- Material: `parentId`, `specs`
- Category, Area: `parentId`, `type`

`specs`: `[{ "name": "Capacity", "value": "75000mAh", "sourceUrlId": "<url id>" }]`. Names are the unified names; the raw source wording stays in `raw-specs.json`.

## Relationships (`relationships.json`)

One table for every link, like MusicBrainz's `l_*` tables:

```json
{ "id": "<uuid>", "type": "contains", "entity0": { "type": "design", "id": "<uuid>" }, "entity1": { "type": "design", "id": "<uuid>" },
  "attributes": { "quantity": 2 }, "beginDate": null, "endDate": null, "ended": false, "sourceUrlId": null }
```

Link types (`link-types.json`; new ones are added there, never hard-coded):

| Type | entity0 → entity1 | Attributes |
| --- | --- | --- |
| owns | company → brand / company / facility | |
| operates | company → facility | |
| manufactures for | company → brand | |
| produces | facility → model / variant / design | |
| sells | brand → model | |
| based on | model → design | `rebadge` (true when the same design is sold by several brands) |
| part of | product line → model | `number` |
| contains | design → design | `quantity`, `role` (e.g. "GPU", "fan") |
| made of | design → material | `share` (percent), `role` (shell, lining) |
| treated with | material → material | `role` (dye, coating) |
| originates from | material / company / facility → area | |
| successor of | model → model, company → company | |
| has URL | any entity → url | `role` (official page, spec source, shop page, manual) |

This gives the web: a facility page lists what it produces and for which brands; a model page shows its design, and the design shows every other brand's model based on it; a design page lists its parts, each a design with its own page, down to materials and their origin.

## Supporting tables

- `aliases.json`: `{ id, entity: { type, id }, name, locale, primary, type }`, other names, translations and search hints (MusicBrainz aliases)
- `redirects.json`: `{ fromId, toId }`. A merge keeps the surviving entity and redirects the merged one's ID to it, so old links still work (MusicBrainz `*_gid_redirect`)
- `raw-specs.json`: `{ urlId, entity: { type, id }, scannedAt, specs }`, specs exactly as a source page lists them
- `tags.json`: `{ entity: { type, id }, tag, count }`

## Editing

Edits are git commits with a fixed message format, one edit per commit: `Add model: Hoco J94 Overlord`, `Edit design <id>: Weight 1400g → 1390g`, `Merge model <id> into <id>`, `Remove relationship <id>`. The edit types match MusicBrainz's (add, edit, merge, remove, add relationship, edit relationship, remove relationship), so the history can be replayed into its edit table on migration; votes start when there are other editors (pull requests with reviews).

## Migration to a musicbrainz-server fork

Each file maps to one table set (Company → `label`, Brand → `artist`, Design → `work`, Model → `release_group`, Variant → `release`, Material → `instrument`, relationships → `l_<type0>_<type1>` + `link` + `link_attribute`), UUIDs become `gid`. Specs and the new entity types need new tables in the fork.

## Current data

`data/brands.json` and `data/models.json` are still in the first, flat format (specs, sources and raw specs inside each model), generated from the OLX Model Tags catalog by `scripts/convert-olx-model-tags-catalog.cjs`. They move to this schema when the converter is updated: each catalog model becomes a Model, a Design (`based on`) and its URLs.
