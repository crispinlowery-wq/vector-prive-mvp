import csv
import io
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


@dataclass(frozen=True)
class LinkedInContactRecord:
    first_name: str
    last_name: str
    full_name: str
    linkedin_url: str
    company: str | None
    position: str | None
    connected_on: datetime | None


def read_linkedin_connections(export_path: str | Path) -> list[LinkedInContactRecord]:
    """Read only relationship fields; email and all other export files are ignored."""
    with zipfile.ZipFile(export_path) as archive:
        raw_lines = io.TextIOWrapper(archive.open("Connections.csv"), encoding="utf-8-sig").read().splitlines()
    header_index = next((index for index, line in enumerate(raw_lines) if line.startswith("First Name,")), None)
    if header_index is None:
        raise ValueError("Connections.csv does not contain the expected LinkedIn header")

    records: dict[str, LinkedInContactRecord] = {}
    for row in csv.DictReader(raw_lines[header_index:]):
        url = (row.get("URL") or "").strip()
        if not url or not url.startswith("https://www.linkedin.com/"):
            continue
        first_name = (row.get("First Name") or "").strip()
        last_name = (row.get("Last Name") or "").strip()
        full_name = " ".join(value for value in (first_name, last_name) if value).strip()
        if not full_name:
            continue
        connected_on = None
        if value := (row.get("Connected On") or "").strip():
            try:
                connected_on = datetime.strptime(value, "%d %b %Y").replace(tzinfo=timezone.utc)
            except ValueError:
                pass
        records[url] = LinkedInContactRecord(
            first_name=first_name,
            last_name=last_name,
            full_name=full_name,
            linkedin_url=url,
            company=(row.get("Company") or "").strip() or None,
            position=(row.get("Position") or "").strip() or None,
            connected_on=connected_on,
        )
    return list(records.values())
