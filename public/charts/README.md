# Charts Directory

Place your exported chart JSON files in this directory. They deploy with the build and are auto-imported into IndexedDB on first load.

## Workflow

1. Export a spot from the app (Import/Export page → "Export spot") or export a full backup ("Export all data").
2. Copy the JSON file into this directory (e.g. `public/charts/my-range.json`).
3. Add the filename to `manifest.json`:
   ```json
   ["spin-gold-spot-example.json", "my-range.json"]
   ```
4. Commit and deploy.

## Auto-import behaviour

- On first app load the app checks if IndexedDB is empty. If it is, it fetches `manifest.json` and imports every listed file silently.
- Already-imported filenames are tracked in `localStorage` under `spin-gold-seeded-charts` to avoid duplicates across page reloads.
- To force a re-import (e.g. after updating a chart file), use the **"Import bundled charts"** button on the Import/Export page — it always re-imports every file in the manifest regardless of the tracking state.

## Supported file formats

- **Single spot** — `{ version: 1, type: "spot", data: { spot, range } }`
- **Full backup** — `{ version: 1, type: "full", data: { spots, ranges, cards?, sessions? } }`
