import { isEmpty, map, isEqual } from "lodash";
import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import cx from "classnames";

import Button from "antd/lib/button";
import routeWithUserSession from "@/components/ApplicationArea/routeWithUserSession";
import DynamicComponent from "@/components/DynamicComponent";
import DashboardGrid from "@/components/dashboards/DashboardGrid";
import Parameters from "@/components/Parameters";
import Filters from "@/components/Filters";

import { Dashboard } from "@/services/dashboard";
import recordEvent from "@/services/recordEvent";
import resizeObserver from "@/services/resizeObserver";
import routes from "@/services/routes";
import location from "@/services/location";
import url from "@/services/url";
import useImmutableCallback from "@/lib/hooks/useImmutableCallback";

import useDashboard from "./hooks/useDashboard";
import DashboardHeader from "./components/DashboardHeader";

import "./DashboardPage.less";

function DashboardSettings({ dashboardConfiguration }) {
  const { dashboard, updateDashboard } = dashboardConfiguration;
  const localBackgroundColor = dashboard.options?.backgroundColor || "#ffffff";
  
  const handleBackgroundColorChange = (e) => {
    updateDashboard({ options: { ...dashboard.options, backgroundColor: e.target.value } });
  };
  
  const handleBackgroundColorChangeComplete = handleBackgroundColorChange;

  return (
    <div className="m-b-10 p-15 tiled" style={{ backgroundColor: 'var(--dashboard-background-color, #ffffff)' }}>
      <div className="d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center">
          <h4 className="m-t-0 m-b-0 m-r-15">Dashboard Settings</h4>
          <div className="form-group dashboard-settings-filters m-b-0">
            <label htmlFor="dashboard-filters-enabled" className="d-flex align-items-center m-0">
              <input
                type="checkbox"
                id="dashboard-filters-enabled"
                className="m-r-5"
                checked={!!dashboard.dashboard_filters_enabled}
                onChange={e => updateDashboard({ dashboard_filters_enabled: e.target.checked })}
              />
              <span>Use Dashboard Level Filters</span>
            </label>
          </div>
        </div>
        <div className="form-group dashboard-settings-color m-b-0">
          <label htmlFor="dashboard-background-color" className="m-r-10">Background Color</label>
          <input
            id="dashboard-background-color"
            type="color"
            value={localBackgroundColor}
            onChange={handleBackgroundColorChange}
            onChangeComplete={handleBackgroundColorChangeComplete}
          />
        </div>
      </div>
    </div>
  );
}

DashboardSettings.propTypes = {
  dashboardConfiguration: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
};

function AddWidgetContainer({ dashboardConfiguration, className, ...props }) {
  const { showAddTextboxDialog, showAddWidgetDialog } = dashboardConfiguration;
  return (
    <div className={cx("add-widget-container", className)} {...props}>
      <h2>
        <i className="zmdi zmdi-widgets" aria-hidden="true" />
        <span className="hidden-xs hidden-sm">
          Widgets are individual query visualizations or text boxes you can place on your dashboard in various
          arrangements.
        </span>
      </h2>
      <div>
        <Button className="m-r-15" onClick={showAddTextboxDialog} data-test="AddTextboxButton">
          Add Textbox
        </Button>
        <Button type="primary" onClick={showAddWidgetDialog} data-test="AddWidgetButton">
          Add Widget
        </Button>
      </div>
    </div>
  );
}

AddWidgetContainer.propTypes = {
  dashboardConfiguration: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  className: PropTypes.string,
};

