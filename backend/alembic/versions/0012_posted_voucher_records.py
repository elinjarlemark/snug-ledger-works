"""Append-only snapshots of posted vouchers, independent of the workspace JSON."""
from alembic import op
import sqlalchemy as sa

revision = '0012_posted_voucher_records'
down_revision = '0011_workspace_state'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'posted_voucher_records',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('company_id', sa.Integer, sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('voucher_id', sa.String(80), nullable=False),
        sa.Column('voucher_number', sa.Integer, nullable=False),
        sa.Column('payload_json', sa.Text, nullable=False),
        sa.Column('registered_by_user_id', sa.Integer, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('registered_at', sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('company_id', 'voucher_id', name='uq_posted_voucher_company_id'),
        sa.UniqueConstraint('company_id', 'voucher_number', name='uq_posted_voucher_company_number'),
    )
    op.create_index('ix_posted_voucher_company', 'posted_voucher_records', ['company_id'])


def downgrade():
    op.drop_index('ix_posted_voucher_company', table_name='posted_voucher_records')
    op.drop_table('posted_voucher_records')
