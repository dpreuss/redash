import React, { useState } from "react";
import PropTypes from "prop-types";
import { compact, isEmpty, invoke, map } from "lodash";
import { markdown } from "markdown";
import cx from "classnames";
import Menu from "antd/lib/menu";
import HtmlContent from "@redash/viz/lib/components/HtmlContent";
import { currentUser } from "@/services/auth";
import recordEvent from "@/services/recordEvent";
import { formatDateTime } from "@/lib/utils";
import Link from "@/components/Link";
import Parameters from "@/components/Parameters";
import TimeAgo from "@/components/TimeAgo";
import Timer from "@/components/Timer";
import { Moment } from "@/components/proptypes";
import { FiltersType } from "@/components/Filters";
import PlainButton from "@/components/PlainButton";
import ExpandedWidgetDialog from "@/components/dashboards/ExpandedWidgetDialog";
import EditParameterMappingsDialog from "@/components/dashboards/EditParameterMappingsDialog";
import VisualizationRenderer from "@/components/visualizations/VisualizationRenderer";
import { registeredVisualizations } from "@redash/viz/lib";
import QueryLink from "@/components/QueryLink";

import Widget from "./Widget";

function RefreshIndicator({ refreshStartedAt }) {
  return (
    <div className="refresh-indicator">
      <div className="refresh-icon">
        <i className="zmdi zmdi-refresh zmdi-hc-spin" aria-hidden="true" />
        <span className="sr-only">Refreshing...</span>
      </div>
      <Timer from={refreshStartedAt} />
    </div>
  );
}

RefreshIndicator.propTypes = { refreshStartedAt: Moment };
RefreshIndicator.defaultProps = { refreshStartedAt: null };

function VisualizationWidgetHeader({
  widget,
  refreshStartedAt,
  parameters,
  isEditing,
  onParametersUpdate,
  onParametersEdit,
  showHeader,
}) {
  if (!showHeader) {
    const vizConfig = registeredVisualizations[widget.visualization.type];
    const chartName = widget.visualization.name;
    const defaultName = vizConfig ? vizConfig.name : "";
    const vizDescription = chartName && chartName !== defaultName ? chartName : "";

    return (
      <>
        {vizDescription && (
          <div className="widget-hidden-header-description p-t-5 p-b-5 p-l-15 p-r-15">
            <small>{vizDescription}</small>
          </div>
        )}
        {!isEmpty(parameters) && (
          <div className="m-b-10 p-l-15 p-r-15">
            <Parameters
              parameters={parameters}
              sortable={isEditing}
              appendSortableToParent={false}
              onValuesChange={onParametersUpdate}
              onParametersEdit={onParametersEdit}
            />
          </div>
        )}
      </>
    );
  }

  const canViewQuery = currentUser.hasPermission("view_query");
  return (
    <>
      <RefreshIndicator refreshStartedAt={refreshStartedAt} />
      <div className="t-header widget clearfix">
        <div className="th-title">
          <p>
            <QueryLink query={widget.getQuery()} visualization={widget.visualization} readOnly={!canViewQuery} />
          </p>
          {!isEmpty(widget.getQuery().description) && (
            <HtmlContent className="text-muted markdown query--description">
              {markdown.toHTML(widget.getQuery().description || "")}
            </HtmlContent>
          )}
        </div>
      </div>
      {!isEmpty(parameters) && (
        <div className="m-b-10">
          <Parameters
            parameters={parameters}
            sortable={isEditing}
            appendSortableToParent={false}
            onValuesChange={onParametersUpdate}
            onParametersEdit={onParametersEdit}
          />
        </div>
      )}
    </>
  );
}

VisualizationWidgetHeader.propTypes = {
  widget: PropTypes.object.isRequired,
  refreshStartedAt: Moment,
  parameters: PropTypes.arrayOf(PropTypes.object),
  isEditing: PropTypes.bool,
  onParametersUpdate: PropTypes.func,
  onParametersEdit: PropTypes.func,
  showHeader: PropTypes.bool,
};

