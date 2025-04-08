import unittest
from unittest.mock import patch, MagicMock
from redash.models import Visualization, QueryResult
from client.app.components.visualizations.VisualizationRenderer import VisualizationRenderer

class TestVisualizationRenderer(unittest.TestCase):
    def setUp(self):
        self.visualization = Visualization(
            id=1,
            type='chart',
            name='Test Chart',
            options={'some_option': 'value'}
        )
        self.query_result = QueryResult(
            id=1,
            data={'columns': [], 'rows': []}
        )

    @patch('redash.models.Renderer')
    def test_background_color_passed_to_options(self, MockRenderer):
        """Test that background color is correctly passed to visualization options"""
        background_color = '#f0f8ff'
        
        # Create mock renderer instance
        mock_renderer = MagicMock()
        MockRenderer.return_value = mock_renderer

        # Create visualization renderer with background color
        renderer = VisualizationRenderer(
            visualization=self.visualization,
            query_result=self.query_result,
            background_color=background_color
        )

        # Verify the options passed to the renderer include the background color
        renderer.render()
        
        # Get the options passed to the renderer
        called_options = mock_renderer.render.call_args[1]['options']
        
        # Verify background color was merged into options
        self.assertEqual(called_options['backgroundColor'], background_color)
        # Verify original options were preserved
        self.assertEqual(called_options['some_option'], 'value')

    @patch('redash.models.Renderer')
    def test_default_background_color(self, MockRenderer):
        """Test that backgroundColor is None when not specified"""
        # Create mock renderer instance
        mock_renderer = MagicMock()
        MockRenderer.return_value = mock_renderer

        # Create visualization renderer without background color
        renderer = VisualizationRenderer(
            visualization=self.visualization,
            query_result=self.query_result
        )

        # Verify the options passed to the renderer
        renderer.render()
        
        # Get the options passed to the renderer
        called_options = mock_renderer.render.call_args[1]['options']
        
        # Verify backgroundColor is None when not specified
        self.assertIsNone(called_options.get('backgroundColor'))
        # Verify original options were preserved
        self.assertEqual(called_options['some_option'], 'value') 