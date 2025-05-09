//
import React from "react";
import { mount } from "enzyme";
// import { includes } from "lodash";
// import { Menu } from "antd";
// import { mockNotification } from "@/services/notification"; // Mock before loading auth
import { render, screen, fireEvent } from "@testing-library/react";
import VisualizationWidget from "../VisualizationWidget";

// Mock services
// const mockAuth = {
//   Auth: {
//     hasPermission: jest.fn(() => true),
//   },
// };

jest.mock("@/services/user");
jest.mock("@/services/organization");
jest.mock("@/services/notification");

// Mock window.URL.createObjectURL
// Object.defineProperty(window.URL, 'createObjectURL', {
//   writable: true,
//   value: jest.fn(() => 'mocked-url')
// });

// Mock modules before imports
// jest.mock("plotly.js", () => ({
//   newPlot: jest.fn(),
//   react: jest.fn(),
// }));

// jest.mock("mapbox-gl", () => ({
//   Map: jest.fn(),
// }));

// import { render, screen, fireEvent } from "@testing-library/react";
// import VisualizationWidget from "../VisualizationWidget";

// Mock visualization components
jest.mock("@/components/visualizations/VisualizationRenderer", () => ({
  __esModule: true,
  default: () => <div data-testid="visualization-renderer">Test Visualization</div>,
}));

// Mock QueryLink component
jest.mock("@/components/QueryLink", () => ({
  __esModule: true,
  default: () => <div data-testid="query-link">Query Link</div>,
}));

const mockWidget = {
  id: 1,
  width: 100,
  options: {
    position: { col: 0, row: 0, sizeX: 3, sizeY: 2 },
    showHeader: true,
  },
  visualization: {
    query: { id: 123, name: "Test Query" },
    name: "Test Visualization",
  },
};

const defaultProps = {
  widget: mockWidget,
  isEditing: false,
  canEdit: true,
  onMoveWidget: jest.fn(),
  onRemoveWidget: jest.fn(),
  onResizeStop: jest.fn(),
  onParameterMappingsChange: jest.fn(),
};

describe("VisualizationWidget", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Header Visibility", () => {
    it("shows header by default", () => {
      render(<VisualizationWidget {...defaultProps} />);

      // Header should contain query name
      expect(screen.getByText("Test Query")).toBeInTheDocument();
    });

    it("hides header when widget.options.showHeader is false", () => {
      const props = {
        ...defaultProps,
        widget: {
          ...mockWidget,
          options: { showHeader: false },
        },
      };

      render(<VisualizationWidget {...props} />);

      // Header should not be present
      expect(screen.queryByText("Test Query")).not.toBeInTheDocument();
    });

    it("toggles header visibility through menu option", () => {
      const widget = {
        ...mockWidget,
        options: { showHeader: true },
      };

      const wrapper = mount(<VisualizationWidget {...defaultProps} widget={widget} />);

      // Initially header should be visible
      expect(wrapper.find("VisualizationWidgetHeader")).toHaveLength(1);

      // Find and click the toggle header menu item
      const toggleButton = wrapper.find('MenuItem[key="toggle_header"]');
      toggleButton.simulate("click");

      // Should call save with updated options
      expect(widget.save).toHaveBeenCalledWith("options", {
        showHeader: false,
      });
    });

    it("preserves other widget options when toggling header", () => {
      const widget = {
        ...mockWidget,
        options: {
          showHeader: true,
          someOtherOption: "value",
        },
      };

      const wrapper = mount(<VisualizationWidget {...defaultProps} widget={widget} />);

      // Find and click the toggle header menu item
      const toggleButton = wrapper.find('MenuItem[key="toggle_header"]');
      toggleButton.simulate("click");

      // Should call save with all options preserved
      expect(widget.save).toHaveBeenCalledWith("options", {
        showHeader: false,
        someOtherOption: "value",
      });
    });
  });

  it("renders with header visible by default", () => {
    render(<VisualizationWidget {...defaultProps} />);
    expect(screen.getByText("Test Visualization")).toBeInTheDocument();
  });

  it("hides header when showHeader is false", () => {
    const widgetWithHiddenHeader = {
      ...mockWidget,
      options: { ...mockWidget.options, showHeader: false },
    };
    render(<VisualizationWidget {...defaultProps} widget={widgetWithHiddenHeader} />);
    expect(screen.queryByText("Test Visualization")).not.toBeInTheDocument();
  });

  it("shows header toggle option in menu when editing", () => {
    render(<VisualizationWidget {...defaultProps} isEditing={true} />);
    fireEvent.click(screen.getByRole("button", { name: /menu/i }));
    expect(screen.getByText(/toggle header/i)).toBeInTheDocument();
  });

  it("preserves other widget options when toggling header", () => {
    render(<VisualizationWidget {...defaultProps} isEditing={true} />);
    fireEvent.click(screen.getByRole("button", { name: /menu/i }));
    fireEvent.click(screen.getByText(/toggle header/i));
    expect(defaultProps.onParameterMappingsChange).toHaveBeenCalledWith({
      ...mockWidget.options,
      showHeader: false,
    });
  });
});
