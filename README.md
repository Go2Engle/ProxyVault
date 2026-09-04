# Proxy Vault

A fast, static catalog for the community-maintained collection of custom Magic: The Gathering proxy decks. It turns the shared spreadsheet into a searchable archive while preserving creator credit and the original proxy-file, decklist, and source-post links.

## What it does

- Browses 149 complete decks and 5 miscellaneous collections.
- Searches themes, commanders, archetypes, creators, sources, and notes.
- Filters by record type, color identity, and token availability.
- Opens each deck in a shareable, full-page workspace with visual stacks, text mode, card search, and a focused card inspector.
- Displays cached card lists and Scryfall printing images for public Archidekt decks without rehosting community proxy art.
- Discovers public Google Drive folders and Imgur albums and presents their custom proxy images in an on-demand gallery above the decklist.
- Includes cached public Ko-fi previews for every Ko-fi-linked deck in the source sheet, while leaving every image on Ko-fi’s CDN.
- Downloads an available decklist as plain text or the visible catalog as CSV.
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

The importer downloads the workbook as `.xlsx` and reads the hyperlink relationships that are missing from Google's CSV export. It also refreshes visual previews for public Archidekt lists and public image manifests for Google Drive and Imgur sources. Gallery manifests are split into per-deck files under `public/data/galleries` so visitors only load custom-image metadata for the deck they open. Providers that block static imports remain linked from a clearly labeled fallback page until a community-maintained export is available.

## Best source compatibility

For the richest deck page, give each sheet row three public links:

- **Decklist:** a public Archidekt deck URL. Archidekt lists become visual stacks, searchable text lists, downloads, and card-inspector views. Moxfield and plain-text lists remain linked but are not imported into the visual workspace.
- **Proxy artwork:** a public Google Drive folder or a public/unlisted Imgur album. For Drive, set access to **Anyone with the link → Viewer**. PNG, JPG, WebP, and GIF files are supported, including images inside nested folders.
- **Credit and context:** the original Reddit post or creator page so visitors can reach the source directly.

Ko-fi storefront and post links stay available as creator links. Their public artwork is represented through the repository's curated preview cache because Ko-fi does not offer an unattended public product-reading API.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Deck records should be corrected at the [canonical community spreadsheet](https://docs.google.com/spreadsheets/d/1jkYdBdhP5s6yOirrgTSbBF9Qr1fum1-2gHOxNQCzFC4/edit?gid=0#gid=0) whenever possible. Repository issues and pull requests are best for importer, accessibility, design, and deployment improvements.

## Project boundaries

Proxy Vault is an independent community index. It is not affiliated with or endorsed by Wizards of the Coast. Community creators and linked platforms retain ownership of their work and content. The site does not rehost proxy packs or card art.
