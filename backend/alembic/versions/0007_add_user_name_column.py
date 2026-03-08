"""add users.name column (safe if already exists)

Revision ID: 0007_add_user_name_column
Revises: 0006_company_members_and_company_sie_state_v2
Create Date: 2026-02-23
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "0007_add_user_name_column"
down_revision = "0006_company_members_and_company_sie_state_v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Check if column already exists
    exists = conn.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'users'
              AND column_name = 'name'
            LIMIT 1;
            """
        )
    ).fetchone()

    if exists:
        # Column already exists; do nothing
        return

    op.add_column("users", sa.Column("name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()

    exists = conn.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'users'
              AND column_name = 'name'
            LIMIT 1;
            """
        )
    ).fetchone()

    if not exists:
        return

    op.drop_column("users", "name")