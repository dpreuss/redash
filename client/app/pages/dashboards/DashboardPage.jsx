import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import cx from "classnames";
import { isEmpty, debounce, isEqual } from "lodash";
import Button from "antd/lib/button";
import routeWithUserSession from "@/components/ApplicationArea/routeWithUserSession";
import DashboardGrid from "@/components/dashboards/DashboardGrid";
import Filters from "@/components/Filters";
import { Dashboard } from "@/services/dashboard";
import recordEvent from "@/services/recordEvent";
import routes from "@/services/routes";
import location from "@/services/location";
import url from "@/services/url";
import DashboardHeader from "./components/DashboardHeader";

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

function AddWidgetContainer({ className, dashboardConfiguration, ...props }) {
  const { dashboard, canEditDashboard } = dashboardConfiguration;
  return (
    <div className={cx("add-widget-container", className)}>
      <h2>
        <i className="zmdi zmdi-widgets" />
        <span className="hidden-xs hidden-sm">Add Widget</span>
      </h2>
      {canEditDashboard ? (
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
  dashboardConfiguration: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
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
  const dashboardConfiguration = useDashboard(props.dashboard);
  const { updateDashboard, loadWidget, refreshWidget, removeWidget, canEditDashboard } = dashboardConfiguration;
  const [filters, setFilters] = useState([]);
  const [editingLayout, setEditingLayout] = useState(props.editMode);
  const [gridDisabled, setGridDisabled] = useState(false);
  const [isPublic] = useState(false); // Default to false since this is the private dashboard view

  useEffect(() => {
    setEditingLayout(props.editMode);
  }, [props.editMode]);

  useEffect(() => {
    recordEvent("view", "dashboard", props.dashboard.id);
  }, [props.dashboard.id]);

  const [refreshing, setRefreshing] = useState(false);
  const refreshDashboard = useCallback(() => {
    if (!refreshing) {
      setRefreshing(true);
      const promises = props.dashboard.widgets.map(widget => refreshWidget(widget).catch(() => {}));
      Promise.all(promises).finally(() => setRefreshing(false));
    }
  }, [refreshing, props.dashboard, refreshWidget]);

  useEffect(() => {
    const refreshDashboardIfNeeded = () => {
      if (document.hidden) {
        return;
      }
      const interval = props.dashboard.dashboard_filters_refresh_interval;
      if (interval) {
        refreshDashboard();
      }
    };
    document.addEventListener("visibilitychange", refreshDashboardIfNeeded);
    return () => {
      document.removeEventListener("visibilitychange", refreshDashboardIfNeeded);
    };
  }, [props.dashboard.dashboard_filters_refresh_interval, refreshDashboard]);

  const onParameterMappingsChange = useCallback(() => {
    // Refresh dashboard when parameter mappings change
    refreshDashboard();
  }, [refreshDashboard]);

  // Only update dashboard if layout has changed, and debounce the save
  const debouncedUpdateDashboard = useCallback(debounce(updateDashboard, 300), [updateDashboard]);
  const handleLayoutChange = useCallback((newLayout) => {
    const normNew = normalizeLayout(newLayout);
    const normCurrent = normalizeLayout(props.dashboard.layout);
    
    if (!isEqual(normNew, normCurrent)) {
      Object.freeze(normNew);
      debouncedUpdateDashboard({ layout: normNew });
    }
  }, [props.dashboard.layout, debouncedUpdateDashboard]);

  return (
    <>
      <DashboardHeader
        dashboardConfiguration={{
          dashboard: props.dashboard,
          editingLayout,
          updateDashboard,
          togglePublished: props.togglePublished,
          refreshing,
          filters,
          onRename: props.onRename,
          onRefresh: refreshDashboard,
          setEditingLayout,
          gridDisabled,
          setGridDisabled,
          canEditDashboard,
          fullscreen: false,
          toggleFullscreen: () => {},
          showShareDashboardDialog: () => {},
          isDashboardOwnerOrAdmin: props.dashboard.canEdit(),
          isDuplicating: false,
          duplicateDashboard: () => {},
          archiveDashboard: () => updateDashboard({ is_archived: true }),
          managePermissions: () => {}
        }}
        headerExtra={null}
      />
      {!isEmpty(props.dashboard.widgets) && props.dashboard.dashboard_filters_enabled && (
        <div className="m-b-10 p-15 bg-white tiled">
          <Filters filters={filters} onChange={setFilters} />
        </div>
      )}
      {editingLayout && <DashboardSettings dashboard={props.dashboard} updateDashboard={updateDashboard} />}
      <div id="dashboard-container" className="dashboard-wrapper">
        <DashboardGrid
          dashboard={props.dashboard}
          widgets={props.dashboard.widgets}
          filters={filters}
          isEditing={editingLayout}
          onLoadWidget={loadWidget}
          onRefreshWidget={refreshWidget}
          onRemoveWidget={removeWidget}
          onBreakpointChange={setGridDisabled}
          onLayoutChange={handleLayoutChange}
          onParameterMappingsChange={onParameterMappingsChange}
          isPublic={isPublic}
          isLoading={refreshing}
        />
      </div>
      {editingLayout && (
        <AddWidgetContainer
          dashboardConfiguration={dashboardConfiguration}
          className={cx("add-widget-container", { disabled: gridDisabled })}
        />
      )}
    </>
  );
}

DashboardComponent.propTypes = {
  dashboard: PropTypes.object.isRequired,
  editMode: PropTypes.bool,
  togglePublished: PropTypes.func,
  onRename: PropTypes.func,
};

DashboardComponent.defaultProps = {
  editMode: false,
  togglePublished: () => {},
  onRename: () => {},
};

function DashboardPage({ dashboardSlug, dashboardId, onError }) {
  const [dashboard, setDashboard] = useState(null); // Remove if not used
  const handleError = onError;

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

export default routeWithUserSession(DashboardPage);
