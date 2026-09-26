"""Persist browser application state per company and per user."""
from alembic import op
import sqlalchemy as sa

revision = "0011_workspace_state"
down_revision = "0010_company_lock_takeover_requests"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "workspace_states",
        sa.Column("scope", sa.String(100), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("values_json", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
    )


def downgrade():
    op.drop_table("workspace_states")
