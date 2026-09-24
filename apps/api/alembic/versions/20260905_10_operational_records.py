"""Persist shared operational continuity records.

Revision ID: 20260905_10
Revises: 20260905_09
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260905_10"
down_revision = "20260905_09"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "operational_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("kind", sa.String(length=48), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="SET NULL")),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("requests.id", ondelete="CASCADE")),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_accounts.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_operational_records_kind", "operational_records", ["kind"])
    op.create_index("ix_operational_records_client_id", "operational_records", ["client_id"])
    op.create_index("ix_operational_records_request_id", "operational_records", ["request_id"])
    op.create_index("ix_operational_records_status", "operational_records", ["status"])
    op.create_index("ix_operational_records_created_by_user_id", "operational_records", ["created_by_user_id"])


def downgrade() -> None:
    op.drop_table("operational_records")
