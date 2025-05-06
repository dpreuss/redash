import React, { useState } from "react";
import PropTypes from "prop-types";
import { compact, isEmpty, invoke, map } from "lodash";
import { markdown } from "markdown";
import cx from "classnames";
import Menu from "antd/lib/menu";
import notification from "antd/lib/notification";
import HtmlContent from "@redash/viz/lib/components/HtmlContent";
import { formatDateTime } from "@/lib/utils";
import Link from "@/components/Link";
import Parameters from "@/components/Parameters";
import TimeAgo from "@/components/TimeAgo";
import Timer from "@/components/Timer";
import { Moment } from "@/components/proptypes";
import { FiltersType } from "@/components/Filters";
import PlainButton from "@/components/PlainButton";
import EditParameterMappingsDialog from "@/components/dashboards/EditParameterMappingsDialog";
import VisualizationRenderer from "@/components/visualizations/VisualizationRenderer";
import { registeredVisualizations } from "@redash/viz/lib";

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
  const vizConfig = registeredVisualizations[widget.visualization.type];
  const chartName = widget.visualization.name;
  const defaultName = vizConfig ? vizConfig.name : "";
  const queryName = widget.getQuery().name;
  const description = widget.getQuery().description;
  const hasChartName = chartName && chartName !== defaultName;
  const showDescription = !!description && description.trim() !== "";

  return (
    <>
      <RefreshIndicator refreshStartedAt={refreshStartedAt} />
      <div className="t-header widget clearfix">
        <div className="th-title">
          <span>
            {hasChartName ? chartName : queryName}
            {showHeader && hasChartName && queryName && (
              <span> - {queryName}</span>
            )}
            {showHeader && showDescription && (
              <>
                <span> - </span>
                <HtmlContent className="text-muted markdown query--description" style={{ display: "inline" }}>
                  {markdown.toHTML(description)}
                </HtmlContent>
              </>
            )}
          </span>
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
  widget: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
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

  const refreshWidget = buttonId => {
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
            data-test="RefreshButton">
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
            onClick={() => refreshWidget(2)}>
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
  widget: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
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
    backgroundColor: PropTypes.string,
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
    backgroundColor: null,
  };

  constructor(props) {
    super(props);
    const { widget } = props;
    this.state = {
      localParameters: null,
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
    this.props.onLoad();
    this._mounted = true;
  }

  componentWillUnmount() {
    this._mounted = false;
    this.unregisterWidget();
  }

  visualizationWidgetMenuOptions = () => {
    const { widget, canEdit } = this.props;
    const { showHeader } = this.state;
    const { onRefresh, onParameterMappingsChange } = this.props;

    const canEditParameters = canEdit && !isEmpty(invoke(widget, "query.getParametersDefs"));
    const widgetQueryResult = widget.getQueryResult();
    const isQueryResultEmpty = !widgetQueryResult || !widgetQueryResult.isEmpty || widgetQueryResult.isEmpty();

    const downloadLink = fileType => widgetQueryResult.getLink(widget.getQuery().id, fileType);
    const downloadName = fileType => widgetQueryResult.getName(widget.getQuery().name, fileType);

    const toggleHeader = () => {
      const newOptions = {
        ...widget.options,
        showHeader: !showHeader,
      };
      widget.save('options', newOptions).then(() => {
        this.setState({ showHeader: !showHeader });
        if (typeof onRefresh === 'function') {
          onRefresh();
        }
        if (typeof onParameterMappingsChange === 'function') {
          onParameterMappingsChange();
        }
      });
    };

    return compact([
      <Menu.Item key="toggle_header" onClick={toggleHeader}>
        {showHeader ? "Hide Query" : "Show Query"}
      </Menu.Item>,
      <Menu.Divider key="divider1" />,
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
      (canEditParameters) && <Menu.Divider key="divider2" />,
      canEditParameters && (
        <Menu.Item key="edit_parameters" onClick={this.editParameterMappings}>
          Edit Parameter Mapping
        </Menu.Item>
      ),
    ]);
  }

  editParameterMappings = () => {
    const { widget } = this.props;
    const query = widget.getQuery();
    const parameters = query.getParametersDefs();

    EditParameterMappingsDialog.showModal({
      dashboard: this.props.dashboard,
      widget: this.props.widget,
      parameters,
      parameterMappings: this.state.parameterMappings,
      onChange: this.props.onParameterMappingsChange,
    }).result.finally(() => {
      this.forceUpdate();
      if (typeof this.props.onParameterMappingsChange === 'function') {
        this.props.onParameterMappingsChange();
      }
    });
  };

  onParametersEdit = parameters => {
    const { widget, onRefresh } = this.props;
    const paramOrder = map(parameters, "name");
    widget.options.paramOrder = paramOrder;
    widget.save("options", { paramOrder }).then(() => {
      if (typeof onRefresh === 'function') {
        onRefresh();
      }
      this.forceUpdate();
    }).catch(() => {
      notification.error("Could not save parameter order.");
    });
  };

  getParameters() {
    try {
      const { widget, filters } = this.props;
      const { localParameters } = this.state;
      return invoke(widget, 'getParameters', filters, localParameters);
    } catch (error) {
      // Handle error silently
      return [];
    }
  }

  onParametersUpdate = () => {
    this.props.onRefresh();
  };

  expandWidget = () => {
    this.setState({ showExpandedWidget: true });
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
              backgroundColor={this.props.backgroundColor}
            />
          </div>
        );
      default:
        return (
          <div
            className="body-row-auto spinner-container"
            role="status"
            aria-live="polite"
            aria-relevant="additions removals">
            <div className="spinner">
              <i className="zmdi zmdi-refresh zmdi-hc-spin zmdi-hc-5x" aria-hidden="true" />
              <span className="sr-only">Loading...</span>
            </div>
          </div>
        );
    }
  }

  render() {
    const { widget, isPublic, /* canEdit, isLoading: isLoadingWidget */ } = this.props; // Commented out unused destructured props
    const {
      // isLoading: isLoadingData, // Unused state variable
      // isError, // Unused state variable
      // error, // Unused state variable
      refreshStartedAt,
      // showParameterMappingsForm, // Unused state variable
      // showExpandedWidget, // Unused state variable
      showHeader,
    } = this.state;

    const widgetQueryResult = widget.getQueryResult();
    const isRefreshing = !!(widget.loading && widgetQueryResult && widgetQueryResult.getStatus());
    const parameters = this.getParameters();

    return (
      <>
        <Widget
          {...this.props}
          className="widget-visualization"
          menuOptions={this.visualizationWidgetMenuOptions()}
          header={
            <VisualizationWidgetHeader
              widget={widget}
              refreshStartedAt={refreshStartedAt}
              parameters={parameters}
              isEditing={this.props.isEditing}
              onParametersUpdate={this.onParametersUpdate}
              onParametersEdit={this.onParametersEdit}
              showHeader={showHeader}
            />
          }
          footer={
            <VisualizationWidgetFooter
              widget={widget}
              isPublic={isPublic}
              onRefresh={this.onRefresh}
              onExpand={this.expandWidget}
            />
          }
          tileProps={{ "data-refreshing": isRefreshing }}>
          {this.renderVisualization()}
        </Widget>
      </>
    );
  }
}

export default VisualizationWidget;
