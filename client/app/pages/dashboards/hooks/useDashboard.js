import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { isEmpty, includes, compact, map, has, pick, keys, extend, every, get } from "lodash";
import notification from "@/services/notification";
import location from "@/services/location";
import url from "@/services/url";
import { Dashboard, collectDashboardFilters } from "@/services/dashboard";
import { currentUser } from "@/services/auth";
import recordEvent from "@/services/recordEvent";
import { QueryResultError } from "@/services/query";
import AddWidgetDialog from "@/components/dashboards/AddWidgetDialog";
import TextboxDialog from "@/components/dashboards/TextboxDialog";
import PermissionsEditorDialog from "@/components/PermissionsEditorDialog";
import { editableMappingsToParameterMappings, synchronizeWidgetTitles } from "@/components/ParameterMappingInput";
import ShareDashboardDialog from "../components/ShareDashboardDialog";
import useFullscreenHandler from "../../../lib/hooks/useFullscreenHandler";
import useRefreshRateHandler from "./useRefreshRateHandler";
import useEditModeHandler, { DashboardStatusEnum } from "./useEditModeHandler";
import useDuplicateDashboard from "./useDuplicateDashboard";
import { policy } from "@/services/policy";
import { normalizeLayout } from "../DashboardPage";

export { DashboardStatusEnum };

function getAffectedWidgets(widgets, updatedParameters = []) {
  return !isEmpty(updatedParameters)
    ? widgets.filter(widget =>
        Object.values(widget.getParameterMappings())
          .filter(({ type }) => type === "dashboard-level")
          .some(({ mapTo }) =>
            includes(
              updatedParameters.map(p => p.name),
              mapTo
            )
          )
      )
    : widgets;
}

