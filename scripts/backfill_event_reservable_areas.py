#!/usr/bin/env python3
"""
Backfill `events.has_reservable_areas` using the same fallback logic as the app CTA.

Usage:
  DATABASE_URL=... python3 scripts/backfill_event_reservable_areas.py --preview
  DATABASE_URL=... python3 scripts/backfill_event_reservable_areas.py --apply

If DATABASE_URL is not set, the script will try to read it from `rust_BE/.env`.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import pg8000.native


ZERO_PRICE_SQL = r"""
regexp_replace(COALESCE(e.price, ''), '[^0-9,.-]', '', 'g') IN ('', '0', '0.0', '0.00', '0,0', '0,00')
"""

HAS_TABLES_SQL = r"""
EXISTS (
    SELECT 1
    FROM tables t
    LEFT JOIN areas a ON a.id = t.area_id
    WHERE t.event_id = e.id
       OR (
            t.event_id IS NULL
            AND e.club_id IS NOT NULL
            AND a.club_id = e.club_id
       )
)
"""


def load_database_url() -> str:
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return env_url

    env_file = Path(__file__).resolve().parents[1] / "rust_BE" / ".env"
    if not env_file.exists():
        raise RuntimeError("DATABASE_URL is not set and rust_BE/.env was not found")

    for raw_line in env_file.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() == "DATABASE_URL":
            return value.strip().strip("\"'")

    raise RuntimeError("DATABASE_URL was not found in rust_BE/.env")


def connect(url: str) -> pg8000.native.Connection:
    parsed = urlparse(url)
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise RuntimeError(f"Unsupported DATABASE_URL scheme: {parsed.scheme}")

    return pg8000.native.Connection(
        user=parsed.username or "",
        password=parsed.password or "",
        host=parsed.hostname or "",
        port=parsed.port or 5432,
        database=(parsed.path or "/postgres").lstrip("/"),
        ssl_context=True,
    )


def fetch_preview_rows(conn: pg8000.native.Connection, limit: int = 20):
    query = f"""
    SELECT
        e.title,
        e.price,
        e.entry_type,
        e.ticketing_mode,
        e.has_reservable_areas,
        {HAS_TABLES_SQL} AS computed_has_reservable_areas
    FROM events e
    WHERE {ZERO_PRICE_SQL}
      AND {HAS_TABLES_SQL}
      AND e.has_reservable_areas IS DISTINCT FROM {HAS_TABLES_SQL}
    ORDER BY e.title
    LIMIT :limit
    """
    return conn.run(query, limit=limit)


def count_inconsistent_rows(conn: pg8000.native.Connection) -> int:
    query = f"""
    SELECT COUNT(*)
    FROM events e
    WHERE e.has_reservable_areas IS DISTINCT FROM {HAS_TABLES_SQL}
    """
    row = conn.run(query)[0]
    return int(row[0] if isinstance(row, (list, tuple)) else row)


def count_zero_price_with_tables(conn: pg8000.native.Connection) -> int:
    query = f"""
    SELECT COUNT(*)
    FROM events e
    WHERE {ZERO_PRICE_SQL}
      AND {HAS_TABLES_SQL}
    """
    row = conn.run(query)[0]
    return int(row[0] if isinstance(row, (list, tuple)) else row)


def apply_backfill(conn: pg8000.native.Connection) -> int:
    query = f"""
    WITH updated AS (
        UPDATE events e
        SET has_reservable_areas = {HAS_TABLES_SQL},
            updated_at = NOW()
        WHERE e.has_reservable_areas IS DISTINCT FROM {HAS_TABLES_SQL}
        RETURNING 1
    )
    SELECT COUNT(*) FROM updated
    """
    result = conn.run(query)
    return int(result[0][0])


def print_preview(conn: pg8000.native.Connection) -> None:
    inconsistent = count_inconsistent_rows(conn)
    zero_price_with_tables = count_zero_price_with_tables(conn)
    preview_rows = fetch_preview_rows(conn)

    print(f"inconsistent_events={inconsistent}")
    print(f"zero_price_with_tables={zero_price_with_tables}")
    print("sample_zero_price_rows_with_wrong_flag=")
    if not preview_rows:
        print("  none")
        return

    for row in preview_rows:
        print(
            "  "
            + repr(
                {
                    "title": row[0],
                    "price": row[1],
                    "entry_type": row[2],
                    "ticketing_mode": row[3],
                    "has_reservable_areas": row[4],
                    "computed_has_reservable_areas": row[5],
                }
            )
        )


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--preview", action="store_true", help="Preview affected rows")
    mode.add_argument("--apply", action="store_true", help="Apply the backfill")
    args = parser.parse_args(argv)

    if not args.preview and not args.apply:
        args.preview = True

    url = load_database_url()
    conn = connect(url)

    try:
        print_preview(conn)

        if not args.apply:
            return 0

        conn.run("BEGIN")
        updated_rows = apply_backfill(conn)
        conn.run("COMMIT")
        print("backfill_applied=true")
        print(f"updated_rows={updated_rows}")
        print_preview(conn)
        return 0
    except Exception:
        try:
            conn.run("ROLLBACK")
        except Exception:
            pass
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"error={exc}", file=sys.stderr)
        raise SystemExit(1)
