"""Initial Vector Privé pilot schema.

Revision ID: 20260826_01
"""
from alembic import op

from app.models import Base

revision = "20260826_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())
