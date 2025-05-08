import { isString, each, extend, includes, map, reduce } from "lodash";
import d3 from "d3";
import chooseTextColorForBackground from "@/lib/chooseTextColorForBackground";
import { AllColorPaletteArrays, ColorPaletteTypes } from "@/visualizations/ColorPalette";

import { cleanNumber, normalizeValue } from "./utils";

export function getPieDimensions(series: any) {
  const rows = series.length > 2 ? 2 : 1;
  const cellsInRow = Math.ceil(series.length / rows);
  const cellWidth = 1 / cellsInRow;
  const cellHeight = 1 / rows;
  const xPadding = 0.02;
  const yPadding = 0.1;

  return { rows, cellsInRow, cellWidth, cellHeight, xPadding, yPadding };
}

function getPieHoverInfoPattern(options: any) {
  const hasX = /{{\s*@@x\s*}}/.test(options.textFormat);
  let result = "text";
  if (!hasX) result += "+label";
  return result;
}

function prepareSeries(series: any, options: any, additionalOptions: any) {
  const {
    cellWidth,
    cellHeight,
    xPadding,
    yPadding,
    cellsInRow,
    hasX,
    index,
    hoverInfoPattern,
    getValueColor,
  } = additionalOptions;
  const seriesOptions = extend({ type: options.globalSeriesType, yAxis: 0 }, options.seriesOptions[series.name]);

  const xPosition = (index % cellsInRow) * cellWidth;
  const yPosition = Math.floor(index / cellsInRow) * cellHeight;

  const labelsValuesMap = new Map();

  const sourceData = new Map();
  const seriesTotal = reduce(
    series.data,
    (result, row) => {
      const y = cleanNumber(row.y);
      return result + Math.abs(y);
    },
    0
  );
  each(series.data, row => {
    const x = hasX ? normalizeValue(row.x, options.xAxis.type) : `Slice ${index}`;
    const y = cleanNumber(row.y);

    if (labelsValuesMap.has(x)) {
      labelsValuesMap.set(x, labelsValuesMap.get(x) + y);
    } else {
      labelsValuesMap.set(x, y);
    }
    const aggregatedY = labelsValuesMap.get(x);


    sourceData.set(x, {
      x,
      y: aggregatedY,
      yPercent: (aggregatedY / seriesTotal) * 100,
      row,
    });
  });

  const markerColors = map(Array.from(sourceData.values()), data => getValueColor(data.row.x));
  const textColors = map(markerColors, c => chooseTextColorForBackground(c));

  const labels = Array.from(labelsValuesMap.keys());
  const values = Array.from(labelsValuesMap.values());

  return {
    visible: true,
    values,
    labels,
    type: "pie",
    hole: 0.4,
    marker: {
      colors: markerColors,
    },
    hoverinfo: hoverInfoPattern,
    text: [],
    textinfo: options.showDataLabels ? "percent" : "none",
    textposition: "inside",
    textfont: {
      color: textColors,
    },
    name: seriesOptions.name || series.name,
    direction: options.direction.type,
    domain: {
      x: [xPosition, xPosition + cellWidth - xPadding],
      y: [yPosition, yPosition + cellHeight - yPadding],
    },
    sourceData,
    sort: options.piesort,
    color_scheme: options.color_scheme,
  };
}

export default function preparePieData(seriesList: any, options: any) {
  const colorScheme = options.color_scheme as keyof typeof AllColorPaletteArrays;
  const palette = AllColorPaletteArrays[colorScheme];
  const valuesColors: Record<string, string> = {};
  let getDefaultColor: (v: any) => string;

  if (typeof(seriesList[0]) !== 'undefined' && ColorPaletteTypes[colorScheme] === 'continuous') {
    const uniqueXValues = Array.from(new Set(seriesList[0].data.map((d: any) => String(d.x)))) as string[];
    const step = (palette.length - 1) / (uniqueXValues.length - 1 || 1);
    const colorIndices = Array.from({length: uniqueXValues.length}, (_, i) => Math.round(step * i));
    // @ts-expect-error: d3.scale.ordinal is a legacy D3 v3 API not present in @types/d3 v6+
    getDefaultColor = d3.scale.ordinal()
      .domain(uniqueXValues)
      .range(colorIndices.map(index => palette[index]));
  } else {
    // @ts-expect-error: d3.scale.ordinal is a legacy D3 v3 API not present in @types/d3 v6+
    getDefaultColor = d3.scale
      .ordinal()
      .domain([])
      .range(palette);
  }

  each(options.valuesOptions, (item, key) => {
    if (isString(item.color) && item.color !== "") {
      valuesColors[key] = item.color;
    }
  });

  const additionalOptions = {
    ...getPieDimensions(seriesList),
    hasX: includes(options.columnMapping, "x"),
    hoverInfoPattern: getPieHoverInfoPattern(options),
    getValueColor: (v: any) => valuesColors[v] || getDefaultColor(v),
  };

  return map(seriesList, (series, index) => prepareSeries(series, options, { ...additionalOptions, index }));
}
