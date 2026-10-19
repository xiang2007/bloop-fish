# project-fisheye

A fish pond performance tracking and decision-support tool for aquaculture farm owners and workers.

## Overview

Fisheye digitizes the manual pond-management workflow currently kept in spreadsheets (feed logs, mortality records, harvest estimates) into a web app, with the long-term goal of AI-assisted decision making (e.g. predictive feed recommendations based on historical data).

## Context

- Initial scope: 7 ponds, ~10,000 kg of fish
- Target platform: web app, optimized for Android phones (primary device used by farmers)
- User groups:
  - **Farm Owner** — views data, makes decisions (feed, harvest, inventory)
  - **Farm Worker** — inputs daily data (feed used, dead fish)

## Phase 1 Plan

See [`Screenshot_2026-09-20_at_10.23.41_PM.png`](./Screenshot_2026-09-20_at_10.23.41_PM.png) for the full flow diagram.

1. **Data Understanding** — assess existing pond data
2. **Decide Web App** — confirm web app approach, accessible to farmers on Android
3. **Code on what?** — pick architecture, considering future scalability to more ponds and a possible native app
4. **UI Requirements** — track feed used, dead fish, potential harvest, inventory needed, sampling reminders
5. **AI Decision Making** — predictive recommendations for farm owners (starting with feed), based on historical data

## Running locally

Two apps: a REST API (`backend/`, port 4000) and the web app (`frontend/`, port 3000). The web app forwards `/api/*` to the API. Shared TypeScript lives in `shared/`. See [`docs/2026-10-05-rest-api-refactor.md`](./docs/2026-10-05-rest-api-refactor.md) and [`docs/API.md`](./docs/API.md).

```bash
npm install                       # installs all three packages (npm workspaces)
cp backend/.env.example backend/.env.local   # then put your PostgreSQL URL in it
cd backend
npx prisma generate               # Prisma client -> backend/src/generated
npx prisma migrate deploy         # apply migrations to the Postgres at DATABASE_URL
npx prisma db seed                # feed catalogue, Ponds 1–7, and Pond 1 imported from backend/data/*.csv
cd ..
npm run dev                       # API on :4000 and web on http://localhost:3000
```

Other commands: `npm run typecheck`, `npm run lint`, `npm run build`. Set `BACKEND_URL` for the web app if the API is not on `http://localhost:4000`.

Choose **Farm owner** for the dashboard or **Farm worker** for the phone daily log.

Optional demo data (local databases only; pass `-- --force` to write elsewhere), run inside `backend/`:

```bash
npm run db:mock             # made-up history for Ponds 2–7
npm run db:scenario         # a separate "100 ponds across 7 farms" scenario in its own schema
```

Once the scenario exists, the sidebar shows a **Real farm / 100 ponds** switch. It only changes which data this browser sees; the real data is never touched.

## What the app does

- **Spreadsheet import** (`/import`, `shared/src/import/`): reads the Fish Pond Performance Report CSV — every monthly block of daily feed type, bags and dead fish, the monthly cost tables and the average-weight summary. The sheet is cross-checked against its own totals before saving; mismatches (e.g. a mislabelled month heading, a cost table copied from the previous month, bags costed at the wrong pack size) are listed on the pond's *Data & imports* tab. Daily rows are treated as the source of truth. An import can be rolled back.
- **Daily log** (`/log`): one screen per pond for workers on Android phones — feed type, bags, dead fish, optional note, and monthly sample weighing. One record per pond per day; saving again updates it.
- **Owner dashboard** (`/`, `/ponds/[id]`): standing stock, feed cost, monthly feed and mortality, growth curve, the sheet's monthly summary recalculated from daily records, feed programme, and rule-based alerts (logging gaps, sampling due, mortality spikes, feed stock).
- **Feed stock** (`/inventory`): stocktakes and deliveries; on-hand = last stocktake + deliveries − bags logged since, with days of cover.
- **Export**: `/ponds/[id]/export` downloads the daily records as CSV.

Harvest weight is estimated the way the spreadsheet does it (feed ÷ assumed FCR − mortality weight). Entering the stocked fish count on a pond also gives survival rate, biomass from sampling and actual FCR. Feed cost is stored on each record at the price in effect when it was saved.

## Sample Data

[`(Project) Fish pond performance report  - Copy of 「Pond 1 」.csv`](<./(Project) Fish pond performance report  - Copy of 「Pond 1 」.csv>) is a raw export of the current manual tracking spreadsheet for Pond 1, including:

- Feed consumed (by packing size, gunny quantity, total weight)
- Dead fish records by month (tail count, average weight, cost)
- Monthly feed logs (date, feed type, quantity, dead fish) from Dec-25 through Aug-26
- Feed cost breakdown and conversion ratio calculations

This sample informs the data model for the app's UI and backend.
