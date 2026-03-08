"""company join requests

Revision ID: 0009_company_join_requests
Revises: 0008_create_company_locks
Create Date: 2026-02-25
"""

from alembic import op
import sqlalchemy as sa


# OBS:
# - revision ska vara unikt
# - down_revision måste matcha revision-id på din senaste migration (0008...)
revision = '0009_company_join_requests'
down_revision = '0008_create_company_locks'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'company_join_requests',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('requester_user_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='PENDING'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['requester_user_id'], ['users.id'], ondelete='CASCADE'),
    )

    op.create_index('ix_joinreq_company', 'company_join_requests', ['company_id'])
    op.create_index('ix_joinreq_requester', 'company_join_requests', ['requester_user_id'])
    op.create_index('ix_joinreq_status', 'company_join_requests', ['status'])


def downgrade():
    op.drop_index('ix_joinreq_status', table_name='company_join_requests')
    op.drop_index('ix_joinreq_requester', table_name='company_join_requests')
    op.drop_index('ix_joinreq_company', table_name='company_join_requests')
    op.drop_table('company_join_requests')