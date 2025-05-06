from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import backref

from redash.models.base import Column, db, key_type, primary_key
from redash.models.mixins import TimestampMixin
from sqlalchemy_utils.models import generic_repr


@generic_repr("id", "visualization_id", "data_hash")
class ChartCache(TimestampMixin, db.Model):
    id = primary_key("ChartCache")
    visualization_id = Column(key_type("Visualization"), db.ForeignKey('visualizations.id', ondelete='CASCADE'))
    data_hash = Column(db.String(40), nullable=False)  # SHA-1 hash of the data used to generate the chart
    svg_data = Column(db.Text, nullable=False)  # The cached SVG content

    visualization = db.relationship('Visualization', backref=backref('chart_caches', cascade='all, delete-orphan'))

    __tablename__ = 'chart_cache'
    __table_args__ = (
        UniqueConstraint('visualization_id', 'data_hash', name='unique_vis_hash'),
        db.Index('ix_chart_cache_data_hash', 'data_hash'),
        db.Index('ix_chart_cache_visualization_id', 'visualization_id'),
    )

    @classmethod
    def get_cached_svg(cls, visualization_id, data_hash):
        """Retrieve cached SVG for a visualization and data hash."""
        cache = cls.query.filter(
            cls.visualization_id == visualization_id,
            cls.data_hash == data_hash
        ).first()
        return cache.svg_data if cache else None

    @classmethod
    def store_svg(cls, visualization_id, data_hash, svg_data):
        """Store SVG data in cache."""
        try:
            cache = cls.query.filter(
                cls.visualization_id == visualization_id,
                cls.data_hash == data_hash
            ).first()

            if cache:
                cache.svg_data = svg_data
            else:
                cache = cls(
                    visualization_id=visualization_id,
                    data_hash=data_hash,
                    svg_data=svg_data
                )
                db.session.add(cache)

            db.session.commit()
            return cache.id
        except Exception:
            db.session.rollback()
            raise 