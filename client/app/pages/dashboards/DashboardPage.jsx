import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import cx from "classnames";
import { isEmpty, debounce, isEqual } from "lodash";
import Button from "antd/lib/button";
import routeWithUserSession from "@/components/ApplicationArea/routeWithUserSession";
import DashboardGrid from "@/components/dashboards/DashboardGrid";
import Parameters from "@/components/Parameters";
import Filters from "@/components/Filters";
import { Dashboard } from "@/services/dashboard";
import recordEvent from "@/services/recordEvent";
import routes from "@/services/routes";
import location from "@/services/location";
import url from "@/services/url";

import { useDashboard } from "./hooks/useDashboard";

import "./DashboardPage.less";

function DashboardSettings({ dashboard, updateDashboard }) {
  const [localBackgroundColor, setLocalBackgroundColor] = useState(
    dashboard.options?.backgroundColor || '#ffffff'
  );

  const handleBackgroundColorChange = (color) => {
    setLocalBackgroundColor(color);
    updateDashboard({
      options: {
        ...dashboard.options,
        backgroundColor: color,
      },
    });
  };

  return (
    <div className="m-b-10 p-15 bg-white tiled">
      <h5>Dashboard Settings</h5>
      <div className="m-t-10">
        <label htmlFor="backgroundColor">Background Color:</label>
        <input
          type="color"
          id="backgroundColor"
          value={localBackgroundColor}
          onChange={(e) => handleBackgroundColorChange(e.target.value)}
        />
      </div>
    </div>
  );
}

DashboardSettings.propTypes = {
  dashboard: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  updateDashboard: PropTypes.func.isRequired,
};

function AddWidgetContainer({ className, dashboardOptions, ...props }) {
  return (
    <div className={cx("add-widget-container", className)}>
      <h2>
        <i className="zmdi zmdi-widgets" />
        <span className="hidden-xs hidden-sm">Add Widget</span>
      </h2>
      {dashboardOptions.canEdit ? (
        <div>
          <Button type="primary" onClick={props.onAddWidget}>
            Add Widget
          </Button>
        </div>
      ) : null}
    </div>
  );
}

AddWidgetContainer.propTypes = {
  onAddWidget: PropTypes.func.isRequired,
  dashboardOptions: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  className: PropTypes.string,
};

export function normalizeLayout(layout) {
  // Convert dict/object to array if needed
  if (!Array.isArray(layout) && typeof layout === "object" && layout !== null) {
    layout = Object.values(layout);
  }
  if (!Array.isArray(layout)) return [];
  return layout
    .filter(item => item && typeof item.i === "string")
    .map(item => ({
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      // add more keys if needed
    }))
    .sort((a, b) => a.i.localeCompare(b.i));
}

function DashboardComponent(props) {
  const { dashboard, updateDashboard, loadDashboard } = useDashboard(props.dashboard);
  const [gridDisabled, setGridDisabled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingLayout, setEditingLayout] = useState(props.editingLayout);
  const [isDashboardOwner, setIsDashboardOwner] = useState(false);
  const [filters, setFilters] = useState([]);

  const refreshDashboard = useCallback(() => {
    if (!refreshing) {
      setRefreshing(true);
      loadDashboard().finally(() => setRefreshing(false));
    }
  }, [refreshing, loadDashboard]);

  useEffect(() => {
    recordEvent("view", "dashboard", dashboard.id);

    const refreshTimer = setInterval(refreshDashboard, dashboard.dashboard_filters_refresh_interval * 1000);
    return () => {
      clearInterval(refreshTimer);
    };
  }, [dashboard.dashboard_filters_refresh_interval, refreshDashboard]);

  const onParameterMappingsChange = useCallback(() => {
    // Refresh dashboard when parameter mappings change
    refreshDashboard();
  }, [refreshDashboard]);

  // Only update dashboard if layout has changed, and debounce the save
  const debouncedUpdateDashboard = useCallback(debounce(updateDashboard, 300), [updateDashboard]);
  const handleLayoutChange = useCallback((newLayout) => {
    const normNew = normalizeLayout(newLayout);
    const normCurrent = normalizeLayout(dashboard.layout);
    
    if (!isEqual(normNew, normCurrent)) {
      Object.freeze(normNew);
      debouncedUpdateDashboard({ layout: normNew });
    }
  }, [dashboard.layout, debouncedUpdateDashboard]);

  return (
    <>
      <DashboardHeader
        dashboard={dashboard}
        isEditing={editingLayout}
        gridDisabled={gridDisabled}
        onRefresh={refreshDashboard}
        onToggleEdit={() => setEditingLayout(!editingLayout)}
        onChange={updateDashboard}
        refreshing={refreshing}
      />

      {!isEmpty(dashboard.dashboard_filters_enabled) && (
        <div className="dashboard-filters-wrapper">
          <Filters
            filters={filters}
            onChange={setFilters}
            onValuesChange={refreshDashboard}
          />
        </div>
      )}

      {editingLayout && (
        <DashboardSettings
          dashboard={dashboard}
          updateDashboard={updateDashboard}
        />
      )}

      <div className="dashboard-container">
        <DashboardGrid
          dashboard={dashboard}
          widgets={dashboard.widgets}
          filters={filters}
          isEditing={editingLayout}
          onLayoutChange={handleLayoutChange}
          onBreakpointChange={setGridDisabled}
          onRemoveWidget={removeWidget}
          onParameterMappingsChange={onParameterMappingsChange}
          isPublic={isPublic}
          isLoading={refreshing}
        />
      </div>
      {editingLayout && (
        <AddWidgetContainer
          dashboardOptions={dashboard}
          onAddWidget={() => setAddingWidget(true)}
          className="add-widget-container"
        />
      )}
    </>
  );
}

DashboardComponent.propTypes = {
  dashboard: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  editingLayout: PropTypes.bool,
  isPublic: PropTypes.bool,
};

DashboardComponent.defaultProps = {
  editingLayout: false,
  isPublic: false,
};

function DashboardPage({ dashboardSlug, dashboardId, onError }) {
  const [dashboard, setDashboard] = useState(null);
  const handleError = onError;

  useEffect(() => {
    Dashboard.get({ id: dashboardId, slug: dashboardSlug })
      .then(setDashboard)
      .catch(handleError);
  }, [dashboardSlug, dashboardId, handleError]);

  if (!dashboard) {
    return null;
  }

  return <DashboardComponent dashboard={dashboard} />;
}

DashboardPage.propTypes = {
  dashboardSlug: PropTypes.string,
  dashboardId: PropTypes.number,
  onError: PropTypes.func,
};

DashboardPage.defaultProps = {
  dashboardSlug: null,
  dashboardId: null,
  onError: () => {},
};

routes.register(
  "Dashboard",
  routeWithUserSession({
    path: "/dashboard/:dashboardSlug",
    render: pageProps => <DashboardPage {...pageProps} />,
  })
);

export default routeWithUserSession(DashboardPage);
