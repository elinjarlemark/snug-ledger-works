"""create customers and products tables

Revision ID: 0003_create_customers_products
Revises: 0002_create_companies
Create Date: 2026-02-11
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_create_customers_products"
down_revision = "0002_create_companies"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=True),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("organization_number", sa.String(length=20), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("address", sa.String(length=255), nullable=False),
        sa.Column("postal_code", sa.String(length=20), nullable=False),
        sa.Column("city", sa.String(length=255), nullable=False),
        sa.Column("country", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
    )
    op.create_index("ix_customers_id", "customers", ["id"], unique=False)

    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("includes_vat", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("vat_rate", sa.Float(), nullable=False, server_default="25"),
        sa.Column("unit", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
    )
    op.create_index("ix_products_id", "products", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_products_id", table_name="products")
    op.drop_table("products")
    op.drop_index("ix_customers_id", table_name="customers")
    op.drop_table("customers")
