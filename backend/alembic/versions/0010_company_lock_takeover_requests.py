"""company lock takeover requests

Revision ID: 0010_company_lock_takeover_requests
Revises: 0009_company_join_requests
Create Date: 2026-03-03
"""

from alembic import op
import sqlalchemy as sa


revision = "0010_company_lock_takeover_requests"
down_revision = "0009_company_join_requests"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "company_lock_takeover_requests",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("requested_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="PENDING"),
        sa.Column("created_at", sa.DateTime(timezone=False), nullable=False, server_default=sa.text("now()")),
        sa.Column("expires_at", sa.DateTime(timezone=False), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=False), nullable=True),
        sa.Column("decided_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.UniqueConstraint(
            "company_id",
            "requested_by_user_id",
            "status",
            name="uq_takeover_company_user_status",
        ),
    )

    op.create_index("ix_takeover_company", "company_lock_takeover_requests", ["company_id"])
    op.create_index("ix_takeover_requester", "company_lock_takeover_requests", ["requested_by_user_id"])
    op.create_index("ix_takeover_status", "company_lock_takeover_requests", ["status"])
    op.create_index("ix_takeover_expires_at", "company_lock_takeover_requests", ["expires_at"])


def downgrade():
    op.drop_index("ix_takeover_expires_at", table_name="company_lock_takeover_requests")
    op.drop_index("ix_takeover_status", table_name="company_lock_takeover_requests")
    op.drop_index("ix_takeover_requester", table_name="company_lock_takeover_requests")
    op.drop_index("ix_takeover_company", table_name="company_lock_takeover_requests")
    op.drop_table("company_lock_takeover_requests")