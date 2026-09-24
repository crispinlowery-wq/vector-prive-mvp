"""Add membership applications and one-time invite keys.

Revision ID: 20260905_08
Revises: 20260903_07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260905_08"
down_revision = "20260903_07"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "invite_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code_hash", sa.String(length=96), nullable=False, unique=True),
        sa.Column("label", sa.String(length=160), nullable=False),
        sa.Column("tier", sa.String(length=32), nullable=False),
        sa.Column("valid_until", sa.DateTime(timezone=True)),
        sa.Column("redeemed_at", sa.DateTime(timezone=True)),
        sa.Column("redeemed_by_application_id", postgresql.UUID(as_uuid=True), unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_invite_keys_code_hash", "invite_keys", ["code_hash"])
    op.create_table(
        "membership_applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="SET NULL")),
        sa.Column("full_name", sa.String(length=160), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False, unique=True),
        sa.Column("phone", sa.String(length=40)),
        sa.Column("tier", sa.String(length=32), nullable=False),
        sa.Column("note", sa.Text()),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="payment_pending"),
        sa.Column("payment_status", sa.String(length=32), nullable=False, server_default="payment_required"),
        sa.Column("invite_key_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("invite_keys.id", ondelete="SET NULL")),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("reviewed_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_accounts.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_membership_applications_client_id", "membership_applications", ["client_id"])
    op.create_index("ix_membership_applications_email", "membership_applications", ["email"])
    op.create_index("ix_membership_applications_tier", "membership_applications", ["tier"])
    op.create_index("ix_membership_applications_status", "membership_applications", ["status"])
    op.create_index("ix_membership_applications_invite_key_id", "membership_applications", ["invite_key_id"])


def downgrade():
    op.drop_table("membership_applications")
    op.drop_table("invite_keys")
