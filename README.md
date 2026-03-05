# Biweekly Budget Tracker

Simple local-first browser app to track spending across a 14-day pay period.

## What it does
- Set one budget amount for a 14-day period.
- Add daily spend entries.
- See a visual budget meter deplete as you spend.
- View total spent, remaining amount, and days left in the period.
- Store data in your browser local storage (no backend yet).

## Run locally (no server)
1. Use Python 3.12+.
2. From this repo:
   ```powershell
   python run_local.py
   ```
3. Your default browser opens `web/index.html` directly.

You can also open `web/index.html` manually in your browser.

## Project structure
- `web/` contains the local browser app (`index.html`, `styles.css`, `app.js`).
- `src/biweekly_budget/` contains Python domain logic for future backend/API reuse.
- `run_local.py` is a convenience launcher.

## Future backend path
When you are ready, this structure can evolve to a Python API app (Flask/FastAPI) that reuses the logic in `src/biweekly_budget/` and persists data in SQLite.
