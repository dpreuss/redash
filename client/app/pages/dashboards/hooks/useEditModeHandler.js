import { debounce, find, has, isMatch, map, pickBy } from "lodash";
import { useCallback, useEffect, useState } from "react";
import location from "@/services/location";
import notification from "@/services/notification";
import { axios } from "@/services/axios";

export const DashboardStatusEnum = {
  SAVED: "saved",
  SAVING: "saving",
  SAVING_FAILED: "saving_failed",
};

function getChangedPositions(widgets, nextPositions = {}) {
  return pickBy(nextPositions, (nextPos, widgetId) => {
    const widget = find(widgets, { id: Number(widgetId) });
    const prevPos = widget.options.position;
    return !isMatch(prevPos, nextPos);
  });
}

export default function useEditModeHandler(canEditDashboard, widgets) {
  const [editingLayout, setEditingLayout] = useState(canEditDashboard && has(location.search, "edit"));
  const [dashboardStatus, setDashboardStatus] = useState(DashboardStatusEnum.SAVED);
  const [recentPositions, setRecentPositions] = useState([]);
  const [doneBtnClickedWhileSaving, setDoneBtnClickedWhileSaving] = useState(false);

  useEffect(() => {
    location.setSearch({ edit: editingLayout ? true : null }, true);
  }, [editingLayout]);

  useEffect(() => {
    if (doneBtnClickedWhileSaving && dashboardStatus === DashboardStatusEnum.SAVED) {
      setDoneBtnClickedWhileSaving(false);
      setEditingLayout(false);
    }
  }, [doneBtnClickedWhileSaving, dashboardStatus]);

  const saveDashboardLayout = useCallback(
    (positions) => {
      if (!canEditDashboard) {
        // console.log('[setDashboardStatus] SAVED (no edit permission)');
        setDashboardStatus(DashboardStatusEnum.SAVED);
        return;
      }

      const changedPositions = getChangedPositions(widgets, positions);

      // Debug logging
      // console.log('[saveDashboardLayout] positions:', positions);
      // console.log('[saveDashboardLayout] widgets:', widgets.map(w => ({id: w.id, pos: w.options.position})));
      // console.log('[saveDashboardLayout] changedPositions:', changedPositions);

      // Guard: Only save if there are actually changed positions
      if (!changedPositions || Object.keys(changedPositions).length === 0) {
        // console.log('[setDashboardStatus] SAVED (no changed positions)');
        setDashboardStatus(DashboardStatusEnum.SAVED);
        return;
      }

      // console.log('[setDashboardStatus] SAVING');
      setDashboardStatus(DashboardStatusEnum.SAVING);
      setRecentPositions(positions);
      const saveChangedWidgets = map(changedPositions, (position, id) => {
        // find widget
        const widget = find(widgets, { id: Number(id) });

        // skip already deleted widget
        if (!widget) {
          return Promise.resolve();
        }

        const saveWidget = () => widget.save("options", { position });

        return saveWidget().catch((error) => {
          if (error.response && error.response.status === 409) {
            // If we get a version conflict, refresh the widget data and try again
            return axios.get(`api/widgets/${widget.id}`).then((response) => {
              // Update the widget with fresh data
              Object.assign(widget, response.data);
              // Try saving again with new version
              return saveWidget();
            });
          }
          throw error;
        });
      });

      return Promise.all(saveChangedWidgets)
        .then(() => {
          // console.log('[setDashboardStatus] SAVED (save success)');
          setDashboardStatus(DashboardStatusEnum.SAVED);
        })
        .catch((error) => {
          // console.log('[setDashboardStatus] SAVING_FAILED', error);
          setDashboardStatus(DashboardStatusEnum.SAVING_FAILED);
          if (error.response && error.response.status === 409) {
            notification.error("Version Conflict", "The dashboard layout has been modified. Please try saving again.", {
              duration: null,
            });
          } else {
            notification.error(
              "Error Saving Layout",
              "There was a problem saving the dashboard layout. Please try again.",
              { duration: null }
            );
          }
        });
    },
    [canEditDashboard, widgets]
  );

  const saveDashboardLayoutDebounced = useCallback(
    (...args) => {
      setDashboardStatus(DashboardStatusEnum.SAVING);
      return debounce(() => saveDashboardLayout(...args), 2000)();
    },
    [saveDashboardLayout]
  );

  const retrySaveDashboardLayout = useCallback(
    () => saveDashboardLayout(recentPositions),
    [recentPositions, saveDashboardLayout]
  );

  const setEditing = useCallback(
    (editing) => {
      if (!editing && dashboardStatus !== DashboardStatusEnum.SAVED) {
        // console.log('[setDashboardStatus] Done button clicked while not SAVED');
        setDoneBtnClickedWhileSaving(true);
        return;
      }
      setEditingLayout(canEditDashboard && editing);
    },
    [dashboardStatus, canEditDashboard]
  );

  return {
    editingLayout: canEditDashboard && editingLayout,
    setEditingLayout: setEditing,
    saveDashboardLayout: editingLayout ? saveDashboardLayoutDebounced : saveDashboardLayout,
    retrySaveDashboardLayout,
    doneBtnClickedWhileSaving,
    dashboardStatus,
  };
}
