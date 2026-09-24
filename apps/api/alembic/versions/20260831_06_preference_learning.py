"""Add durable preference provenance and learning state.

Revision ID: 20260831_06
Revises: 20260831_05
"""

from alembic import op
import sqlalchemy as sa

revision = "20260831_06"
down_revision = "20260831_05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("preferences")}
    additions = {
        "source_type": sa.Column("source_type", sa.String(40), nullable=False, server_default="inferred"),
        "source_reference": sa.Column("source_reference", sa.String(240), nullable=True),
        "status": sa.Column("status", sa.String(32), nullable=False, server_default="inferred"),
        "observation_count": sa.Column("observation_count", sa.Integer(), nullable=False, server_default="1"),
        "last_observed_at": sa.Column("last_observed_at", sa.DateTime(timezone=True), nullable=True),
        "recorded_by_user_id": sa.Column("recorded_by_user_id", sa.UUID(), nullable=True),
    }
    for name, column in additions.items():
        if name not in columns:
            op.add_column("preferences", column)
    foreign_keys = {key.get("name") for key in inspector.get_foreign_keys("preferences")}
    if "fk_preferences_recorded_by_user" not in foreign_keys:
        op.create_foreign_key("fk_preferences_recorded_by_user", "preferences", "user_accounts", ["recorded_by_user_id"], ["id"], ondelete="SET NULL")
    op.execute("UPDATE preferences SET source_type='questionnaire', status='confirmed' WHERE category LIKE 'onboarding:%'")


def downgrade() -> None:
    op.drop_constraint("fk_preferences_recorded_by_user", "preferences", type_="foreignkey")
    for name in ("recorded_by_user_id", "last_observed_at", "observation_count", "status", "source_reference", "source_type"):
        op.drop_column("preferences", name)
