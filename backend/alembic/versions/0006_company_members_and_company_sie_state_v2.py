"""company members + company root + sie state per company

Revision ID: 0006_company_members_and_company_sie_state_v2
Revises: 0005_create_company_sie_states
Create Date: 2026-02-22
"""

from alembic import op
import sqlalchemy as sa


revision = "0006_company_members_and_company_sie_state_v2"
down_revision = "0005_create_company_sie_states"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Create company_members
    op.create_table(
        "company_members",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False, server_default="MEMBER"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "user_id", name="uq_company_members_company_user"),
    )
    op.create_index("ix_company_members_company_id", "company_members", ["company_id"], unique=False)
    op.create_index("ix_company_members_user_id", "company_members", ["user_id"], unique=False)
    op.create_index("ix_company_members_id", "company_members", ["id"], unique=False)

    # 2) Backfill membership from existing companies.user_id as OWNER
    # (Assumes old schema had companies.user_id)
    op.execute(
        """
        INSERT INTO company_members (company_id, user_id, role, status, created_at)
        SELECT c.id, c.user_id, 'OWNER', 'ACTIVE', NOW()
        FROM companies c
        WHERE c.user_id IS NOT NULL
        ON CONFLICT (company_id, user_id) DO NOTHING;
        """
    )

    # 3) Make organization_number unique (Postgres unique allows multiple NULLs)
    op.create_unique_constraint(
        "uq_companies_organization_number",
        "companies",
        ["organization_number"],
    )

    # 4) Drop companies.user_id (remove FK then column)
    # Depending on how the FK was named in earlier migrations, we drop by inspecting default naming.
    # In many cases it's "companies_user_id_fkey" on Postgres.
    try:
        op.drop_constraint("companies_user_id_fkey", "companies", type_="foreignkey")
    except Exception:
        # If constraint name differs, ignore and proceed (manual fix may be needed)
        pass
    try:
        op.drop_column("companies", "user_id")
    except Exception:
        # If already dropped or not present, ignore
        pass

    # 5) CompanySIEState: make it per-company instead of per-user
    # 5a) Deduplicate so only one row per company remains (keep newest)
    op.execute(
        """
        DELETE FROM company_sie_states
        WHERE id NOT IN (
          SELECT DISTINCT ON (company_id) id
          FROM company_sie_states
          ORDER BY company_id, updated_at DESC NULLS LAST, id DESC
        );
        """
    )

    # 5b) Add version + updated_by_user_id
    op.add_column("company_sie_states", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("company_sie_states", sa.Column("updated_by_user_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_company_sie_states_updated_by_user_id",
        "company_sie_states",
        "users",
        ["updated_by_user_id"],
        ["id"],
    )

    # 5c) Copy old user_id (if exists) into updated_by_user_id, then drop user_id + old unique constraint
    op.execute(
        """
        UPDATE company_sie_states
        SET updated_by_user_id = user_id
        WHERE updated_by_user_id IS NULL;
        """
    )

    # Drop old unique constraint user+company if present
    try:
        op.drop_constraint("uq_company_sie_states_user_company", "company_sie_states", type_="unique")
    except Exception:
        pass

    # Drop old user_id column if present
    try:
        op.drop_constraint("company_sie_states_user_id_fkey", "company_sie_states", type_="foreignkey")
    except Exception:
        pass
    try:
        op.drop_column("company_sie_states", "user_id")
    except Exception:
        pass

    # Add new unique constraint on company_id
    op.create_unique_constraint(
        "uq_company_sie_states_company",
        "company_sie_states",
        ["company_id"],
    )


def downgrade() -> None:
    # Reverse unique on company_sie_states.company_id
    try:
        op.drop_constraint("uq_company_sie_states_company", "company_sie_states", type_="unique")
    except Exception:
        pass

    # Re-add user_id to company_sie_states (legacy)
    op.add_column("company_sie_states", sa.Column("user_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "company_sie_states_user_id_fkey",
        "company_sie_states",
        "users",
        ["user_id"],
        ["id"],
    )
    op.create_unique_constraint(
        "uq_company_sie_states_user_company",
        "company_sie_states",
        ["user_id", "company_id"],
    )

    # Remove updated_by_user_id + version
    try:
        op.drop_constraint("fk_company_sie_states_updated_by_user_id", "company_sie_states", type_="foreignkey")
    except Exception:
        pass
    op.drop_column("company_sie_states", "updated_by_user_id")
    op.drop_column("company_sie_states", "version")

    # Re-add companies.user_id (legacy)
    op.add_column("companies", sa.Column("user_id", sa.Integer(), nullable=True))
    op.create_foreign_key("companies_user_id_fkey", "companies", "users", ["user_id"], ["id"])

    # Drop unique org constraint
    try:
        op.drop_constraint("uq_companies_organization_number", "companies", type_="unique")
    except Exception:
        pass

    # Drop company_members
    op.drop_index("ix_company_members_id", table_name="company_members")
    op.drop_index("ix_company_members_user_id", table_name="company_members")
    op.drop_index("ix_company_members_company_id", table_name="company_members")
    op.drop_table("company_members")
