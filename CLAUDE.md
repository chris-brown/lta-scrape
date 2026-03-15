# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This project scrapes tennis rankings and tournament data from the LTA (Lawn Tennis Association) website and uploads CSVs to Azure Storage. It uses **Cypress as a scraping engine** (not just for testing) — the "tests" are actually the scrapers that generate CSV output files.

## Commands

```bash
npm install                  # Install dependencies
npm run cypress              # Open Cypress interactive UI
npx cypress run --spec cypress/e2e/lta-website.cy.js    # Run rankings scraper headlessly
npx cypress run --spec cypress/e2e/tournaments.cy.js    # Run tournament scraper headlessly
```

## Architecture

The scraping logic lives entirely in `cypress/e2e/`. Each file is an independent scraper:

- **`lta-website.cy.js`** — Scrapes player rankings for U9, U10, and U16 Girls. Visits `competitions.lta.org.uk`, accepts cookies, selects 100-row page size, paginates, and writes to `files/u9.csv`, `files/u10.csv`, and `files/combined.csv`.
- **`tournaments.cy.js`** — Scrapes tournament listings filtered by date/location/category, visits each tournament's fact sheet to extract start dates, writes to `files/tournaments.csv`.

Output CSVs go to `files/` (gitignored). The GitHub Actions workflow (`.github/workflows/scrape.yaml`) runs rankings scraping every Friday at 11:00 UTC, archives the CSVs, and uploads them to Azure Blob Storage via a SAS token stored in `AZURE_STORAGE_CONNECTION_STRING` secret.

## CSV Consumer: Chrome Extension

The CSVs are consumed by a companion Chrome extension ([chris-brown/lta-extension](https://github.com/chris-brown/lta-extension)) that injects extra columns into LTA tournament entry pages (`competitions.lta.org.uk/sport/event.aspx*`). The extension fetches the CSVs from Azure Blob Storage, parses them, matches players by name, and appends form, county, year, and WTN singles data to the entries table. **CSV column names must stay stable** — the extension reads them by header name (`player`, `form`, `county`, `year`, `wtnsingles`). The `empty`/`empty2` columns are artefacts of the LTA table layout and are ignored by the extension.

**Key Cypress config** (`cypress.config.js`): `chromeWebSecurity: false` is required to allow cross-origin requests during scraping.

**`it.only()`** in `tournaments.cy.js` means only that test runs if the file is executed — this is intentional.