VisualizationWidgetHeader.defaultProps = {
  refreshStartedAt: null,
  onParametersUpdate: () => {},
  onParametersEdit: () => {},
  isEditing: false,
  parameters: [],
  showHeader: true,
};

function VisualizationWidgetFooter({ widget, isPublic, onRefresh, onExpand }) {
  const widgetQueryResult = widget.getQueryResult();
  const updatedAt = invoke(widgetQueryResult, "getUpdatedAt");
  const [refreshClickButtonId, setRefreshClickButtonId] = useState();

  const refreshWidget = (buttonId) => {
    if (!refreshClickButtonId) {
      setRefreshClickButtonId(buttonId);
      onRefresh().finally(() => setRefreshClickButtonId(null));
    }
  };

  return widgetQueryResult ? (
    <>
      <span>
        {!isPublic && !!widgetQueryResult && (
          <PlainButton
            className="refresh-button hidden-print btn btn-sm btn-default btn-transparent"
            onClick={() => refreshWidget(1)}
            data-test="RefreshButton"
          >
            <i className={cx("zmdi zmdi-refresh", { "zmdi-hc-spin": refreshClickButtonId === 1 })} aria-hidden="true" />
            <span className="sr-only">
              {refreshClickButtonId === 1 ? "Refreshing, please wait. " : "Press to refresh. "}
            </span>{" "}
            <TimeAgo date={updatedAt} />
          </PlainButton>
        )}
        <span className="visible-print">
          <i className="zmdi zmdi-time-restore" aria-hidden="true" /> {formatDateTime(updatedAt)}
        </span>
        {isPublic && (
          <span className="small hidden-print">
            <i className="zmdi zmdi-time-restore" aria-hidden="true" /> <TimeAgo date={updatedAt} />
          </span>
        )}
      </span>
      <span>
        {!isPublic && (
          <PlainButton
            className="btn btn-sm btn-default hidden-print btn-transparent btn__refresh"
            onClick={() => refreshWidget(2)}
          >
            <i className={cx("zmdi zmdi-refresh", { "zmdi-hc-spin": refreshClickButtonId === 2 })} aria-hidden="true" />
            <span className="sr-only">
              {refreshClickButtonId === 2 ? "Refreshing, please wait." : "Press to refresh."}
            </span>
          </PlainButton>
        )}
        <PlainButton className="btn btn-sm btn-default hidden-print btn-transparent btn__refresh" onClick={onExpand}>
          <i className="zmdi zmdi-fullscreen" aria-hidden="true" />
        </PlainButton>
      </span>
    </>
  ) : null;
}

VisualizationWidgetFooter.propTypes = {
  widget: PropTypes.object.isRequired,
  isPublic: PropTypes.bool,
  onRefresh: PropTypes.func.isRequired,
  onExpand: PropTypes.func.isRequired,
};

VisualizationWidgetFooter.defaultProps = { isPublic: false };

class VisualizationWidget extends React.Component {
  static propTypes = {
    widget: PropTypes.object.isRequired,
    dashboard: PropTypes.object.isRequired,
    filters: FiltersType,
    isPublic: PropTypes.bool,
    isLoading: PropTypes.bool,
    canEdit: PropTypes.bool,
    isEditing: PropTypes.bool,
    onLoad: PropTypes.func,
    onRefresh: PropTypes.func,
    onDelete: PropTypes.func,
    onParameterMappingsChange: PropTypes.func,
    onOptionsChange: PropTypes.func,
  };

  static defaultProps = {
    filters: [],
    isPublic: false,
    isLoading: false,
    canEdit: false,
    isEditing: false,
    onLoad: () => {},
    onRefresh: () => {},
    onDelete: () => {},
    onParameterMappingsChange: () => {},
    onOptionsChange: () => {},
  };

