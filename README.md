# Biweekly Budget Tracker

A simple browser-based budget app for a 14-day pay period.

## Features
- Set one total budget per 14-day period.
- Log spend by date (supports calculator input like `8.50+7.20`).
- Spend logging is additive for the selected date.
- Reset an individual day with **Reset Day**.
- See a vertical budget meter with day ticks and trend-based color.
- View all 14 days in an entries table.
- Export/import your data as JSON to move between devices.
- Data is stored locally in browser storage.

## Run locally
From the repository root directory:

```powershell
start .\docs\index.html
```

You can also open `docs/index.html` directly in your browser.

Optional Python launcher:

```powershell
python run_local.py
```

## GitHub Pages deployment
1. In GitHub repo settings, open **Pages**.
2. Set source to branch `main` and folder `/docs`.
3. Save and wait for the site URL.

## Data transfer between devices (no backend)
Use the app buttons in the Entries pane:
- **Export JSON** on source device.
- Move file (email/cloud/etc.).
- **Import JSON** on destination device.

## Project structure
- `docs/` primary source for the app UI and GitHub Pages deployment.
- `src/biweekly_budget/` Python domain logic scaffold.
- `run_local.py` local launcher convenience script.
