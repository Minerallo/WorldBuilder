import test from "node:test";
import assert from "node:assert/strict";
import { analyticalSteadyGeotherm, solveSteadyConduction, solveTransientConduction } from "../thermal-conduction.mjs";

test("steady conduction reproduces a radiogenic analytical geotherm", () => {
  const options = { nx: 8, nz: 51, width: 70000, depth: 100000, conductivity: 3, heatProduction: 1e-6,
    density: 2800, heatCapacity: 1000, topTemperature: 273, bottomTemperature: 1573,
    bottomMode: "temperature", tolerance: 2e-4, maxIterations: 12000 };
  const result = solveSteadyConduction(options);
  const zIndex = 25; const numerical = result.temperature[zIndex * result.nx + 3];
  const analytical = analyticalSteadyGeotherm(options, options.depth * zIndex / (result.nz - 1));
  assert.ok(result.converged);
  assert.ok(Math.abs(numerical - analytical) < 1.5, `${numerical} K differs from ${analytical} K`);
});

test("basal heat-flux boundary produces the expected linear gradient", () => {
  const result = solveSteadyConduction({ nx: 6, nz: 41, width: 50000, depth: 80000, conductivity: 4,
    heatProduction: 0, topTemperature: 280, bottomTemperature: 1200, bottomMode: "flux", bottomHeatFlux: .04,
    tolerance: 1e-4, maxIterations: 10000 });
  const bottom = result.temperature[(result.nz - 1) * result.nx + 2];
  assert.ok(Math.abs(bottom - (280 + .04 * 80000 / 4)) < 2);
});

test("transient conduction advances a finite stable temperature field", () => {
  const result = solveTransientConduction({ nx: 12, nz: 16, width: 100000, depth: 120000, conductivity: 3,
    heatProduction: 5e-7, density: 2800, heatCapacity: 1000, topTemperature: 273, bottomTemperature: 1500,
    bottomMode: "temperature", timeYears: 2e6 });
  assert.equal(result.temperature.length, 192);
  assert.ok(result.temperature.every(Number.isFinite));
  assert.ok(result.iterations > 0);
});