  constructor(props) {
    super(props);
    const { widget } = props;
    this.state = {
      localParameters: props.widget.getLocalParameters(),
      localFilters: props.filters,
      isLoading: false,
      isError: false,
      error: null,
      refreshStartedAt: null,
      parameterMappings: {},
      showParameterMappingsForm: false,
      showExpandedWidget: false,
      showHeader: widget.options?.showHeader ?? true,
    };
  }

  componentDidMount() {
    const { widget, onLoad } = this.props;
    recordEvent("view", "query", widget.visualization.query.id, { dashboard: true });
    recordEvent("view", "visualization", widget.visualization.id, { dashboard: true });
    onLoad();
    this._mounted = true;
  }

  componentWillUnmount() {
    this._mounted = false;
    this.unregisterWidget();
  }

  visualizationWidgetMenuOptions = () => {
    const { widget, canEdit, onRefresh, onParameterMappingsChange: propsOnParameterMappingsChange } = this.props;
    const { showHeader } = this.state;

    const canViewQuery = currentUser.hasPermission("view_query");
    const canEditParameters = canEdit && !isEmpty(invoke(widget, "query.getParametersDefs"));
    const widgetQueryResult = widget.getQueryResult();
    const isQueryResultEmpty = !widgetQueryResult || !widgetQueryResult.isEmpty || widgetQueryResult.isEmpty();

    const parts = window.location.pathname.split("/").reverse();
    let apiKey = null;
    if (parts.length > 3 && parts[2] === "public" && parts[0].length === 40) {
      apiKey = parts[0];
    }
    const downloadLink = (fileType) => widgetQueryResult.getLink(widget.getQuery().id, fileType, apiKey);
    const downloadName = (fileType) => widgetQueryResult.getName(widget.getQuery().name, fileType);

    const toggleHeader = () => {
      const newOptions = {
        ...widget.options,
        showHeader: !showHeader,
      };
      widget.save("options", newOptions).then(() => {
        if (this._mounted) {
          this.setState({ showHeader: !showHeader });
        }
        if (typeof this.props.onOptionsChange === "function") {
          this.props.onOptionsChange(newOptions);
        }
        if (typeof onRefresh === "function") {
          onRefresh();
        }
        if (typeof propsOnParameterMappingsChange === "function") {
          propsOnParameterMappingsChange();
        }
      });
    };

    return compact([
      <Menu.Item key="toggle_header" onClick={toggleHeader}>
        {showHeader ? "Hide Header" : "Show Header"}
      </Menu.Item>,
      <Menu.Divider key="divider_after_toggle_header" />,
      <Menu.Item key="download_csv" disabled={isQueryResultEmpty}>
        {!isQueryResultEmpty ? (
          <Link href={downloadLink("csv")} download={downloadName("csv")} target="_self">
            Download as CSV File
          </Link>
        ) : (
          "Download as CSV File"
        )}
      </Menu.Item>,
      <Menu.Item key="download_tsv" disabled={isQueryResultEmpty}>
        {!isQueryResultEmpty ? (
          <Link href={downloadLink("tsv")} download={downloadName("tsv")} target="_self">
            Download as TSV File
          </Link>
        ) : (
          "Download as TSV File"
        )}
      </Menu.Item>,
      <Menu.Item key="download_excel" disabled={isQueryResultEmpty}>
        {!isQueryResultEmpty ? (
          <Link href={downloadLink("xlsx")} download={downloadName("xlsx")} target="_self">
            Download as Excel File
          </Link>
        ) : (
          "Download as Excel File"
        )}
      </Menu.Item>,
      (canViewQuery || canEditParameters) && <Menu.Divider key="divider_before_view_query" />,
      canViewQuery && (
        <Menu.Item key="view_query">
          <Link href={widget.getQuery().getUrl(true, widget.visualization.id)}>View Query</Link>
        </Menu.Item>
      ),
      canEditParameters && (
        <Menu.Item key="edit_parameters" onClick={this.editParameterMappings}>
          Edit Parameters
        </Menu.Item>
      ),
    ]);
  };