function DashboardComponent(props) {
  const dashboardConfiguration = useDashboard(props.dashboard);
  const { dashboard, updateDashboard, loadWidget, refreshWidget, removeWidget, refreshDashboard } = dashboardConfiguration;
  const [filters, setFilters] = useState([]);
  const { editingLayout } = dashboardConfiguration;
  const [isPublic] = useState(false); // Default to false since this is the private dashboard view
  const [pageContainer, setPageContainer] = useState(null);
  const [bottomPanelStyles, setBottomPanelStyles] = useState({});
  const { globalParameters } = dashboardConfiguration;
  
  const onParametersEdit = parameters => {
    const paramOrder = map(parameters, "name");
    updateDashboard({ options: { globalParamOrder: paramOrder } });
  };

  useEffect(() => {
    if (pageContainer) {
      const unobserve = resizeObserver(pageContainer, () => {
        if (editingLayout) {
          const style = window.getComputedStyle(pageContainer, null);
          const bounds = pageContainer.getBoundingClientRect();
          const paddingLeft = parseFloat(style.paddingLeft) || 0;
          const paddingRight = parseFloat(style.paddingRight) || 0;
          setBottomPanelStyles({
            left: Math.round(bounds.left) + paddingRight,
            width: pageContainer.clientWidth - paddingLeft - paddingRight,
          });
        }

        // reflow grid when container changes its size
        window.dispatchEvent(new Event("resize"));
      });
      return unobserve;
    }
  }, [pageContainer, editingLayout]);

  const handleWidgetOptionsChange = widget => {
    // Find the widget in the dashboard's widgets array
    const index = dashboard.widgets.findIndex(w => w.id === widget.id);
    if (index >= 0) {
      // Create a new widget array to trigger a re-render
      const updatedWidgets = [...dashboard.widgets];
      updatedWidgets[index] = widget;
      
      // Update the dashboard with both the new widgets array and the current version
      updateDashboard({ 
        widgets: updatedWidgets,
        version: dashboard.version 
      }).catch(() => {
        // If save fails, refresh the dashboard to get the latest version
        window.location.reload();
      });
    }
  };

  const onWidgetSizeChange = useCallback((widget, newSize) => {
    widget.options = { ...widget.options, ...newSize };
    updateDashboard({ widgets: [...dashboard.widgets] });
  }, [dashboard.widgets, updateDashboard]);

  const onParameterMappingsChange = useCallback(() => {
    // Refresh dashboard when parameter mappings change
    refreshDashboard();
  }, [refreshDashboard]);

  // Only update dashboard if layout has changed
  const handleLayoutChange = useCallback((newLayout) => {
    if (!isEqual(newLayout, dashboard.layout)) {
      updateDashboard({ layout: newLayout });
    }
  }, [dashboard.layout, updateDashboard]);

  return (
    <div className="container" ref={setPageContainer} data-test={`DashboardId${dashboard.id}Container`}>
      <DashboardHeader
        dashboardConfiguration={dashboardConfiguration}
        headerExtra={
          <DynamicComponent
            name="Dashboard.HeaderExtra"
            dashboard={dashboard}
            dashboardConfiguration={dashboardConfiguration}
          />
        }
      />
      {!isEmpty(globalParameters) && (
        <div className="dashboard-parameters m-b-10 p-15 tiled" data-test="DashboardParameters" 
             style={{ backgroundColor: 'var(--dashboard-background-color, #ffffff)' }}>
          <Parameters
            parameters={globalParameters}
            onValuesChange={refreshDashboard}
            sortable={editingLayout}
            onParametersEdit={onParametersEdit}
          />
        </div>
      )}
      {!isEmpty(filters) && (
        <div className="m-b-10 p-15 tiled" data-test="DashboardFilters"
             style={{ backgroundColor: 'var(--dashboard-background-color, #ffffff)' }}>
          <Filters filters={filters} onChange={setFilters} />
        </div>
      )}
      {editingLayout && <DashboardSettings dashboardConfiguration={dashboardConfiguration} />}
      <div id="dashboard-container">
        <DashboardGrid
          dashboard={dashboard}
          widgets={dashboard.widgets}
          filters={filters}
          isEditing={editingLayout}
          onLoadWidget={loadWidget}
          onRefreshWidget={refreshWidget}
          onRemoveWidget={removeWidget}
          onBreakpointChange={() => {}}
          onLayoutChange={handleLayoutChange}
          onWidgetSizeChange={onWidgetSizeChange}
          onParameterMappingsChange={onParameterMappingsChange}
          onOptionsChange={handleWidgetOptionsChange}
          isPublic={isPublic}
          backgroundColor={dashboard.options?.backgroundColor}
        />
      </div>
      {editingLayout && (
        <AddWidgetContainer dashboardConfiguration={dashboardConfiguration} style={bottomPanelStyles} />
      )}
    </div>
  );
}

DashboardComponent.propTypes = {
  dashboard: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
};

function DashboardPage({ dashboardSlug, dashboardId, onError }) {
  const [dashboard, setDashboard] = useState(null);
  const handleError = useImmutableCallback(onError);

  useEffect(() => {
    Dashboard.get({ id: dashboardId, slug: dashboardSlug })
      .then(dashboardData => {
        recordEvent("view", "dashboard", dashboardData.id);
        setDashboard(dashboardData);

        // if loaded by slug, update location url to use the id
        if (!dashboardId) {
          location.setPath(url.parse(dashboardData.url).pathname, true);
        }
      })
      .catch(handleError);
  }, [dashboardId, dashboardSlug, handleError]);

  return <div className="dashboard-page">{dashboard && <DashboardComponent dashboard={dashboard} />}</div>;
}

DashboardPage.propTypes = {
  dashboardSlug: PropTypes.string,
  dashboardId: PropTypes.string,
  onError: PropTypes.func,
};

DashboardPage.defaultProps = {
  dashboardSlug: null,
  dashboardId: null,
  onError: PropTypes.func,
};

// route kept for backward compatibility
routes.register(
  "Dashboards.LegacyViewOrEdit",
  routeWithUserSession({
    path: "/dashboard/:dashboardSlug",
    render: pageProps => <DashboardPage {...pageProps} />,
  })
);

routes.register(
  "Dashboards.ViewOrEdit",
  routeWithUserSession({
    path: "/dashboards/:dashboardId([^-]+)(-.*)?",
    render: pageProps => <DashboardPage {...pageProps} />,
  })
);
