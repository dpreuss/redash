import moment from "moment";
import { axios } from "@/services/axios";
import {
  each,
  pick,
  extend,
  isObject,
  truncate,
  keys,
  difference,
  filter,
  map,
  merge,
  sortBy,
  indexOf,
  size,
  includes,
  isArray,
} from "lodash";
import location from "@/services/location";
import { cloneParameter } from "@/services/parameters";
import dashboardGridOptions from "@/config/dashboard-grid-options";
import { registeredVisualizations } from "@redash/viz/lib";
import { Query } from "./query";
import { Parameter } from "@/services/parameters";
import { ParameterMappingType } from "@/services/widget-parameters";

export const WidgetTypeEnum = {
  TEXTBOX: "textbox",
  VISUALIZATION: "visualization",
  RESTRICTED: "restricted",
};

function calculatePositionOptions(widget) {
  widget.width = 1; // Backward compatibility, user on back-end

  const visualizationOptions = {
    autoHeight: false,
    sizeX: Math.round(dashboardGridOptions.columns / 2),
    sizeY: dashboardGridOptions.defaultSizeY,
    minSizeX: dashboardGridOptions.minSizeX,
    maxSizeX: dashboardGridOptions.maxSizeX,
    minSizeY: dashboardGridOptions.minSizeY,
    maxSizeY: dashboardGridOptions.maxSizeY,
  };

  const config = widget.visualization ? registeredVisualizations[widget.visualization.type] : null;
  if (isObject(config)) {
    if (Object.prototype.hasOwnProperty.call(config, "autoHeight")) {
      visualizationOptions.autoHeight = config.autoHeight;
    }

    // Width constraints
    const minColumns = parseInt(config.minColumns, 10);
    if (isFinite(minColumns) && minColumns >= 0) {
      visualizationOptions.minSizeX = minColumns;
    }
    const maxColumns = parseInt(config.maxColumns, 10);
    if (isFinite(maxColumns) && maxColumns >= 0) {
      visualizationOptions.maxSizeX = Math.min(maxColumns, dashboardGridOptions.columns);
    }

    // Height constraints
    // `minRows` is preferred, but it should be kept for backward compatibility
    const height = parseInt(config.height, 10);
    if (isFinite(height)) {
      visualizationOptions.minSizeY = Math.ceil(height / dashboardGridOptions.rowHeight);
    }
    const minRows = parseInt(config.minRows, 10);
    if (isFinite(minRows)) {
      visualizationOptions.minSizeY = minRows;
    }
    const maxRows = parseInt(config.maxRows, 10);
    if (isFinite(maxRows) && maxRows >= 0) {
      visualizationOptions.maxSizeY = maxRows;
    }

    // Default dimensions
    const defaultWidth = parseInt(config.defaultColumns, 10);
    if (isFinite(defaultWidth) && defaultWidth > 0) {
      visualizationOptions.sizeX = defaultWidth;
    }
    const defaultHeight = parseInt(config.defaultRows, 10);
    if (isFinite(defaultHeight) && defaultHeight > 0) {
      visualizationOptions.sizeY = defaultHeight;
    }
  }

  return visualizationOptions;
}

class Widget {
  static MappingType = ParameterMappingType;

  constructor(data) {
    extend(this, data);

    const visualizationOptions = calculatePositionOptions(this);

    this.options = this.options || {};
    this.options.position = extend(
      {},
      visualizationOptions,
      pick(this.options.position, ["col", "row", "sizeX", "sizeY", "autoHeight"])
    );

    if (this.options.position.sizeY < 0) {
      this.options.position.autoHeight = true;
    }

    if (isObject(this.options) && !isArray(this.options)) {
      this.options = JSON.stringify(this.options);
    }
  }

  get type() {
    if (this.visualization) {
      return WidgetTypeEnum.VISUALIZATION;
    } else if (this.restricted) {
      return WidgetTypeEnum.RESTRICTED;
    }
    return WidgetTypeEnum.TEXTBOX;
  }

  getQuery() {
    if (!this.query && this.visualization) {
      this.query = this.visualization.query;
    }
    return this.query;
  }

  getQueryResult() {
    return this.query_result || this.getQuery().getQueryResult();
  }

  getName() {
    if (this.visualization) {
      return `${this.visualization.query.name} (${this.visualization.name})`;
    }
    return this.text;
  }

  load(force, maxAge) {
    if (!this.visualization) {
      return Promise.resolve();
    }

    // Both `this.query` and `this.visualization.query` are the same object, but `this.query` might be null if not
    // assigned yet. In this case, load from `this.visualization.query` but update `this.query` too, so on the
    // next call to load, the condition above will return false and this block will be skipped.
    if (!this.query && this.visualization.query) {
      this.query = this.visualization.query;
    }

    return this.query.getQueryResult(force, maxAge).then(queryResult => {
      this.query_result = queryResult;
      return queryResult;
    });
  }

  save(data = {}) {
    let url = "api/widgets";
    if (this.id) {
      url = `${url}/${this.id}`;
    }

    return axios.post(url, data).then(response => {
      each(response.data, (v, k) => {
        this[k] = v;
      });

      return this;
    });
  }

  delete() {
    const url = `api/widgets/${this.id}`;
    return axios.delete(url);
  }

  isStaticParam(param) {
    return !this.getQuery().getParametersDefs().some(p => p.name === param);
  }

  getParametersDefs() {
    const parameters = [];
    if (this.getQuery()) {
      parameters.push(...this.getQuery().getParametersDefs());
    }
    return parameters;
  }

  getParameters() {
    if (!this.getQuery()) {
      return [];
    }

    const parametersDefs = this.getQuery().getParametersDefs();
    const parameters = [];

    each(this.getParameterMappings(), mapping => {
      const param = parametersDefs.find(p => p.name === mapping.name);
      if (param) {
        const result = Parameter.create(param, mapping);
        parameters.push(result);
      }
    });

    return parameters;
  }

  getParameterMappings() {
    if (!isObject(this.options)) {
      this.options = JSON.parse(this.options);
    }
    return this.options.parameterMappings || [];
  }
}

export default Widget;
