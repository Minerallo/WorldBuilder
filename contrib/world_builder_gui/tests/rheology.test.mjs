import test from "node:test";
import assert from "node:assert/strict";
import { dislocationStress, druckerPragerYield, computeStrengthProfile, computeBdtGrid, parseEarthquakeGeoJson, compareSeismicityToBdt } from "../rheology.mjs";

test("dislocation creep strengthens with strain rate and weakens with temperature", () => {
  const base = { prefactor:1.1e-16, stressExponent:3.5, activationEnergy:530e3, activationVolume:1.4e-5, pressure:1e9 };
  assert.ok(dislocationStress({ ...base, strainRate:1e-14, temperature:1200 }) > dislocationStress({ ...base, strainRate:1e-16, temperature:1200 }));
  assert.ok(dislocationStress({ ...base, strainRate:1e-15, temperature:900 }) > dislocationStress({ ...base, strainRate:1e-15, temperature:1400 }));
});

test("Drucker-Prager yield follows dimensional forms and caps stress", () => {
  const common = { cohesion:20e6, frictionAngle:30, pressure:1e9, maxYieldStress:2e9 };
  assert.ok(druckerPragerYield({ ...common, dimension:2 }) > druckerPragerYield({ ...common, dimension:3 }));
  assert.equal(druckerPragerYield({ ...common, dimension:3, maxYieldStress:10e6 }), 10e6);
});

test("strength profile and map locate a brittle-ductile transition", () => {
  const profile = computeStrengthProfile({ maxDepthKm:150, mantleTemperature:1800, depthSamples:151 });
  assert.ok(profile.bdtDepthKm > 0 && profile.bdtDepthKm < 150);
  const grid = computeBdtGrid({ bounds:{xMin:0,xMax:10,yMin:0,yMax:5}, nx:3, ny:2, columnAt:() => ({ maxDepthKm:150, mantleTemperature:1800 }) });
  assert.equal(grid.values.length, 6);
  assert.ok(Number.isFinite(grid.min));
});

test("earthquake catalog is compared with the local plastic domain", () => {
  const events = parseEarthquakeGeoJson({ features:[{ id:"a", geometry:{coordinates:[10,20,12]}, properties:{mag:5,time:1,title:"A"} }] });
  const result = compareSeismicityToBdt(events, () => 20);
  assert.equal(result.matched, 1);
  assert.equal(result.comparisons[0].insidePlasticDomain, true);
});
