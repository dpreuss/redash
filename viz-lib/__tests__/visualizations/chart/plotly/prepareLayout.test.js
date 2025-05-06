import { prepareLayout } from "../../../../src/visualizations/chart/plotly/prepareLayout";

describe("Chart Background", () => {
  it("should set background color in layout when specified", () => {
    const element = { offsetWidth: 100, offsetHeight: 100 };
    const options = {
      legend: { enabled: true, traceorder: "normal" },
      backgroundColor: "#f0f0f0",
    };
    const data = [];

    const layout = prepareLayout(element, options, data);

    expect(layout.paper_bgcolor).toBe("#f0f0f0");
    expect(layout.plot_bgcolor).toBe("#f0f0f0");
  });

  it("should use default background color when not specified", () => {
    const element = { offsetWidth: 100, offsetHeight: 100 };
    const options = {
      legend: { enabled: true, traceorder: "normal" },
    };
    const data = [];

    const layout = prepareLayout(element, options, data);

    expect(layout.paper_bgcolor).toBe("#ffffff");
    expect(layout.plot_bgcolor).toBe("#ffffff");
  });
});
