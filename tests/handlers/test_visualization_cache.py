from redash import models
from tests import BaseTestCase


class TestVisualizationCache(BaseTestCase):
    def setUp(self):
        super(TestVisualizationCache, self).setUp()
        self.visualization = self.factory.create_visualization()
        self.data_hash = "test_hash_123"
        self.svg_data = "<svg>test</svg>"

    def test_get_cached_svg_success(self):
        # Store SVG data
        models.ChartCache.store_svg(
            visualization_id=self.visualization.id,
            data_hash=self.data_hash,
            svg_data=self.svg_data
        )

        # Test GET endpoint
        rv = self.make_request(
            "get",
            f"/api/visualizations/{self.visualization.id}/cached_svg",
            params={"data_hash": self.data_hash}
        )

        self.assertEqual(rv.status_code, 200)
        self.assertEqual(rv.json["svg_data"], self.svg_data)

    def test_get_cached_svg_missing_hash(self):
        # Test GET endpoint without data_hash
        rv = self.make_request(
            "get",
            f"/api/visualizations/{self.visualization.id}/cached_svg"
        )

        self.assertEqual(rv.status_code, 400)
        self.assertEqual(rv.json["error"], "data_hash parameter is required")

    def test_get_cached_svg_not_found(self):
        # Test GET endpoint with non-existent cache
        rv = self.make_request(
            "get",
            f"/api/visualizations/{self.visualization.id}/cached_svg",
            params={"data_hash": "non_existent_hash"}
        )

        self.assertEqual(rv.status_code, 200)
        self.assertIsNone(rv.json["svg_data"])

    def test_cache_svg_success(self):
        # Test POST endpoint
        rv = self.make_request(
            "post",
            f"/api/visualizations/{self.visualization.id}/cache_svg",
            data={
                "data_hash": self.data_hash,
                "svg_data": self.svg_data
            }
        )

        self.assertEqual(rv.status_code, 200)
        self.assertTrue(rv.json["success"])
        self.assertIsNotNone(rv.json["cache_id"])

        # Verify data was stored
        cached_svg = models.ChartCache.get_cached_svg(
            visualization_id=self.visualization.id,
            data_hash=self.data_hash
        )
        self.assertEqual(cached_svg, self.svg_data)

    def test_cache_svg_missing_data(self):
        # Test POST endpoint without required data
        rv = self.make_request(
            "post",
            f"/api/visualizations/{self.visualization.id}/cache_svg",
            data={}
        )

        self.assertEqual(rv.status_code, 400)
        self.assertEqual(rv.json["error"], "data_hash and svg_data are required")

    def test_cache_svg_update_existing(self):
        # Store initial SVG
        initial_svg = "<svg>initial</svg>"
        models.ChartCache.store_svg(
            visualization_id=self.visualization.id,
            data_hash=self.data_hash,
            svg_data=initial_svg
        )

        # Test POST endpoint with new SVG
        rv = self.make_request(
            "post",
            f"/api/visualizations/{self.visualization.id}/cache_svg",
            data={
                "data_hash": self.data_hash,
                "svg_data": self.svg_data
            }
        )

        self.assertEqual(rv.status_code, 200)
        self.assertTrue(rv.json["success"])

        # Verify data was updated
        cached_svg = models.ChartCache.get_cached_svg(
            visualization_id=self.visualization.id,
            data_hash=self.data_hash
        )
        self.assertEqual(cached_svg, self.svg_data) 