import React from "react";
import PropTypes from "prop-types";
import { VisualizationWidget, TextboxWidget, RestrictedWidget } from "@/components/dashboards/dashboard-widget";
import { WidgetTypeEnum } from "./WidgetTypeEnum";

function Widget({
  widget,
  dashboard,
  filters,
  isEditing,
  isPublic,
  onLoadWidget,
  onRefreshWidget,
  onRemoveWidget,
  onParameterMappingsChange,
  backgroundColor,
}) {
  const { type } = widget;
  const onLoad = () => onLoadWidget(widget);
  const onRefresh = () => onRefreshWidget(widget);
  const onDelete = () => onRemoveWidget(widget.id);

  if (type === WidgetTypeEnum.VISUALIZATION) {
    return (
      <VisualizationWidget
        widget={widget}
        dashboard={dashboard}
        filters={filters}
        isEditing={isEditing}
        canEdit={dashboard.canEdit()}
        isPublic={isPublic}
        isLoading={widget.loading}
        onLoad={onLoad}
        onRefresh={onRefresh}
        onDelete={onDelete}
        onParameterMappingsChange={onParameterMappingsChange}
        backgroundColor={backgroundColor}
      />
    );
  }
  if (type === WidgetTypeEnum.TEXTBOX) {
    return (
      <TextboxWidget
        widget={widget}
        canEdit={dashboard.canEdit()}
        isPublic={isPublic}
        onDelete={onDelete}
      />
    );
  }
  return <RestrictedWidget widget={widget} />;
}

Widget.propTypes = {
  widget: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  dashboard: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  filters: PropTypes.object, // eslint-disable-line react/forbid-prop-types
  isEditing: PropTypes.bool,
  isPublic: PropTypes.bool,
  onLoadWidget: PropTypes.func,
  onRefreshWidget: PropTypes.func,
  onRemoveWidget: PropTypes.func,
  onParameterMappingsChange: PropTypes.func,
  backgroundColor: PropTypes.string,
};

Widget.defaultProps = {
  filters: {},
  isEditing: false,
  isPublic: false,
  onLoadWidget: () => {},
  onRefreshWidget: () => {},
  onRemoveWidget: () => {},
  onParameterMappingsChange: () => {},
  backgroundColor: null,
};

export default Widget; 