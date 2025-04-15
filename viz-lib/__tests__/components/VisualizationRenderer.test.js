import React from 'react';
import { render } from '@testing-library/react';
import { VisualizationRenderer } from '../../src/components/visualizations/VisualizationRenderer';

jest.mock('../../src/components/visualizations/renderer', () => ({
  Renderer: jest.fn(({ options }) => <div data-testid="mock-renderer" data-options={JSON.stringify(options)} />)
}));

describe('VisualizationRenderer', () => {
  const defaultProps = {
    visualization: {
      id: 1,
      type: 'chart',
      name: 'Test Chart',
      options: { some_option: 'value' }
    },
    queryResult: {
      id: 1,
      data: { columns: [], rows: [] }
    }
  };

  it('should pass background color to visualization options', () => {
    const backgroundColor = '#f0f8ff';
    const { getByTestId } = render(
      <VisualizationRenderer
        {...defaultProps}
        backgroundColor={backgroundColor}
      />
    );

    const renderer = getByTestId('mock-renderer');
    const options = JSON.parse(renderer.dataset.options);

    expect(options.backgroundColor).toBe(backgroundColor);
    expect(options.some_option).toBe('value');
  });

  it('should not include backgroundColor in options when not specified', () => {
    const { getByTestId } = render(
      <VisualizationRenderer {...defaultProps} />
    );

    const renderer = getByTestId('mock-renderer');
    const options = JSON.parse(renderer.dataset.options);

    expect(options.backgroundColor).toBeUndefined();
    expect(options.some_option).toBe('value');
  });
}); 