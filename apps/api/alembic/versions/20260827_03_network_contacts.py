"""Add the operator-only relationship directory.

Revision ID: 20260827_03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260827_03"
down_revision = "20260826_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "network_contacts" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "network_contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("first_name", sa.String(length=120), nullable=False),
        sa.Column("last_name", sa.String(length=160), nullable=False),
        sa.Column("full_name", sa.String(length=280), nullable=False),
        sa.Column("linkedin_url", sa.String(length=500), nullable=False),
        sa.Column("company", sa.String(length=240), nullable=True),
        sa.Column("position", sa.String(length=320), nullable=True),
        sa.Column("connected_on", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("relationship_status", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("linkedin_url"),
    )
    for column in ("full_name", "linkedin_url", "company", "position", "connected_on", "relationship_status"):
        op.create_index(f"ix_network_contacts_{column}", "network_contacts", [column], unique=column == "linkedin_url")


def downgrade() -> None:
    op.drop_table("network_contacts")
