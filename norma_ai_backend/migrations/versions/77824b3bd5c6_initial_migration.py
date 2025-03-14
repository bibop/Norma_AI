"""Initial migration

Revision ID: 77824b3bd5c6
Revises: 
Create Date: 2025-03-12 11:26:40.501418

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '77824b3bd5c6'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('documents',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('filename', sa.String(length=255), nullable=False),
    sa.Column('original_filename', sa.String(length=255), nullable=False),
    sa.Column('file_type', sa.String(length=50), nullable=False),
    sa.Column('file_size', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=True),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('upload_date', sa.DateTime(), nullable=True),
    sa.Column('last_analyzed', sa.DateTime(), nullable=True),
    sa.Column('compliance_results', sa.JSON(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('first_name', sa.String(length=50), nullable=False))
        batch_op.add_column(sa.Column('last_name', sa.String(length=50), nullable=False))
        batch_op.add_column(sa.Column('company', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('role', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('updated_at', sa.DateTime(), nullable=True))
        batch_op.alter_column('password_hash',
               existing_type=sa.VARCHAR(length=255),
               type_=sa.String(length=128),
               existing_nullable=False)
        batch_op.drop_constraint('users_username_key', type_='unique')
        batch_op.drop_column('username')

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('username', sa.VARCHAR(length=50), autoincrement=False, nullable=False))
        batch_op.create_unique_constraint('users_username_key', ['username'])
        batch_op.alter_column('password_hash',
               existing_type=sa.String(length=128),
               type_=sa.VARCHAR(length=255),
               existing_nullable=False)
        batch_op.drop_column('updated_at')
        batch_op.drop_column('role')
        batch_op.drop_column('company')
        batch_op.drop_column('last_name')
        batch_op.drop_column('first_name')

    op.drop_table('documents')
    # ### end Alembic commands ###
