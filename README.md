# Spin & Gold Preflop Trainer

Spin & Gold Preflop Trainer is a personal training app for memorizing preflop charts in Spin & Gold poker.  
It is designed for one user who manually enters chart data and trains recall over time with spaced repetition.

## Who this is for

- Players studying preflop ranges from coaching/fund materials
- Players who want exact-stack chart separation (e.g. 20bb and 15bb are separate spots)
- Players who want both action accuracy and visual range-shape memory training

## Tech stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router
- IndexedDB (`idb`)
- Zustand (available in project dependencies)
- PWA support via `vite-plugin-pwa`
- Capacitor setup for mobile wrappers

## Features

- Spot management (create/edit/delete/duplicate spots)
- 13x13 chart editor with pure and mixed frequencies
- Standard trainer mode with spaced repetition scheduling
- Priority engine that promotes difficult/mixed/overdue cards
- Visual trainers:
  - Flash Range
  - Missing Cells
  - Border Trainer
- Study mode (passive review of full matrix, no grading)
- Spot-level and global statistics
- Import/Export:
  - Full backup (spots + ranges + cards + sessions)
  - Single spot export/import
  - Validation for hand keys and frequency sums
- Settings:
  - Flash duration
  - Fast/slow grading thresholds
  - Feedback frequency visibility
  - Include trash hands toggle
  - Focus mixed hands toggle
- Offline-ready PWA

## Getting started

### Prerequisites

- Node.js 20+ (recommended)
- npm

### Install

```bash
npm install
```

### Run in development

```bash
npm run dev
```

### Build production bundle

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

## PWA installation

1. Open the deployed app in a supported browser (Chrome/Edge/Safari mobile).
2. Use **Install App** (desktop) or **Add to Home Screen** (mobile).
3. The app shell is cached by the service worker for offline startup.

## Capacitor mobile wrapper

Capacitor dependencies and config are included.

### Build web assets first

```bash
npm run build
```

### Initialize native platforms (first time)

```bash
npx cap add android
npx cap add ios
```

### Sync web assets into native project

```bash
npx cap sync
```

### Open in native IDE

```bash
npx cap open android
npx cap open ios
```

## Import / Export usage

- Go to **Import / Export** from dashboard.
- **Export all data** creates a full JSON backup.
- **Export spot** creates a single-spot JSON (spot + range).
- **Import JSON** accepts either format:
  - Full backup: prompts to replace all local data
  - Single spot: upserts one spot + range

Validation checks:
- hand keys must be valid canonical 169-hand keys
- each frequency row must contain valid numbers in `[0..1]`
- frequency sum must equal `1` (±0.01 tolerance)

## Project structure

```text
src/
  components/     # reusable UI (RangeMatrix, FrequencyModal)
  domain/         # types, hand matrix, memory/priority/stat engines
  pages/          # app screens (dashboard, trainer, stats, settings, etc.)
  storage/        # IndexedDB + localStorage access modules
.github/workflows/deploy.yml  # GitHub Pages deploy pipeline
capacitor.config.ts           # Capacitor app config
vite.config.ts                # Vite + PWA configuration
```

## Deployment (GitHub Pages)

### Automatic deployment

GitHub Actions workflow: `.github/workflows/deploy.yml`

- Trigger: push to `master`
- Steps:
  1. checkout
  2. setup node
  3. install with `npm ci`
  4. build with `npm run build`
  5. deploy `dist/` via `peaceiris/actions-gh-pages@v3`

Vite `base` is configured as `/spin_and_gold/` for Pages hosting.

### Enable GitHub Pages in repository settings

1. Go to **Settings → Pages** in the repository.
2. Under **Source**, select **GitHub Actions**.
3. Save. The next push to `master` will trigger a deployment.

The app will be available at:

```
https://georgiiahl.github.io/spin_and_gold/
```

### Manual deployment

If you want to deploy the built assets yourself:

```bash
npm run build
```

Then upload or deploy the contents of the `dist/` folder to any static host (Netlify, Vercel, etc.) or use the `gh-pages` CLI:

```bash
npx gh-pages -d dist
```
