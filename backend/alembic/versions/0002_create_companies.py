"""create companies table

Revision ID: 0002_create_companies
Revises: 0001_create_tables
Create Date: 2026-02-05
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_create_companies"
down_revision = "0001_create_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("organization_number", sa.String(length=20), nullable=True),
        sa.Column("address", sa.String(length=255), nullable=True),
        sa.Column("postal_code", sa.String(length=20), nullable=True),
        sa.Column("city", sa.String(length=255), nullable=True),
        sa.Column("country", sa.String(length=255), nullable=True),
        sa.Column("vat_number", sa.String(length=50), nullable=True),
        sa.Column("fiscal_year_start", sa.String(length=10), nullable=True),
        sa.Column("fiscal_year_end", sa.String(length=10), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_companies_id", "companies", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_companies_id", table_name="companies")
    op.drop_table("companies")