  editParameterMappings = () => {
    const { widget, dashboard, onRefresh, onParameterMappingsChange } = this.props;
    EditParameterMappingsDialog.showModal({
      dashboard,
      widget,
    }).onClose((valuesChanged) => {
      if (valuesChanged) {
        onRefresh();
      }
      onParameterMappingsChange();
      if (this._mounted) {
        this.setState({ localParameters: widget.getLocalParameters() });
      }
    });
  };

  getParameters() {
    try {
      const { widget, filters } = this.props;
      const { localParameters } = this.state;
      return invoke(widget, "getParameters", filters, localParameters);
    } catch (error) {
      return [];
    }
  }

  onParametersUpdate = () => {
    this.props.onRefresh();
  };

  expandWidget = () => {
    ExpandedWidgetDialog.showModal({ widget: this.props.widget, filters: this.state.localFilters });
  };

  onLocalFiltersChange = (localFilters) => {
    if (this._mounted) {
      this.setState({ localFilters });
    }
  };

  onRefresh = () => {
    return this.props.onRefresh();
  };

  unregisterWidget = () => {
    // Clean up code if needed
  };

  renderVisualization() {
    const { widget, filters } = this.props;
    const widgetQueryResult = widget.getQueryResult();

    const widgetStatus = widgetQueryResult && widgetQueryResult.getStatus();
    switch (widgetStatus) {
      case "failed":
        return (
          <div className="body-row-auto scrollbox">
            {widgetQueryResult.getError() && (
              <div className="alert alert-danger m-5">
                Error running query: <strong>{widgetQueryResult.getError()}</strong>
              </div>
            )}
          </div>
        );
      case "done":
        return (
          <div className="body-row-auto scrollbox">
            <VisualizationRenderer
              visualization={widget.visualization}
              queryResult={widgetQueryResult}
              filters={filters}
              onFiltersChange={this.onLocalFiltersChange}
              context="widget"
            />
          </div>
        );
      default:
        return (
          <div
            className="body-row-auto spinner-container"
            role="status"
            aria-live="polite"
            aria-relevant="additions removals"
          >
            <div className="spinner">
              <i className="zmdi zmdi-refresh zmdi-hc-spin zmdi-hc-5x" aria-hidden="true" />
              <span className="sr-only">Loading...</span>
            </div>
          </div>
        );
    }
  }

  render() {
    const { widget, isLoading, isPublic, isEditing, onRefresh: propsOnRefresh } = this.props;
    const { localParameters, showHeader } = this.state;

    const widgetQueryResult = widget.getQueryResult();
    const isRefreshing = isLoading && !!(widgetQueryResult && widgetQueryResult.getStatus());

    const onParametersEdit = (parameters) => {
      const paramOrder = map(parameters, "name");
      widget.options.paramOrder = paramOrder;
      widget.save("options", { paramOrder });
    };

    return (
      <Widget
        {...this.props}
        className="widget-visualization"
        menuOptions={this.visualizationWidgetMenuOptions()}
        header={
          <VisualizationWidgetHeader
            widget={widget}
            refreshStartedAt={isRefreshing ? widget.refreshStartedAt : null}
            parameters={localParameters}
            isEditing={isEditing}
            onParametersUpdate={this.onParametersUpdate}
            onParametersEdit={onParametersEdit}
            showHeader={showHeader}
          />
        }
        footer={
          <VisualizationWidgetFooter
            widget={widget}
            isPublic={isPublic}
            onRefresh={propsOnRefresh}
            onExpand={this.expandWidget}
          />
        }
        tileProps={{ "data-refreshing": isRefreshing }}
      >
        {this.renderVisualization()}
      </Widget>
    );
  }
}

export default VisualizationWidget;
