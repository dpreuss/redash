from redash.models import db
from redash.serializers import serialize_dashboard, serialize_widget
from tests import BaseTestCase


class TestDashboardBackground(BaseTestCase):
    def test_default_background_color(self):
        dashboard = self.factory.create_dashboard()
        dashboard.options = {}  # Ensure options is initialized
        db.session.add(dashboard)
        db.session.commit()

        serialized = serialize_dashboard(dashboard)
        self.assertEqual(serialized["options"]["backgroundColor"], "#ffffff")

    def test_custom_background_color(self):
        dashboard = self.factory.create_dashboard()
        dashboard.options = {"backgroundColor": "#000000"}
        db.session.add(dashboard)
        db.session.commit()

        serialized = serialize_dashboard(dashboard)
        self.assertEqual(serialized["options"]["backgroundColor"], "#000000")

    def test_background_color_passed_to_visualization(self):
        dashboard = self.factory.create_dashboard()
        dashboard.options = {"backgroundColor": "#cccccc"}
        db.session.add(dashboard)
        db.session.commit()

        # Create a visualization widget
        ds = self.factory.create_data_source()
        query = self.factory.create_query(data_source=ds)
        viz = self.factory.create_visualization(query_rel=query, options={})  # Initialize options
        widget = self.factory.create_widget(visualization=viz, dashboard=dashboard)
        db.session.add(widget)
        db.session.commit()

        # Verify the background color is passed to the widget
        serialized = serialize_dashboard(dashboard, with_widgets=True)
        self.assertEqual(serialized["options"]["backgroundColor"], "#cccccc")
        # Verify the background color is passed to the visualization options
        self.assertEqual(
            serialized["widgets"][0]["visualization"]["options"]["dashboardBackgroundColor"],
            "#cccccc"
        )

    def test_dashboard_serialization_includes_background_color(self):
        dashboard = self.factory.create_dashboard()
        dashboard.options = {"backgroundColor": "#ff0000"}
        db.session.add(dashboard)
        db.session.commit()

        serialized = serialize_dashboard(dashboard)
        self.assertEqual(serialized["options"]["backgroundColor"], "#ff0000")

    def test_dashboard_serialization_defaults_to_white(self):
        dashboard = self.factory.create_dashboard()
        dashboard.options = {}
        db.session.add(dashboard)
        db.session.commit()

        serialized = serialize_dashboard(dashboard)
        self.assertEqual(serialized["options"]["backgroundColor"], "#ffffff")

    def test_widget_serialization_includes_dashboard_background(self):
        dashboard = self.factory.create_dashboard()
        dashboard.options = {"backgroundColor": "#ff0000"}
        db.session.add(dashboard)
        db.session.commit()

        visualization = self.factory.create_visualization(options={})  # Initialize options
        widget = self.factory.create_widget(dashboard=dashboard, visualization=visualization)
        db.session.add(widget)
        db.session.commit()

        serialized = serialize_widget(widget)
        self.assertEqual(
            serialized["visualization"]["options"]["dashboardBackgroundColor"],
            "#ff0000"
        )

    def test_widget_serialization_defaults_to_white_background(self):
        dashboard = self.factory.create_dashboard()
        dashboard.options = {}
        db.session.add(dashboard)
        db.session.commit()

        visualization = self.factory.create_visualization(options={})  # Initialize options
        widget = self.factory.create_widget(dashboard=dashboard, visualization=visualization)
        db.session.add(widget)
        db.session.commit()

        serialized = serialize_widget(widget)
        self.assertEqual(
            serialized["visualization"]["options"]["dashboardBackgroundColor"],
            "#ffffff"
        )
