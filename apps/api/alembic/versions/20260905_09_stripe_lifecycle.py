"""Track Stripe customer, subscription and checkout references.

Revision ID: 20260905_09
Revises: 20260905_08
"""

from alembic import op
import sqlalchemy as sa


revision = "20260905_09"
down_revision = "20260905_08"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("membership_applications", sa.Column("stripe_checkout_session_id", sa.String(length=255), nullable=True))
    op.add_column("membership_applications", sa.Column("stripe_customer_id", sa.String(length=255), nullable=True))
    op.add_column("membership_applications", sa.Column("stripe_subscription_id", sa.String(length=255), nullable=True))
    op.create_unique_constraint("uq_membership_application_checkout", "membership_applications", ["stripe_checkout_session_id"])
    op.create_unique_constraint("uq_membership_application_customer", "membership_applications", ["stripe_customer_id"])
    op.create_unique_constraint("uq_membership_application_subscription", "membership_applications", ["stripe_subscription_id"])


def downgrade() -> None:
    op.drop_constraint("uq_membership_application_subscription", "membership_applications", type_="unique")
    op.drop_constraint("uq_membership_application_customer", "membership_applications", type_="unique")
    op.drop_constraint("uq_membership_application_checkout", "membership_applications", type_="unique")
    op.drop_column("membership_applications", "stripe_subscription_id")
    op.drop_column("membership_applications", "stripe_customer_id")
    op.drop_column("membership_applications", "stripe_checkout_session_id")
