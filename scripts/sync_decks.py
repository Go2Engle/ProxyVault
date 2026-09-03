#!/usr/bin/env python3
"""Download the canonical public workbook and convert it to site-ready JSON."""

from __future__ import annotations

import hashlib
import json
import re
import time
import urllib.error
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src" / "data" / "decks.json"
GALLERY_DIR = ROOT / "public" / "data" / "galleries"
SHEET_ID = "1jkYdBdhP5s6yOirrgTSbBF9Qr1fum1-2gHOxNQCzFC4"
SOURCE_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit?gid=0#gid=0"
EXPORT_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=xlsx"
ARCHIDEKT_DECK_RE = re.compile(r"https?://(?:www\.)?archidekt\.com/decks/(\d+)")
DRIVE_FOLDER_RE = re.compile(r"https?://drive\.google\.com/drive/(?:u/\d+/)?folders/([A-Za-z0-9_-]+)")
IMGUR_ALBUM_RE = re.compile(r"https?://(?:www\.)?imgur\.com/(?:a|gallery)/([^/?#]+)")
DRIVE_ITEM_RE = re.compile(
    r'\[\[null,"([A-Za-z0-9_-]{15,})"\],null,null,null,'
    r'"(image/(?:png|jpeg|gif|webp)|application/vnd\.google-apps\.folder)"'
)
DRIVE_NAME_RE = re.compile(r'\[\[\["((?:\\.|[^"\\])*)",null,1\]\]\]')

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
DOC_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def shared_strings(archive: zipfile.ZipFile) -> list[str]:
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return ["".join(node.text or "" for node in item.findall(".//m:t", NS)) for item in root.findall("m:si", NS)]


def relationships(archive: zipfile.ZipFile, sheet_number: int) -> dict[str, str]:
    path = f"xl/worksheets/_rels/sheet{sheet_number}.xml.rels"
    root = ET.fromstring(archive.read(path))
    return {
        node.attrib["Id"]: node.attrib.get("Target", "")
        for node in root.findall("r:Relationship", REL_NS)
        if node.attrib.get("TargetMode") == "External"
    }


def read_sheet(archive: zipfile.ZipFile, sheet_number: int, strings: list[str]) -> list[dict[str, str]]:
    root = ET.fromstring(archive.read(f"xl/worksheets/sheet{sheet_number}.xml"))
    rels = relationships(archive, sheet_number)
    links = {
        node.attrib["ref"]: rels.get(node.attrib.get(DOC_REL, ""), "")
        for node in root.findall(".//m:hyperlinks/m:hyperlink", NS)
    }
    rows: list[dict[str, str]] = []
    for row in root.findall(".//m:sheetData/m:row", NS):
        values: dict[str, str] = {}
        for cell in row.findall("m:c", NS):
            ref = cell.attrib["r"]
            column = re.match(r"[A-Z]+", ref).group(0)
            value_node = cell.find("m:v", NS)
            value = value_node.text if value_node is not None and value_node.text else ""
            if cell.attrib.get("t") == "s" and value:
                value = strings[int(value)]
            elif cell.attrib.get("t") == "inlineStr":
                value = "".join(node.text or "" for node in cell.findall(".//m:t", NS))
            values[column] = value.strip()
            if links.get(ref):
                values[f"{column}_url"] = links[ref]
        if values:
            rows.append(values)
    return rows


def stable_id(kind: str, row: dict[str, str]) -> str:
    seed = "|".join([kind, row.get("A", ""), row.get("B_url", ""), row.get("C_url", ""), row.get("D", "")])
    digest = hashlib.sha1(seed.encode("utf-8")).hexdigest()[:10]
    slug = re.sub(r"[^a-z0-9]+", "-", row.get("A", "").lower()).strip("-")[:48]
    return f"{slug}-{digest}"


def normalize(row: dict[str, str], kind: str) -> dict[str, object]:
    result: dict[str, object] = {
        "id": stable_id(kind, row),
        "kind": kind,
        "theme": row.get("A", ""),
        "deckSource": {"label": row.get("B", ""), "url": row.get("B_url", "")},
        "decklist": {"label": row.get("C", ""), "url": row.get("C_url", "")},
        "creator": {"label": row.get("D", ""), "url": row.get("D_url", "")},
        "notes": row.get("F" if kind == "deck" else "E", ""),
    }
    if kind == "deck":
        result["commanderArchetype"] = row.get("E", "")
        result["aiUse"] = row.get("G", "")
    return result


