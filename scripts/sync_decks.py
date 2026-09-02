#!/usr/bin/env python3
"""Download the canonical public workbook and convert it to site-ready JSON."""

from __future__ import annotations

import hashlib
import json
import re
import urllib.request
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src" / "data" / "decks.json"
SHEET_ID = "1jkYdBdhP5s6yOirrgTSbBF9Qr1fum1-2gHOxNQCzFC4"
SOURCE_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit?gid=0#gid=0"
EXPORT_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=xlsx"

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


def main() -> None:
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
