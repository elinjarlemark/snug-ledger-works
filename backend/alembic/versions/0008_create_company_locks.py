"""create company_locks table

Revision ID: 0008_create_company_locks
Revises: 0007_add_user_name_column
Create Date: 2026-02-24
"""

from alembic import op
import sqlalchemy as sa


revision = "0008_create_company_locks"
down_revision = "0007_add_user_name_column"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "company_locks",
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("locked_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("locked_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_company_locks_company_id", "company_locks", ["company_id"], unique=True)
    op.create_index("ix_company_locks_locked_by_user_id", "company_locks", ["locked_by_user_id"], unique=False)
    op.create_index("ix_company_locks_expires_at", "company_locks", ["expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_company_locks_expires_at", table_name="company_locks")
    op.drop_index("ix_company_locks_locked_by_user_id", table_name="company_locks")
    op.drop_index("ix_company_locks_company_id", table_name="company_locks")
    op.drop_table("company_locks")