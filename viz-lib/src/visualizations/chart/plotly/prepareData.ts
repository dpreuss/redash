import preparePieData from "./preparePieData";
import prepareHeatmapData from "./prepareHeatmapData";
import prepareDefaultData from "./prepareDefaultData";
import updateData from "./updateData";
import { AllColorPaletteArrays } from "@/visualizations/ColorPalette";
const PALETTE_NAMES = Object.keys(AllColorPaletteArrays) as Array<keyof typeof AllColorPaletteArrays>;

export default function prepareData(seriesList: any, options: any) {
  // Defensive: ensure color_scheme is always valid
  const colorScheme: keyof typeof AllColorPaletteArrays =
    PALETTE_NAMES.includes(options.color_scheme) ? options.color_scheme : "Redash";
  options = { ...options, color_scheme: colorScheme };

  switch (options.globalSeriesType) {
    case "pie":
      return updateData(preparePieData(seriesList, options), options);
    case "heatmap":
      // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
      return updateData(prepareHeatmapData(seriesList, options, options));
    default:
      return updateData(prepareDefaultData(seriesList, options), options);
  }
}
