"""Add internal voucher series and fiscal-year scoped number sequences.

Revision ID: 0013_voucher_series
Revises: 0012_posted_voucher_records

The immutable payload snapshots created in revision 0012 are deliberately not
rewritten. Existing posted vouchers are assigned internal series A in dedicated
SQL columns, while original SIE series/number metadata remains untouched in the
payload.
"""

import json
from datetime import date

from alembic import op
import sqlalchemy as sa


revision = "0013_voucher_series"
down_revision = "0012_posted_voucher_records"
branch_labels = None
depends_on = None


DEFAULT_SERIES = "A"


def _fiscal_start_month_day(value: str | None) -> tuple[int, int]:
    """Return the configured fiscal-year start as (month, day).

    AccountPro normally stores this setting as MM-DD (for example 01-01), but
    accepting YYYY-MM-DD as well makes the migration tolerant of older/imported
    data without silently guessing from malformed values.
    """
    raw = (value or "01-01").strip()

    if len(raw) == 5 and raw[2] == "-":
        month_text, day_text = raw.split("-", 1)
    elif len(raw) == 10 and raw[4] == "-" and raw[7] == "-":
        month_text, day_text = raw[5:7], raw[8:10]
    else:
        raise ValueError(f"Ogiltig räkenskapsårsstart: {value!r}")

    month = int(month_text)
    day = int(day_text)

    # Year 2000 is used only to validate month/day and permits 29 February.
    date(2000, month, day)
    return month, day


def _fiscal_year_start(posting_date: str, configured_start: str | None) -> str:
    """Return the ISO date identifying the fiscal year containing posting_date."""
    transaction_date = date.fromisoformat(posting_date)
    month, day = _fiscal_start_month_day(configured_start)

    start_year = transaction_date.year
    if (transaction_date.month, transaction_date.day) < (month, day):
        start_year -= 1

    try:
        start_date = date(start_year, month, day)
    except ValueError as exc:
        # A 29 February fiscal-year start cannot exist in every start year.
        # Refuse to invent another date because that could put vouchers in the
        # wrong numbering period.
        raise ValueError(
            f"Räkenskapsåret kan inte börja {month:02d}-{day:02d} år {start_year}"
        ) from exc

    return start_date.isoformat()


def upgrade() -> None:
    # Default series used by manually created vouchers. Automatic flows may use
    # their own series (for example B for customer invoices) later in the code.
    op.add_column(
        "companies",
        sa.Column(
            "default_voucher_series",
            sa.String(length=10),
            nullable=False,
            server_default=DEFAULT_SERIES,
        ),
    )

    # Internal AccountPro identity for an immutable posted voucher.
    op.add_column(
        "posted_voucher_records",
        sa.Column(
            "series",
            sa.String(length=10),
            nullable=False,
            server_default=DEFAULT_SERIES,
        ),
    )
    op.add_column(
        "posted_voucher_records",
        sa.Column("fiscal_year_start", sa.String(length=10), nullable=True),
    )

    connection = op.get_bind()

    # Backfill only the new SQL metadata. payload_json is an immutable original
    # from revision 0012 and must not be rewritten by a schema migration.
    records = connection.execute(
        sa.text(
            """
            SELECT
                p.id,
                p.company_id,
                p.payload_json,
                c.fiscal_year_start AS configured_fiscal_year_start
            FROM posted_voucher_records AS p
            JOIN companies AS c ON c.id = p.company_id
            ORDER BY p.id
            """
        )
    ).mappings().all()

    for record in records:
        try:
            payload = json.loads(record["payload_json"])
            posting_date = payload["date"]
            fiscal_start = _fiscal_year_start(
                posting_date,
                record["configured_fiscal_year_start"],
            )
        except (TypeError, KeyError, ValueError, json.JSONDecodeError) as exc:
            raise RuntimeError(
                "Kan inte bestämma räkenskapsåret för befintlig verifikation "
                f"{record['id']} i företag {record['company_id']}. "
                "Migreringen har därför avbrutits utan att originalverifikationen "
                "skrivits om."
            ) from exc

        connection.execute(
            sa.text(
                """
                UPDATE posted_voucher_records
                SET fiscal_year_start = :fiscal_start
                WHERE id = :record_id
                """
            ),
            {"fiscal_start": fiscal_start, "record_id": record["id"]},
        )

    op.alter_column(
        "posted_voucher_records",
        "fiscal_year_start",
        existing_type=sa.String(length=10),
        nullable=False,
    )

    # The old rule made a voucher number unique for the company's entire life.
    # The new accounting identity is company + fiscal year + series + number.
    op.drop_constraint(
        "uq_posted_voucher_company_number",
        "posted_voucher_records",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_posted_voucher_company_year_series_number",
        "posted_voucher_records",
        ["company_id", "fiscal_year_start", "series", "voucher_number"],
    )
    op.create_index(
        "ix_posted_voucher_company_year_series",
        "posted_voucher_records",
        ["company_id", "fiscal_year_start", "series"],
    )

    # Counter table used for atomic number allocation. Keeping counters outside
    # the JSON workspace prevents two simultaneous postings from both receiving
    # the same next number.
    op.create_table(
        "voucher_number_sequences",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("fiscal_year_start", sa.String(length=10), nullable=False),
        sa.Column("series", sa.String(length=10), nullable=False),
        sa.Column("last_number", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "company_id",
            "fiscal_year_start",
            "series",
            name="uq_voucher_number_sequence_company_year_series",
        ),
    )
    op.create_index(
        "ix_voucher_number_sequences_company",
        "voucher_number_sequences",
        ["company_id"],
    )

    # Seed each counter from existing immutable records. Number 0 is reserved
    # for imported opening balance and therefore leaves last_number at 0 when it
    # is the only record in a period.
    connection.execute(
        sa.text(
            """
            INSERT INTO voucher_number_sequences
                (company_id, fiscal_year_start, series, last_number)
            SELECT
                company_id,
                fiscal_year_start,
                series,
                MAX(CASE WHEN voucher_number > 0 THEN voucher_number ELSE 0 END)
            FROM posted_voucher_records
            GROUP BY company_id, fiscal_year_start, series
            """
        )
    )


def downgrade() -> None:
    connection = op.get_bind()

    # Revision 0012 required voucher numbers to be unique across every series
    # and fiscal year. Once later data uses A1/B1 or A1 in multiple years, that
    # schema cannot represent the data safely. Refuse a destructive downgrade.
    duplicate = connection.execute(
        sa.text(
            """
            SELECT company_id, voucher_number
            FROM posted_voucher_records
            GROUP BY company_id, voucher_number
            HAVING COUNT(*) > 1
            LIMIT 1
            """
        )
    ).first()
    if duplicate:
        raise RuntimeError(
            "Nedgradering till 0012 är inte möjlig eftersom samma "
            "verifikationsnummer används i flera serier eller räkenskapsår. "
            "Ingen bokförd verifikation har ändrats."
        )

    op.drop_index(
        "ix_voucher_number_sequences_company",
        table_name="voucher_number_sequences",
    )
    op.drop_table("voucher_number_sequences")

    op.drop_index(
        "ix_posted_voucher_company_year_series",
        table_name="posted_voucher_records",
    )
    op.drop_constraint(
        "uq_posted_voucher_company_year_series_number",
        "posted_voucher_records",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_posted_voucher_company_number",
        "posted_voucher_records",
        ["company_id", "voucher_number"],
    )

    op.drop_column("posted_voucher_records", "fiscal_year_start")
    op.drop_column("posted_voucher_records", "series")
    op.drop_column("companies", "default_voucher_series")
