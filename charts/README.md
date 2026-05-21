# Charts Directory

Place your exported chart files (JSON, CSV, etc.) in this directory.

Files stored here are served as static assets and ship with every build and deployment, so you don't need to re-upload them each time. After adding files, run the build and deploy as usual.

## Usage

1. Export your range/chart data from your GTO solver or charting tool.
2. Copy the file into this directory (e.g. `public/charts/my-range.json`).
3. The file will be available at `/charts/my-range.json` in the deployed app.
