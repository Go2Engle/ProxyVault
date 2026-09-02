# Proxy Vault

A fast, static catalog for the community-maintained collection of custom Magic: The Gathering proxy decks. It turns the shared spreadsheet into a searchable archive while preserving creator credit and the original proxy-file, decklist, and source-post links.

## What it does

- Browses 149 complete decks and 5 miscellaneous collections.
- Searches themes, commanders, archetypes, creators, sources, and notes.
- Filters by record type, color identity, and token availability.
- Opens the original proxy files and decklist without rehosting community art.
- Downloads an individual record as JSON or the visible catalog as CSV.
- Copies supported Moxfield/Archidekt URLs before opening Proxxied's deck builder.
- Refreshes from the public Google workbook every day.
- Deploys as a static GitHub Pages site with no database, API key, or hosting bill.

## Run locally

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Run `npm run build` before submitting a change.

## Publish on GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch.
2. In **Settings → Pages**, choose **GitHub Actions** as the source.
3. Open the **Actions** tab and run **Sync catalog and deploy Pages**, or push a commit to `main`.

The workflow builds and publishes the site, then runs daily to pull changes from the source workbook. It only commits `src/data/decks.json` when the workbook data actually changes.

## Update data manually

```bash
python3 scripts/sync_decks.py
```

The importer downloads the workbook as `.xlsx` and reads the hyperlink relationships that are missing from Google's CSV export.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Deck records should be corrected at the [canonical community spreadsheet](https://docs.google.com/spreadsheets/d/1jkYdBdhP5s6yOirrgTSbBF9Qr1fum1-2gHOxNQCzFC4/edit?gid=0#gid=0) whenever possible. Repository issues and pull requests are best for importer, accessibility, design, and deployment improvements.

## Project boundaries

Proxy Vault is an independent community index. It is not affiliated with or endorsed by Wizards of the Coast. Community creators and linked platforms retain ownership of their work and content. The site does not rehost proxy packs or card art.
