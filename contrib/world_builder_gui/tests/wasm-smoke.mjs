import { GwbRuntime } from "../gwb-runtime.mjs";

const output = document.querySelector("#result");
const runtime = new GwbRuntime();

try {
  const response = await fetch("../examples/catalog.json");
  if (!response.ok) throw new Error(`Example catalog returned HTTP ${response.status}.`);
  const catalog = await response.json();
  const examples = ["cartesian", "spherical"].map(coordinateSystem =>
    catalog.find(item =>
      item.grid &&
      item.coordinateSystem === coordinateSystem &&
      item.world?.features?.length <= 5
    )
  );
  if (examples.some(example => !example)) {
    throw new Error("Suitable Cartesian and spherical GWB examples were not found.");
  }

  const summaries = [];
  for (const example of examples) {
    const result = await runtime.run({
      wbText: JSON.stringify(example.world),
      gridText: example.grid,
      resolutionLimit: 8
    }, {
      onProgress: ({ phase, progress }) => {
        output.textContent =
          `${example.coordinateSystem}: ${phase} ${Math.round(progress * 100)}%`;
      }
    });
    summaries.push({
      title: example.title,
      coordinateSystem: example.coordinateSystem,
      dimension: result.dimension,
      cells: result.cells,
      points: result.points.length / 3,
      temperatures: result.temperature.length,
      minimumTemperature: Math.min(...result.temperature),
      maximumTemperature: Math.max(...result.temperature),
      connectivity: result.connectivity.length
    });
  }

  const adaptiveExample = examples[0];
  const adaptive = await runtime.run({
    wbText: JSON.stringify(adaptiveExample.world),
    gridText: adaptiveExample.grid,
    resolutionLimit: 16,
    sampling: "adaptive",
    adaptiveOptions: {
      baseResolution: 2,
      maxDepth: 2,
      maxCells: 2000,
      temperatureTolerance: 20
    }
  });
  summaries.push({
    title: `${adaptiveExample.title} · adaptive`,
    coordinateSystem: adaptiveExample.coordinateSystem,
    dimension: adaptive.dimension,
    cells: adaptive.cells,
    leafCells: adaptive.leafCellCount,
    maximumLevel: adaptive.adaptiveMaximumLevel,
    points: adaptive.points.length / 3,
    temperatures: adaptive.temperature.length,
    minimumTemperature: Math.min(...adaptive.temperature),
    maximumTemperature: Math.max(...adaptive.temperature),
    connectivity: adaptive.connectivity.length
  });

  output.textContent = JSON.stringify({
    status: "passed",
    results: summaries
  }, null, 2);
  output.dataset.status = "passed";
} catch (error) {
  output.textContent = error?.stack || error?.message || String(error);
  output.dataset.status = "failed";
} finally {
  runtime.dispose();
}
