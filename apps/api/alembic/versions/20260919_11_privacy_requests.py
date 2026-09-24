"""Add auditable client privacy requests.

Revision ID: 20260919_11
Revises: 20260905_10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260919_11"
down_revision = "20260905_10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "privacy_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("request_type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="received"),
        sa.Column("note", sa.Text()),
        sa.Column("handled_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_accounts.id", ondelete="SET NULL")),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_privacy_requests_client_id", "privacy_requests", ["client_id"])
    op.create_index("ix_privacy_requests_request_type", "privacy_requests", ["request_type"])
    op.create_index("ix_privacy_requests_status", "privacy_requests", ["status"])


def downgrade() -> None:
    op.drop_table("privacy_requests")