export function useDashboard(dashboardData) {
  const [dashboard, setDashboard] = useState(dashboardData);
  const [filters, setFilters] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [gridDisabled, setGridDisabled] = useState(false);
  const globalParameters = useMemo(() => dashboard.getParametersDefs(), [dashboard]);
  const canEditDashboard = !dashboard.is_archived && policy.canEdit(dashboard);
  const isDashboardOwnerOrAdmin = useMemo(
    () =>
      !dashboard.is_archived &&
      has(dashboard, "user.id") &&
      (currentUser.id === dashboard.user.id || currentUser.isAdmin),
    [dashboard]
  );
  const hasOnlySafeQueries = useMemo(
    () => every(dashboard.widgets, w => (w.getQuery() ? w.getQuery().is_safe : true)),
    [dashboard]
  );

  const [isDuplicating, duplicateDashboard] = useDuplicateDashboard(dashboard);

  const managePermissions = useCallback(() => {
    const aclUrl = `api/dashboards/${dashboard.id}/acl`;
    PermissionsEditorDialog.showModal({
      aclUrl,
      context: "dashboard",
      author: dashboard.user,
    });
  }, [dashboard]);

  const updateDashboard = useCallback(
    (data, includeVersion = true) => {
      // Normalize layout if present
      if (data.layout) {
        data.layout = normalizeLayout(data.layout);
      }
      setDashboard(currentDashboard => extend({}, currentDashboard, data));
      data = { ...data, id: dashboard.id };
      if (includeVersion) {
        data = { ...data, version: dashboard.version };
      }
      return Dashboard.save(data)
        .then(updatedDashboard => {
          setDashboard(currentDashboard => extend({}, currentDashboard, pick(updatedDashboard, keys(data))));
          if (has(data, "name")) {
            location.setPath(url.parse(updatedDashboard.url).pathname, true);
          }
        })
        .catch(error => {
          const status = get(error, "response.status");
          if (status === 403) {
            notification.error("Dashboard update failed", "Permission Denied.");
          } else if (status === 409) {
            notification.error(
              "Dashboard Version Conflict", 
              "The dashboard has been modified by another user. Please reload the page to get the latest version.",
              { duration: null }
            );
          }
        });
    },
    [dashboard]
  );

  const togglePublished = useCallback(() => {
    recordEvent("toggle_published", "dashboard", dashboard.id);
    updateDashboard({ is_draft: !dashboard.is_draft }, false);
  }, [dashboard, updateDashboard]);

  const loadWidget = useCallback((widget, forceRefresh = false) => {
    // console.log('[loadWidget] called for widget:', widget.id, 'forceRefresh:', forceRefresh);
    // console.trace('[loadWidget] call stack');
    widget.getParametersDefs(); // Force widget to read parameters values from URL
    return widget
      .load(forceRefresh)
      .catch(error => {
        // QueryResultErrors are expected
        if (error instanceof QueryResultError) {
          return;
        }
        return Promise.reject(error);
      });
  }, []);

  const refreshWidget = useCallback(widget => loadWidget(widget, true), [loadWidget]);

  const removeWidget = useCallback(widgetId => {
    setDashboard(currentDashboard =>
      extend({}, currentDashboard, {
        widgets: currentDashboard.widgets.filter(widget => widget.id !== undefined && widget.id !== widgetId),
      })
    );
  }, []);

  const dashboardRef = useRef();
  dashboardRef.current = dashboard;

  const loadDashboard = useCallback(
    (forceRefresh = false, updatedParameters = []) => {
      const affectedWidgets = getAffectedWidgets(dashboard.widgets, updatedParameters);
      const loadWidgetPromises = compact(
        affectedWidgets.map(widget => loadWidget(widget, forceRefresh).catch(error => error))
      );

      return Promise.all(loadWidgetPromises).then(() => {
        const queryResults = compact(map(dashboard.widgets, widget => widget.getQueryResult()));
        const updatedFilters = collectDashboardFilters(dashboard, queryResults, location.search);
        setFilters(updatedFilters);
      });
    },
    [dashboard, loadWidget]
  );

  const refreshDashboard = useCallback(
    updatedParameters => {
      if (!refreshing) {
        setRefreshing(true);
        loadDashboard(true, updatedParameters).finally(() => setRefreshing(false));
      }
    },
    [refreshing, loadDashboard]
  );

  const archiveDashboard = useCallback(() => {
    recordEvent("archive", "dashboard", dashboard.id);
    Dashboard.delete(dashboard).then(updatedDashboard =>
      setDashboard(currentDashboard => extend({}, currentDashboard, pick(updatedDashboard, ["is_archived"])))
    );
  }, [dashboard]); // eslint-disable-line react-hooks/exhaustive-deps

  const showShareDashboardDialog = useCallback(() => {
    const handleDialogClose = () => setDashboard(currentDashboard => extend({}, currentDashboard));

    ShareDashboardDialog.showModal({
      dashboard,
      hasOnlySafeQueries,
    })
      .onClose(handleDialogClose)
      .onDismiss(handleDialogClose);
  }, [dashboard, hasOnlySafeQueries]);

  const showAddTextboxDialog = useCallback(() => {
    TextboxDialog.showModal({
      isNew: true,
    }).onClose(text =>
      dashboard.addWidget(text).then(() => setDashboard(currentDashboard => extend({}, currentDashboard)))
    );
  }, [dashboard]);

  const showAddWidgetDialog = useCallback(() => {
    AddWidgetDialog.showModal({
      dashboard,
    }).onClose(({ visualization, parameterMappings }) =>
      dashboard
        .addWidget(visualization, {
          parameterMappings: editableMappingsToParameterMappings(parameterMappings),
        })
        .then(widget => {
          const widgetsToSave = [
            widget,
            ...synchronizeWidgetTitles(widget.options.parameterMappings, dashboard.widgets),
          ];
          return Promise.all(widgetsToSave.map(w => w.save())).then(() =>
            setDashboard(currentDashboard => extend({}, currentDashboard))
          );
        })
    );
  }, [dashboard]);

  const [refreshRate, setRefreshRate, disableRefreshRate] = useRefreshRateHandler(refreshDashboard);
  const [fullscreen, toggleFullscreen] = useFullscreenHandler();
  const editModeHandler = useEditModeHandler(!gridDisabled && canEditDashboard, dashboard.widgets);

  useEffect(() => {
    setDashboard(dashboardData);
    loadDashboard();
    // Initialize layout if empty
    if (dashboardData && (!dashboardData.layout || dashboardData.layout.length === 0)) {
      const initialLayout = dashboardData.widgets.map(widget => ({
        i: widget.id.toString(),
        x: widget.options.position.col,
        y: widget.options.position.row,
        w: widget.options.position.sizeX,
        h: widget.options.position.sizeY,
      }));
      setDashboard(currentDashboard => ({ ...currentDashboard, layout: initialLayout }));
    }
  }, [dashboardData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.title = dashboard.name;
  }, [dashboard.name]);

  // reload dashboard when filter option changes
  useEffect(() => {
    loadDashboard();
  }, [dashboard.dashboard_filters_enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    dashboard,
    globalParameters,
    refreshing,
    filters,
    setFilters,
    loadDashboard,
    refreshDashboard,
    updateDashboard,
    togglePublished,
    archiveDashboard,
    loadWidget,
    refreshWidget,
    removeWidget,
    canEditDashboard,
    isDashboardOwnerOrAdmin,
    refreshRate,
    setRefreshRate,
    disableRefreshRate,
    ...editModeHandler,
    gridDisabled,
    setGridDisabled,
    fullscreen,
    toggleFullscreen,
    showShareDashboardDialog,
    showAddTextboxDialog,
    showAddWidgetDialog,
    managePermissions,
    isDuplicating,
    duplicateDashboard,
  };
}