def scryfall_image_url(card_id: str, image_hash: str | int) -> str:
    if not re.fullmatch(r"[0-9a-f-]{36}", card_id, re.IGNORECASE):
        return ""
    return f"https://cards.scryfall.io/normal/front/{card_id[0]}/{card_id[1]}/{card_id}.jpg?{image_hash}"


def request_json(url: str) -> dict[str, object]:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json;q=0.9,*/*;q=0.8",
            "User-Agent": "ProxyVault/1.0 (+GitHub Pages community catalog)",
        },
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.load(response)


def drive_folder_items(folder_id: str) -> list[tuple[str, str, str]]:
    request = urllib.request.Request(
        f"https://drive.google.com/drive/folders/{folder_id}",
        headers={"User-Agent": "Mozilla/5.0 (compatible; ProxyVault/1.0; public folder index)"},
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        document = response.read().decode("utf-8", errors="replace")

    items: list[tuple[str, str, str]] = []
    seen: set[str] = set()
    for match in DRIVE_ITEM_RE.finditer(document):
        item_id, mime_type = match.groups()
        if item_id in seen:
            continue
        name_match = DRIVE_NAME_RE.search(document, match.end(), min(match.end() + 2600, len(document)))
        if not name_match:
            continue
        try:
            name = json.loads(f'"{name_match.group(1)}"')
        except ValueError:
            name = name_match.group(1)
        seen.add(item_id)
        items.append((item_id, str(name), mime_type))
    return items


def drive_gallery(source_url: str) -> dict[str, object] | None:
    match = DRIVE_FOLDER_RE.match(source_url)
    if not match:
        return None
    folders = [match.group(1)]
    visited: set[str] = set()
    images: list[dict[str, object]] = []
    image_ids: set[str] = set()
    max_images = 320
    max_folders = 32

    while folders and len(visited) < max_folders and len(images) < max_images:
        folder_id = folders.pop(0)
        if folder_id in visited:
            continue
        visited.add(folder_id)
        for item_id, name, mime_type in drive_folder_items(folder_id):
            if mime_type == "application/vnd.google-apps.folder":
                if item_id not in visited:
                    folders.append(item_id)
                continue
            if item_id in image_ids:
                continue
            image_ids.add(item_id)
            images.append(
                {
                    "id": item_id,
                    "name": name,
                    "image": f"https://drive.google.com/thumbnail?id={item_id}&sz=w1600",
                    "thumbnail": f"https://drive.google.com/thumbnail?id={item_id}&sz=w520",
                    "sourceUrl": f"https://drive.google.com/file/d/{item_id}/view",
                }
            )
            if len(images) >= max_images:
                break

    if not images:
        return None
    return {
        "provider": "Google Drive",
        "totalImages": len(images),
        "partial": bool(folders) or len(images) >= max_images,
        "images": images,
    }


def imgur_gallery(source_url: str) -> dict[str, object] | None:
    match = IMGUR_ALBUM_RE.match(source_url)
    if not match:
        return None
    album_id = match.group(1).split("-")[-1]
    payload = request_json(f"https://imgur.com/ajaxalbums/getimages/{album_id}/hit.json")
    source_images = ((payload.get("data") or {}).get("images") or [])
    images: list[dict[str, object]] = []
    for index, item in enumerate(source_images, start=1):
        image_id = str(item.get("hash") or "")
        extension = str(item.get("ext") or ".jpg")
        if not image_id or not re.fullmatch(r"\.[A-Za-z0-9]+", extension):
            continue
        images.append(
            {
                "id": image_id,
                "name": str(item.get("title") or f"Custom proxy {index}"),
                "image": f"https://i.imgur.com/{image_id}{extension}",
                "thumbnail": f"https://i.imgur.com/{image_id}h{extension}",
                "sourceUrl": f"https://imgur.com/{image_id}",
            }
        )
    if not images:
        return None
    return {
        "provider": "Imgur",
        "totalImages": len(images),
        "partial": False,
        "images": images,
    }


def proxy_gallery(source_url: str) -> dict[str, object] | None:
    if DRIVE_FOLDER_RE.match(source_url):
        return drive_gallery(source_url)
    if IMGUR_ALBUM_RE.match(source_url):
        return imgur_gallery(source_url)
    return None


def card_type(oracle: dict[str, object], source_categories: list[str]) -> str:
    if any(category.lower() == "commander" for category in source_categories):
        return "Commander"
    types = [str(value) for value in (oracle.get("types") or [])]
    for candidate in ["Creature", "Planeswalker", "Battle", "Instant", "Sorcery", "Artifact", "Enchantment", "Land"]:
        if candidate in types:
            return candidate
    return types[0] if types else "Other"


def archidekt_preview(deck_url: str) -> dict[str, object] | None:
    match = ARCHIDEKT_DECK_RE.match(deck_url)
    if not match:
        return None
    request = urllib.request.Request(
        f"https://archidekt.com/api/decks/{match.group(1)}/",
        headers={
            "Accept": "application/json;q=0.9,*/*;q=0.8",
            "User-Agent": "ProxyVault/1.0 (+GitHub Pages community catalog)",
        },
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        payload = json.load(response)

    included_categories = {
        str(category.get("name") or "")
        for category in payload.get("categories", [])
        if category.get("includedInDeck")
    }
    cards: list[dict[str, object]] = []
    for entry in payload.get("cards", []):
        printing = entry.get("card") or {}
        oracle = printing.get("oracleCard") or {}
        printing_id = str(printing.get("uid") or "")
        image_hash = printing.get("scryfallImageHash") or ""
        super_types = [str(value) for value in (oracle.get("superTypes") or [])]
        types = [str(value) for value in (oracle.get("types") or [])]
        sub_types = [str(value) for value in (oracle.get("subTypes") or [])]
        type_line = " ".join([*super_types, *types])
        if sub_types:
            type_line += f" — {' '.join(sub_types)}"
        source_categories = [str(value) for value in (entry.get("categories") or [])]
        if included_categories and source_categories and not included_categories.intersection(source_categories):
            continue
        cards.append(
            {
                "id": str(entry.get("id") or printing_id),
                "name": str(printing.get("displayName") or oracle.get("name") or "Unknown card"),
                "quantity": int(entry.get("quantity") or 1),
                "category": card_type(oracle, source_categories),
                "manaCost": str(oracle.get("manaCost") or ""),
                "manaValue": float(oracle.get("cmc") or 0),
                "typeLine": type_line.strip(),
                "image": scryfall_image_url(printing_id, image_hash) if printing_id and image_hash else "",
                "set": str((printing.get("edition") or {}).get("editioncode") or "").upper(),
                "collectorNumber": str(printing.get("collectorNumber") or ""),
            }
        )

    category_order = ["Commander", "Creature", "Planeswalker", "Battle", "Instant", "Sorcery", "Artifact", "Enchantment", "Land", "Other"]
    cards.sort(key=lambda card: (category_order.index(card["category"]) if card["category"] in category_order else 99, card["name"]))
    return {
        "provider": "Archidekt",
        "sourceDeckName": str(payload.get("name") or ""),
        "sourceUpdatedAt": str(payload.get("updatedAt") or ""),
        "totalCards": sum(int(card["quantity"]) for card in cards),
        "cards": cards,
    }


