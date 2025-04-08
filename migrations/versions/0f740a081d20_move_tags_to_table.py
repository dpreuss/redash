"""inline_tags

Revision ID: 0f740a081d20
Revises: a92d92aa678e
Create Date: 2018-05-10 15:47:56.120338

"""
import re
from funcy import flatten, compact
from alembic import op
import sqlalchemy as sa
from redash import models


# revision identifiers, used by Alembic.
revision = "0f740a081d20"
down_revision = "a92d92aa678e"
branch_labels = None
depends_on = None


def upgrade():
    # Create new tags table
    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # Create association table
    op.create_table(
        "query_tags",
        sa.Column("query_id", sa.Integer(), nullable=False),
        sa.Column("tag_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["query_id"], ["queries.id"]),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"]),
        sa.PrimaryKeyConstraint("query_id", "tag_id"),
    )

    # Get all queries
    conn = op.get_bind()
    queries = conn.execute("SELECT id, tags FROM queries").fetchall()

    # Process each query
    for query in queries:
        if not query.tags:
            continue

        # Extract tags from the comma-separated string
        tags = [tag.strip() for tag in query.tags.split(",") if tag.strip()]

        # Insert tags and create associations
        for tag_name in tags:
            # Insert tag if it doesn't exist
            tag = conn.execute(
                "SELECT id FROM tags WHERE name = %s", tag_name
            ).fetchone()
            if not tag:
                tag_id = conn.execute(
                    "INSERT INTO tags (name, created_at) VALUES (%s, NOW()) RETURNING id",
                    tag_name,
                ).fetchone()[0]
            else:
                tag_id = tag[0]

            # Create association
            conn.execute(
                "INSERT INTO query_tags (query_id, tag_id) VALUES (%s, %s)",
                query.id,
                tag_id,
            )

    # Drop the old tags column
    op.drop_column("queries", "tags")


def downgrade():
    # Add back the tags column
    op.add_column(
        "queries",
        sa.Column("tags", sa.String(length=255), nullable=True),
    )

    # Get all queries and their tags
    conn = op.get_bind()
    queries = conn.execute(
        """
        SELECT q.id, array_agg(t.name) as tag_names
        FROM queries q
        LEFT JOIN query_tags qt ON q.id = qt.query_id
        LEFT JOIN tags t ON qt.tag_id = t.id
        GROUP BY q.id
        """
    ).fetchall()

    # Update each query with its tags
    for query in queries:
        if query.tag_names and query.tag_names[0]:
            tags = ",".join(query.tag_names)
            conn.execute(
                "UPDATE queries SET tags = %s WHERE id = %s",
                tags,
                query.id,
            )

    # Drop the association table
    op.drop_table("query_tags")

    # Drop the tags table
    op.drop_table("tags") 