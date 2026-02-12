"""
Utility script to build `data_simplified.json` from `data.json`.

For each record, the simplified output keeps:
- `id`
- `politifact_headline`
- `rational`: `social_text` followed by a newline and the `politifact_subheadline`
- `external_links_info`
- every field whose key starts with `ooc_`
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List


BASE_DIR = Path(__file__).resolve().parent
INPUT_FILE = BASE_DIR / "data.json"
OUTPUT_FILE = BASE_DIR / "data_simplified.json"


def build_rational(entry: Dict[str, Any]) -> str:
    social_text = entry.get("social_text") or ""
    subheadline = entry.get("politifact_subheadline") or ""

    if social_text and subheadline:
        return f"{social_text}\n{subheadline}"

    return social_text or subheadline


def collect_ooc_fields(entry: Dict[str, Any]) -> Iterable[tuple[str, Any]]:
    for key, value in entry.items():
        if key.startswith("ooc_"):
            yield key, value


def simplify_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    simplified: Dict[str, Any] = {
        "id": entry.get("id"),
        "politifact_headline": entry.get("politifact_headline"),
        "rational": build_rational(entry),
        "external_links_info": entry.get("external_links_info", []),
    }

    for key, value in collect_ooc_fields(entry):
        simplified[key] = value

    return simplified


def load_data(path: Path) -> List[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)
    if not isinstance(data, list):
        raise ValueError("Expected top-level JSON array.")
    return data


def write_data(path: Path, data: List[Dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=2, ensure_ascii=True)
        file.write("\n")


def main() -> None:
    entries = load_data(INPUT_FILE)
    simplified_entries = [simplify_entry(entry) for entry in entries]
    write_data(OUTPUT_FILE, simplified_entries)


if __name__ == "__main__":
    main()

