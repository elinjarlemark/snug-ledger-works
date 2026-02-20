"""add accounting_standard to companies

Revision ID: 0004_add_accounting_standard_to_companies
Revises: 0003_create_customers_products
Create Date: 2026-02-12
"""

from alembic import op
import sqlalchemy as sa

revision = "0004_add_accounting_standard_to_companies"
down_revision = "0003_create_customers_products"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("accounting_standard", sa.String(length=2), nullable=True))


def downgrade() -> None:
    op.drop_column("companies", "accounting_standard")