def enrich_previews(decks: list[dict[str, object]], existing: dict[str, dict[str, object]]) -> None:
    eligible = [deck for deck in decks if ARCHIDEKT_DECK_RE.match(str(deck["decklist"]["url"]))]
    for index, deck in enumerate(eligible, start=1):
        deck_id = str(deck["id"])
        try:
            preview = archidekt_preview(str(deck["decklist"]["url"]))
            if preview:
                deck["preview"] = preview
                print(f"  Preview {index}/{len(eligible)}: {deck['theme']}")
        except (OSError, ValueError, urllib.error.HTTPError, urllib.error.URLError) as error:
            cached = existing.get(deck_id, {}).get("preview")
            if cached:
                deck["preview"] = cached
                print(f"  Cached preview retained for {deck['theme']}: {error}")
            else:
                print(f"  Preview unavailable for {deck['theme']}: {error}")
        if index < len(eligible):
            time.sleep(0.15)


def enrich_galleries(decks: list[dict[str, object]], existing: dict[str, dict[str, object]]) -> None:
    eligible = [
        deck
        for deck in decks
        if DRIVE_FOLDER_RE.match(str(deck["deckSource"]["url"]))
        or IMGUR_ALBUM_RE.match(str(deck["deckSource"]["url"]))
    ]
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {
            executor.submit(proxy_gallery, str(deck["deckSource"]["url"])): deck
            for deck in eligible
        }
        completed = 0
        for future in as_completed(futures):
            deck = futures[future]
            completed += 1
            try:
                gallery = future.result()
                if gallery:
                    gallery_path = GALLERY_DIR / f"{deck['id']}.json"
                    GALLERY_DIR.mkdir(parents=True, exist_ok=True)
                    gallery_path.write_text(
                        json.dumps(gallery, indent=2, ensure_ascii=False) + "\n",
                        encoding="utf-8",
                    )
                    deck["customGallery"] = {
                        "provider": gallery["provider"],
                        "totalImages": gallery["totalImages"],
                        "partial": gallery["partial"],
                        "path": f"./data/galleries/{deck['id']}.json",
                    }
                    print(
                        f"  Gallery {completed}/{len(eligible)}: {deck['theme']} "
                        f"({gallery['totalImages']} images)"
                    )
                    continue
                raise ValueError("no public images discovered")
            except (OSError, ValueError, urllib.error.HTTPError, urllib.error.URLError) as error:
                cached = existing.get(str(deck["id"]), {}).get("customGallery")
                if cached:
                    gallery_path = GALLERY_DIR / f"{deck['id']}.json"
                    if cached.get("images"):
                        GALLERY_DIR.mkdir(parents=True, exist_ok=True)
                        gallery_path.write_text(
                            json.dumps(cached, indent=2, ensure_ascii=False) + "\n",
                            encoding="utf-8",
                        )
                    if gallery_path.exists():
                        deck["customGallery"] = {
                            "provider": cached["provider"],
                            "totalImages": cached["totalImages"],
                            "partial": cached.get("partial", False),
                            "path": f"./data/galleries/{deck['id']}.json",
                        }
                        print(f"  Cached gallery retained for {deck['theme']}: {error}")
                    else:
                        print(f"  Gallery unavailable for {deck['theme']}: {error}")
                else:
                    print(f"  Gallery unavailable for {deck['theme']}: {error}")


