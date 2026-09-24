"""Add structured client onboarding profile.

Revision ID: 20260831_04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260831_04"
down_revision = "20260827_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("clients")}
    if "profile_data" not in columns:
        op.add_column(
            "clients",
            sa.Column("profile_data", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        )
    if "onboarding_completed_at" not in columns:
        op.add_column("clients", sa.Column("onboarding_completed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("clients", "onboarding_completed_at")
    op.drop_column("clients", "profile_data")
