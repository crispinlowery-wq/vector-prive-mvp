#!/usr/bin/env python3
import argparse
import asyncio
import sys
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.database import engine, SessionLocal
from app.models import Base, NetworkContact
from app.services.linkedin_contacts import read_linkedin_connections


async def import_contacts(export_path: Path) -> int:
    records = read_linkedin_connections(export_path)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with SessionLocal() as session:
        for start in range(0, len(records), 750):
            values = [
                {
                    "first_name": record.first_name,
                    "last_name": record.last_name,
                    "full_name": record.full_name,
                    "linkedin_url": record.linkedin_url,
                    "company": record.company,
                    "position": record.position,
                    "connected_on": record.connected_on,
                    "source": "linkedin_export",
                    "relationship_status": "connection",
                }
                for record in records[start:start + 750]
            ]
            statement = insert(NetworkContact).values(values)
            statement = statement.on_conflict_do_update(
                index_elements=[NetworkContact.linkedin_url],
                set_={
                    "first_name": statement.excluded.first_name,
                    "last_name": statement.excluded.last_name,
                    "full_name": statement.excluded.full_name,
                    "company": statement.excluded.company,
                    "position": statement.excluded.position,
                    "connected_on": statement.excluded.connected_on,
                },
            )
            await session.execute(statement)
        await session.commit()
    return len(records)


def main() -> None:
    parser = argparse.ArgumentParser(description="Import LinkedIn connections into Vector's private operator directory")
    parser.add_argument("export", type=Path, help="Path to the LinkedIn Basic Data Export ZIP")
    args = parser.parse_args()
    if not args.export.is_file():
        raise SystemExit(f"Export not found: {args.export}")
    count = asyncio.run(import_contacts(args.export))
    print(f"Imported or updated {count} LinkedIn contacts. Email addresses and messages were not read.")


if __name__ == "__main__":
    main()
