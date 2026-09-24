"""Add secure WhatsApp channel ingestion.

Revision ID: 20260826_02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260826_02"
down_revision = "20260826_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    message_columns = {column["name"] for column in inspector.get_columns("messages")}
    if "delivery_status" not in message_columns:
        op.add_column("messages", sa.Column("delivery_status", sa.String(length=32), nullable=True))

    if "inbound_webhook_events" not in inspector.get_table_names():
        op.create_table(
            "inbound_webhook_events",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("provider", sa.String(length=32), nullable=False),
            sa.Column("external_id", sa.String(length=200), nullable=False),
            sa.Column("sender", sa.String(length=40), nullable=True),
            sa.Column("message_type", sa.String(length=32), nullable=False),
            sa.Column("body", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("payload_summary", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["request_id"], ["requests.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("external_id"),
        )
        op.create_index("ix_inbound_webhook_events_provider", "inbound_webhook_events", ["provider"])
        op.create_index("ix_inbound_webhook_events_external_id", "inbound_webhook_events", ["external_id"], unique=True)
        op.create_index("ix_inbound_webhook_events_sender", "inbound_webhook_events", ["sender"])
        op.create_index("ix_inbound_webhook_events_status", "inbound_webhook_events", ["status"])
        op.create_index("ix_inbound_webhook_events_request_id", "inbound_webhook_events", ["request_id"])


def downgrade() -> None:
    op.drop_table("inbound_webhook_events")
    op.drop_column("messages", "delivery_status")
