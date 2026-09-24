"""Add bounded operator research runs.

Revision ID: 20260903_07
Revises: 20260831_06
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260903_07"
down_revision = "20260831_06"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "operator_research_runs" in inspector.get_table_names():
        return
    op.create_table(
        "operator_research_runs",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("request_id", sa.UUID(), sa.ForeignKey("requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by_user_id", sa.UUID(), sa.ForeignKey("user_accounts.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="running"),
        sa.Column("model", sa.String(80), nullable=False),
        sa.Column("result", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("response_id", sa.String(160)),
        sa.Column("input_tokens", sa.Integer()),
        sa.Column("output_tokens", sa.Integer()),
        sa.Column("error_summary", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_operator_research_runs_request_id", "operator_research_runs", ["request_id"])
    op.create_index("ix_operator_research_runs_created_by_user_id", "operator_research_runs", ["created_by_user_id"])
    op.create_index("ix_operator_research_runs_status", "operator_research_runs", ["status"])


def downgrade() -> None:
    op.drop_table("operator_research_runs")
