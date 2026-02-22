"""create company_sie_states table

Revision ID: 0005_create_company_sie_states
Revises: 0004_add_accounting_standard_to_companies
Create Date: 2026-02-22
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_create_company_sie_states"
down_revision = "0004_add_accounting_standard_to_companies"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "company_sie_states",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("sie_content", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "company_id", name="uq_company_sie_states_user_company"),
    )
    op.create_index("ix_company_sie_states_id", "company_sie_states", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_company_sie_states_id", table_name="company_sie_states")
    op.drop_table("company_sie_states")
