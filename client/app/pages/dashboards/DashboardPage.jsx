import React, { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import cx from "classnames";
import { isEmpty, debounce, isEqual, differenceWith } from "lodash";
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
import useImmutableCallback from "@/lib/hooks/useImmutableCallback";

import { useDashboard } from "./hooks/useDashboard";

import "./DashboardPage.less";

// Add deepFreeze function at the top level, outside the component
function deepFreeze(obj) {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach(function(prop) {
    if (obj[prop] !== null 
        && (typeof obj[prop] === 'object' || typeof obj[prop] === 'function')
        && !Object.isFrozen(obj[prop])) {
      deepFreeze(obj[prop]);
    }
  });
  return obj;
}

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
          <div className="form-group dashboard-settings-color">
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

function normalizeLayout(layout) {
  // Only keep keys that matter for layout comparison
  if (!Array.isArray(layout)) return layout;
  return layout.map(item => ({
    i: item.i,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    // add more keys if needed
  })).sort((a, b) => a.i.localeCompare(b.i));
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

  const handleWidgetOptionsChange = widget => {
    const index = dashboard.widgets.findIndex(w => w.id === widget.id);
    if (index >= 0) {
      const currentWidget = dashboard.widgets[index];
      if (!isEqual(currentWidget.options, widget.options)) {
        const updatedWidgets = [...dashboard.widgets];
        updatedWidgets[index] = widget;
        updateDashboard({ 
          widgets: updatedWidgets,
          version: dashboard.version 
        }).catch(() => {
          window.location.reload();
        });
      }
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

  // Only update dashboard if layout has changed, and debounce the save
  const debouncedUpdateDashboard = useCallback(debounce(updateDashboard, 300), [updateDashboard]);
  const handleLayoutChange = useCallback((newLayout) => {
    const normNew = normalizeLayout(newLayout);
    const normCurrent = normalizeLayout(dashboard.layout);
    console.log('Comparing normalized layouts:', { normNew, normCurrent });
    if (!isEqual(normNew, normCurrent)) {
      console.log('Layout difference:', differenceWith(normNew, normCurrent, isEqual));
      debouncedUpdateDashboard({ layout: newLayout });
    }
  }, [dashboard.layout, debouncedUpdateDashboard]);

  // Deep freeze the layout before passing to DashboardGrid
  const frozenLayout = useMemo(() => deepFreeze(dashboard.layout), [dashboard.layout]);

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
          onWidgetSizeChange={onWidgetSizeChange}
          onParameterMappingsChange={onParameterMappingsChange}
          onOptionsChange={handleWidgetOptionsChange}
          isPublic={isPublic}
          isLoading={refreshing}
          onRefresh={refreshDashboard}
          backgroundColor={dashboard.options?.backgroundColor}
          layout={frozenLayout}
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
