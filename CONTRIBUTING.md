# Contributing to Proxy Vault

Thanks for helping keep the archive useful and creator-friendly.

## Deck data and corrections

The [community Google Sheet](https://docs.google.com/spreadsheets/d/1jkYdBdhP5s6yOirrgTSbBF9Qr1fum1-2gHOxNQCzFC4/edit?gid=0#gid=0) is the canonical data source. If you can edit it, make deck additions and link corrections there. The GitHub Pages workflow downloads the workbook daily and updates `src/data/decks.json` automatically.

If you cannot edit the sheet, open a **Deck correction** issue with the deck name, the field that needs changing, and a supporting creator/source link.

Please preserve:

- the creator's name and original source post;
- separate links for proxy files and the playable decklist;
- notes about tokens, card backs, bonus cards, banned cards, or missing files; and
- the sheet's existing conventions.

## Site changes

1. Install Node.js 22 or newer.
2. Run `npm ci`.
3. Run `npm run dev` and make your change.
4. Run `npm run build` before opening a pull request.

Keep the site static and privacy-friendly. Do not add analytics, accounts, secrets, or paid infrastructure. New dependencies should be necessary, small, and browser-safe.

## Data importer changes

Run `python3 scripts/sync_decks.py`, then inspect the generated JSON and confirm the terminal reports the expected deck and collection counts. The importer intentionally reads hyperlink metadata from the `.xlsx` export because Google's CSV export discards hyperlink targets.

## Rights and credit

Proxy Vault indexes third-party links; it does not claim ownership of community-created cards, posts, decklists, franchises, or source files. Never rehost a creator's artwork without permission. Keep direct attribution intact.