def main() -> None:
    existing: dict[str, dict[str, object]] = {}
    if OUTPUT.exists():
        try:
            previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
            existing = {str(deck["id"]): deck for deck in previous.get("decks", [])}
        except (OSError, ValueError, KeyError, TypeError):
            pass

    request = urllib.request.Request(EXPORT_URL, headers={"User-Agent": "ProxyVault/1.0 (+GitHub Pages data sync)"})
    with urllib.request.urlopen(request, timeout=45) as response:
        payload = response.read()
    if len(payload) > 10_000_000:
        raise RuntimeError("Workbook exceeds the 10 MB safety limit")

    workbook_path = ROOT / ".proxy-vault-source.xlsx"
    workbook_path.write_bytes(payload)
    try:
        with zipfile.ZipFile(workbook_path) as archive:
            strings = shared_strings(archive)
            deck_rows = read_sheet(archive, 1, strings)[1:]
            collection_rows = read_sheet(archive, 2, strings)[1:]
    finally:
        workbook_path.unlink(missing_ok=True)

    decks = [
        normalize(row, "deck")
        for row in deck_rows
        if row.get("A") and (row.get("B_url") or row.get("C_url") or row.get("E"))
    ]
    collections = [
        normalize(row, "collection")
        for row in collection_rows
        if row.get("A") and (row.get("B_url") or row.get("C_url") or row.get("D_url"))
    ]
    enrich_previews(decks, existing)
    enrich_galleries(decks, existing)
    document = {
        "source": SOURCE_URL,
        "decks": decks,
        "collections": collections,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(document, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Synced {len(decks)} decks and {len(collections)} collections to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
