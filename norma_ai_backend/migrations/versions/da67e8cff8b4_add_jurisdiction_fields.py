"""Add jurisdiction fields

Revision ID: da67e8cff8b4
Revises: 77824b3bd5c6
Create Date: 2025-03-12 22:34:54.113756

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'da67e8cff8b4'
down_revision = '77824b3bd5c6'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('documents', schema=None) as batch_op:
        batch_op.add_column(sa.Column('jurisdiction', sa.String(length=50), nullable=True))

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('preferred_jurisdiction', sa.String(length=50), nullable=True))

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('preferred_jurisdiction')

    with op.batch_alter_table('documents', schema=None) as batch_op:
        batch_op.drop_column('jurisdiction')

    # ### end Alembic commands ###
