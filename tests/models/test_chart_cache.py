from redash.models import ChartCache
from tests import BaseTestCase


class TestChartCache(BaseTestCase):
    def setUp(self):
        super(TestChartCache, self).setUp()
        self.visualization = self.factory.create_visualization()
        self.data_hash = "test_hash_123"
        self.svg_data = "<svg>test</svg>"

    def test_store_and_retrieve_svg(self):
        # Test storing SVG data
        cache_id = ChartCache.store_svg(
            visualization_id=self.visualization.id,
            data_hash=self.data_hash,
            svg_data=self.svg_data
        )
        self.assertIsNotNone(cache_id)

        # Test retrieving SVG data
        cached_svg = ChartCache.get_cached_svg(
            visualization_id=self.visualization.id,
            data_hash=self.data_hash
        )
        self.assertEqual(cached_svg, self.svg_data)

    def test_update_existing_cache(self):
        # Store initial SVG
        initial_svg = "<svg>initial</svg>"
        ChartCache.store_svg(
            visualization_id=self.visualization.id,
            data_hash=self.data_hash,
            svg_data=initial_svg
        )

        # Update with new SVG
        new_svg = "<svg>updated</svg>"
        ChartCache.store_svg(
            visualization_id=self.visualization.id,
            data_hash=self.data_hash,
            svg_data=new_svg
        )

        # Verify update
        cached_svg = ChartCache.get_cached_svg(
            visualization_id=self.visualization.id,
            data_hash=self.data_hash
        )
        self.assertEqual(cached_svg, new_svg)

    def test_cache_miss(self):
        # Test retrieving non-existent cache
        cached_svg = ChartCache.get_cached_svg(
            visualization_id=self.visualization.id,
            data_hash="non_existent_hash"
        )
        self.assertIsNone(cached_svg)

    def test_unique_constraint(self):
        # Store first cache entry
        ChartCache.store_svg(
            visualization_id=self.visualization.id,
            data_hash=self.data_hash,
            svg_data=self.svg_data
        )

        # Try to store duplicate (should update instead of failing)
        new_svg = "<svg>new</svg>"
        ChartCache.store_svg(
            visualization_id=self.visualization.id,
            data_hash=self.data_hash,
            svg_data=new_svg
        )

        # Verify only one entry exists
        cache_count = ChartCache.query.filter_by(
            visualization_id=self.visualization.id,
            data_hash=self.data_hash
        ).count()
        self.assertEqual(cache_count, 1)

    def test_cascade_delete(self):
        # Store cache entry
        ChartCache.store_svg(
            visualization_id=self.visualization.id,
            data_hash=self.data_hash,
            svg_data=self.svg_data
        )

        # Delete visualization
        from redash.models import db
        db.session.delete(self.visualization)
        db.session.commit()

        # Verify cache is deleted
        cache_count = ChartCache.query.filter_by(
            visualization_id=self.visualization.id
        ).count()
        self.assertEqual(cache_count, 0) 