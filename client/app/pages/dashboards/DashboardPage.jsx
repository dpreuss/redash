import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import cx from "classnames";
import { isEmpty, debounce, isEqual } from "lodash";
import Button from "antd/lib/button";
import routeWithUserSession from "@/components/ApplicationArea/routeWithUserSession";
import DashboardGrid from "@/components/dashboards/DashboardGrid";
import DashboardHeader from "./components/DashboardHeader";
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

  const debouncedUpdate = useCallback(
    debounce((color) => {
      const newOptions = {
        ...dashboard.options,
        backgroundColor: color,
      };
      updateDashboard({ options: newOptions });
    }, 300),
    [dashboard.options, updateDashboard]
  );

  const handleBackgroundColorChange = e => {
    const color = e.target.value;
    setLocalBackgroundColor(color);
    debouncedUpdate(color);
  };

  const handleBackgroundColorChangeComplete = e => {
    const color = e.target.value;
    const newOptions = {
      ...dashboard.options,
      backgroundColor: color,
    };
    updateDashboard({ options: newOptions });
  };

  return (
    <div className="m-b-10 p-15 bg-white tiled">
      <h4 className="m-t-0">Dashboard Settings</h4>
      <div className="m-t-10 m-b-10">
        <div className="dashboard-settings-row">
          <div className="form-group dashboard-settings-filters">
            <label htmlFor="dashboard-filters-enabled">
              <input
                type="checkbox"
                id="dashboard-filters-enabled"
                checked={!!dashboard.dashboard_filters_enabled}
                onChange={e => updateDashboard({ dashboard_filters_enabled: e.target.checked })}
              />
              <span>Use Dashboard Level Filters</span>
            </label>
          </div>
          <div className="form-group dashboard-settings-color align-right">
            <label htmlFor="dashboard-background-color">Background Color</label>
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
    </div>
  );
}

DashboardSettings.propTypes = {
  dashboard: PropTypes.object.isRequired,
  updateDashboard: PropTypes.func.isRequired,
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
  const { dashboard, updateDashboard, loadWidget, refreshWidget, removeWidget, canEditDashboard } = dashboardConfiguration;
  const [filters, setFilters] = useState([]);
  const [editingLayout, setEditingLayout] = useState(props.editMode);
  const [gridDisabled, setGridDisabled] = useState(false);
  const [isPublic] = useState(false); // Default to false since this is the private dashboard view

  useEffect(() => {
    setEditingLayout(props.editMode);
  }, [props.editMode]);

  useEffect(() => {
    recordEvent("view", "dashboard", dashboard.id);
  }, [dashboard.id]);

  const [refreshing, setRefreshing] = useState(false);
  const refreshDashboard = useCallback(() => {
    if (!refreshing) {
      setRefreshing(true);
      const promises = dashboard.widgets.map(widget => refreshWidget(widget).catch(() => {}));
      Promise.all(promises).finally(() => setRefreshing(false));
    }
  }, [refreshing, dashboard, refreshWidget]);

  useEffect(() => {
    const refreshDashboardIfNeeded = () => {
      if (document.hidden) {
        return;
      }
      const interval = dashboard.dashboard_filters_refresh_interval;
      if (interval) {
        refreshDashboard();
      }
    };
    document.addEventListener("visibilitychange", refreshDashboardIfNeeded);
    return () => {
      document.removeEventListener("visibilitychange", refreshDashboardIfNeeded);
    };
  }, [dashboard.dashboard_filters_refresh_interval, refreshDashboard]);

  const onParameterMappingsChange = useCallback(() => {
    // Refresh dashboard when parameter mappings change
    refreshDashboard();
  }, [refreshDashboard]);

  // Only update dashboard if layout has changed, and debounce the save
  const debouncedUpdateDashboard = useCallback(debounce(updateDashboard, 300), [updateDashboard]);
  const handleLayoutChange = useCallback((newLayout) => {
    // Convert object to array if needed
    let layoutArray = newLayout;
    if (!Array.isArray(newLayout) && typeof newLayout === "object" && newLayout !== null) {
      layoutArray = Object.entries(newLayout).map(([i, pos]) => ({
        i,
        x: pos.col,
        y: pos.row,
        w: pos.sizeX,
        h: pos.sizeY
      }));
    }
    // console.log('[handleLayoutChange] layoutArray:', layoutArray);
    const normNew = normalizeLayout(layoutArray);
    const normCurrent = normalizeLayout(dashboard.layout);

    // Check if any positions have actually changed
    const hasPositionChanges = normNew.some(newItem => {
      const currentItem = normCurrent.find(c => c.i === newItem.i);
      if (!currentItem) return true;
      return newItem.x !== currentItem.x || 
             newItem.y !== currentItem.y || 
             newItem.w !== currentItem.w || 
             newItem.h !== currentItem.h;
    });

    if (hasPositionChanges) {
      // console.log('[handleLayoutChange] Saving dashboard layout changes');
      Object.freeze(normNew);
      debouncedUpdateDashboard({ layout: normNew });
    }
  }, [dashboard.layout, debouncedUpdateDashboard]);

  return (
    <>
      <DashboardHeader
        dashboardConfiguration={{
          dashboard,
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
          isDashboardOwnerOrAdmin: dashboard.canEdit(),
          isDuplicating: false,
          duplicateDashboard: () => {},
          archiveDashboard: () => updateDashboard({ is_archived: true }),
          managePermissions: () => {}
        }}
        headerExtra={null}
      />
      {!isEmpty(dashboard.widgets) && dashboard.dashboard_filters_enabled && (
        <div className="m-b-10 p-15 bg-white tiled">
          <Filters filters={filters} onChange={setFilters} />
        </div>
      )}
      {editingLayout && <DashboardSettings dashboard={dashboard} updateDashboard={updateDashboard} />}
      <div id="dashboard-container" className="dashboard-wrapper">
        <DashboardGrid
          dashboard={dashboard}
          widgets={dashboard.widgets}
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
  const [dashboard, setDashboard] = useState(null);
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
