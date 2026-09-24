"""Add private client profile photos.

Revision ID: 20260831_05
Revises: 20260831_04
"""

from alembic import op
import sqlalchemy as sa

revision = "20260831_05"
down_revision = "20260831_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("clients")}
    if "profile_photo" not in columns:
        op.add_column("clients", sa.Column("profile_photo", sa.LargeBinary(), nullable=True))
    if "profile_photo_mime" not in columns:
        op.add_column("clients", sa.Column("profile_photo_mime", sa.String(length=40), nullable=True))
    if "profile_photo_updated_at" not in columns:
        op.add_column("clients", sa.Column("profile_photo_updated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("clients", "profile_photo_updated_at")
    op.drop_column("clients", "profile_photo_mime")
    op.drop_column("clients", "profile_photo")
