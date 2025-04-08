from unittest import TestCase
from viz_lib.visualizations.chart.plotly import prepareLayout

class TestChartBackground(TestCase):
    def test_background_color_in_layout(self):
        # Test with background color specified
        element = {"offsetWidth": 100, "offsetHeight": 100}
        options = {
            "legend": {"enabled": True, "traceorder": "normal"},
            "backgroundColor": "#f0f0f0"
        }
        data = []
        
        layout = prepareLayout(element, options, data)
        
        self.assertEqual(layout["paper_bgcolor"], "#f0f0f0")
        self.assertEqual(layout["plot_bgcolor"], "#f0f0f0")

    def test_default_background_color(self):
        # Test without background color specified
        element = {"offsetWidth": 100, "offsetHeight": 100}
        options = {
            "legend": {"enabled": True, "traceorder": "normal"}
        }
        data = []
        
        layout = prepareLayout(element, options, data)
        
        self.assertEqual(layout["paper_bgcolor"], "#ffffff")
        self.assertEqual(layout["plot_bgcolor"], "#ffffff") 