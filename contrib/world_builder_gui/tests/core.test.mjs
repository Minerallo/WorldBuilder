import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS, createFeature, buildWorldBuilder, buildGrid, buildVtp,
  connectFeatures, validateProject, importWorldBuilder, applyGridConfig,
  geologicalLayerPreset, createPlacementPoints
} from "../core.js";
import { buildSubmachineRequest, extractSubmachineImageUrl } from "../submachine.mjs";

test("builds a minimal World Builder document", () => {
  const plate = createFeature("continental plate", 300000, 150000, 0);
  const world = buildWorldBuilder(DEFAULT_SETTINGS, [plate]);
  assert.equal(world.version, "1.2");
  assert.equal(world.features[0].model, "continental plate");
  assert.equal(world.features[0]["temperature models"][0].model, "uniform");
  assert.deepEqual(world["coordinate system"], { model: "cartesian" });
});

test("uses a user-drawn cross section in 2D output", () => {
  const settings = { ...DEFAULT_SETTINGS, section: [[10000, 20000], [900000, 300000]] };
  const world = buildWorldBuilder(settings, []);
  assert.deepEqual(world["cross section"], settings.section);
});

test("subduction exposes valid geometry and thermal controls", () => {
  const slab = createFeature("subducting plate", 400000, 200000, 0);
  slab.temperatureModel = "mass conserving";
  const feature = buildWorldBuilder(DEFAULT_SETTINGS, [slab]).features[0];
  assert.deepEqual(feature.segments[0].thickness, [90000]);
  assert.equal(feature["temperature models"][0]["subducting velocity"], 0.05);
  assert.equal(feature["temperature models"][0]["spreading velocity"], 0.05);
});

test("fault exports explicit dip geometry instead of relying on unsupported defaults", () => {
  const fault = createFeature("fault", 400000, 200000, 0);
  const feature = buildWorldBuilder(DEFAULT_SETTINGS, [fault]).features[0];
  assert.equal(feature.model, "fault");
  assert.equal(feature.segments[0].angle[0], 45);
  assert.equal(feature["temperature models"][0].model, "uniform");
});

test("builds gwb-grid configuration", () => {
  const grid = buildGrid(DEFAULT_SETTINGS);
  assert.match(grid, /grid_type = cartesian/);
  assert.match(grid, /n_cell_x = 40/);
  assert.match(grid, /n_cell_z = 20/);
});

test("adds y bounds and resolution for a 3D grid", () => {
  const grid = buildGrid({ ...DEFAULT_SETTINGS, dimension: 3 });
  assert.match(grid, /y_min = 0/);
  assert.match(grid, /y_max = 600000/);
  assert.match(grid, /n_cell_y = 24/);
});

test("exports website-ready VTK XML PolyData with physical arrays", () => {
  const plate = createFeature("continental plate", 300000, 150000, 0);
  plate.referenceDensity = 2825;
  const slab = createFeature("subducting plate", 500000, 180000, 1);
  const vtp = buildVtp(DEFAULT_SETTINGS, [plate, slab]);
  assert.match(vtp, /<VTKFile type="PolyData"/);
  assert.match(vtp, /NumberOfPoints="12"/);
  assert.match(vtp, /NumberOfLines="2"/);
  assert.match(vtp, /Name="Temperature"/);
  assert.match(vtp, /Name="Density"/);
  assert.match(vtp, /Name="Composition"/);
  assert.match(vtp, /Name="FeatureId"/);
});

test("connecting features creates one shared coordinate", () => {
  const a = createFeature("oceanic plate", 250000, 150000, 0);
  const b = createFeature("subducting plate", 500000, 150000, 1);
  assert.equal(connectFeatures(a, b), true);
  assert.ok(b.points.some(point => point[0] === a.points.at(-1)[0] && point[1] === a.points.at(-1)[1]));
});

test("creates selectable placement geometry for area and line features", () => {
  assert.equal(createPlacementPoints("area", 0, 0, "ellipse").length, 16);
  assert.equal(createPlacementPoints("area", 0, 0, "wedge").length, 3);
  assert.equal(createPlacementPoints("area", 0, 0, "irregular").length, 7);
  assert.equal(createPlacementPoints("line", 0, 0, "curved").length, 7);
  assert.equal(createPlacementPoints("line", 0, 0, "segmented").length, 5);
  assert.deepEqual(createPlacementPoints("point", 12, 24, "point"), [[12, 24]]);
});

test("validation rejects inverted domains and zero mesh cells", () => {
  const settings = { ...DEFAULT_SETTINGS, xMin: 10, xMax: 0, cellsX: 0 };
  const errors = validateProject(settings, []);
  assert.equal(errors.length, 2);
});

test("advanced imported parameters survive a round trip", () => {
  const source = {
    version: "1.2",
    "coordinate system": { model: "cartesian" },
    "custom global": { preserved: true },
    features: [{
      model: "subducting plate",
      name: "Detailed slab",
      coordinates: [[0, 0], [100000, 0]],
      "dip point": [50000, 200000],
      segments: [
        { length: 100000, thickness: [80000], angle: [35], "top truncation": [-1] },
        { length: 200000, thickness: [70000], angle: [55] }
      ],
      sections: [{ coordinate: 1, segments: [] }],
      "temperature models": [{ model: "mass conserving", "spreading velocity": 0.04, "subducting velocity": 0.06 }]
    }]
  };
  const imported = importWorldBuilder(source);
  imported.features[0].name = "Renamed slab";
  const output = buildWorldBuilder(imported.settings, imported.features, imported.rawWorld);
  assert.equal(output["custom global"].preserved, true);
  assert.equal(output.features[0].segments.length, 2);
  assert.deepEqual(output.features[0].sections, source.features[0].sections);
  assert.equal(output.features[0]["temperature models"][0].model, "mass conserving");
  assert.equal(output.features[0].name, "Renamed slab");
});

test("editing an imported outline preserves its detailed slab segments", () => {
  const source = {
    version: "1.2",
    "coordinate system": { model: "cartesian" },
    features: [{
      model: "subducting plate",
      name: "Curved slab",
      coordinates: [[0, 0], [100000, 20000], [220000, 0]],
      "dip point": [100000, 150000],
      segments: [
        { length: 100000, thickness: [80000, 70000], angle: [35, 45] },
        { length: 120000, thickness: [70000], angle: [55] }
      ]
    }]
  };
  const imported = importWorldBuilder(source);
  imported.features[0].points.splice(1, 0, [50000, 12000]);
  imported.features[0].geometryEdited = true;
  const output = buildWorldBuilder(imported.settings, imported.features, imported.rawWorld);
  assert.equal(output.features[0].coordinates.length, 4);
  assert.deepEqual(output.features[0].segments, source.features[0].segments);
});

test("editing a slab parameter changes only its first segment", () => {
  const source = {
    version: "1.2",
    "coordinate system": { model: "cartesian" },
    features: [{
      model: "subducting plate",
      coordinates: [[0, 0], [100000, 0]],
      "dip point": [50000, 100000],
      segments: [
        { length: 100000, thickness: [80000], angle: [35], custom: true },
        { length: 200000, thickness: [60000], angle: [50] }
      ]
    }]
  };
  const imported = importWorldBuilder(source);
  imported.features[0].angle = 42;
  imported.features[0].segmentEdited = true;
  const output = buildWorldBuilder(imported.settings, imported.features, imported.rawWorld);
  assert.deepEqual(output.features[0].segments[0].angle, [42]);
  assert.equal(output.features[0].segments[0].custom, true);
  assert.deepEqual(output.features[0].segments[1], source.features[0].segments[1]);
});

test("exports plate sublayers with explicit depth ranges", () => {
  const plate = createFeature("continental plate", 300000, 150000, 0);
  plate.layers = [
    { minDepth: 0, maxDepth: 30000, composition: 0, temperature: 300 },
    { minDepth: 30000, maxDepth: 90000, composition: 1, temperature: 700 },
    { minDepth: 90000, maxDepth: 200000, composition: 2, temperature: 1200 }
  ];
  plate.layersEdited = true;
  const output = buildWorldBuilder(DEFAULT_SETTINGS, [plate]).features[0];
  assert.equal(output["composition models"].length, 3);
  assert.deepEqual(output["composition models"][1], {
    model: "uniform", "min depth": 30000, "max depth": 90000, compositions: [1]
  });
  assert.equal(output["temperature models"][2].temperature, 1200);
});

test("exports subduction layers as distances below the slab top", () => {
  const slab = createFeature("subducting plate", 400000, 200000, 0);
  slab.layers = [
    { minDepth: 0, maxDepth: 30000, composition: 0, temperature: 450 },
    { minDepth: 30000, maxDepth: 90000, composition: 1, temperature: 800 }
  ];
  slab.layersEdited = true;
  const output = buildWorldBuilder(DEFAULT_SETTINGS, [slab]).features[0];
  assert.equal(output["composition models"][0]["max distance slab top"], 30000);
  assert.equal(output["temperature models"][1]["min distance slab top"], 30000);
  assert.equal(output["temperature models"][1]["max distance slab top"], 90000);
});

test("detects invalid layer intervals and composition indices", () => {
  const plate = createFeature("oceanic plate", 300000, 150000, 0);
  plate.layers = [{ minDepth: 50000, maxDepth: 20000, composition: 0.5, temperature: 600 }];
  const errors = validateProject(DEFAULT_SETTINGS, [plate]);
  assert.equal(errors.length, 2);
});

test("provides named continental and oceanic lithosphere presets", () => {
  const continent = createFeature("continental plate", 300000, 150000, 0);
  const continentalLayers = geologicalLayerPreset(continent);
  assert.deepEqual(continentalLayers.map(layer => [layer.name, layer.maxDepth - layer.minDepth]), [
    ["Upper crust", 25000],
    ["Lower crust", 15000],
    ["Continental mantle lithosphere", 60000]
  ]);
  const ocean = createFeature("oceanic plate", 300000, 150000, 0);
  assert.deepEqual(geologicalLayerPreset(ocean).map(layer => [layer.name, layer.maxDepth - layer.minDepth]), [
    ["Oceanic crust", 8000],
    ["Oceanic mantle lithosphere", 72000]
  ]);
});

test("exports generated per-feature GWB depth-surface topography", () => {
  const plate = createFeature("continental plate", 300000, 150000, 0);
  plate.generatedTopographyModels = [{
    model: "depth surface",
    operation: "replace",
    topography: [[-1200, [[210000, 100000]]], [500, [[390000, 200000]]]]
  }];
  const output = buildWorldBuilder(DEFAULT_SETTINGS, [plate]).features[0];
  assert.deepEqual(output["topography models"], plate.generatedTopographyModels);
});

test("can explicitly remove imported feature topography", () => {
  const imported = importWorldBuilder({
    version: "1.2",
    features: [{
      model: "continental plate",
      coordinates: [[0, 0], [100000, 0], [100000, 100000], [0, 100000]],
      "topography models": [{ model: "uniform", topography: 1200 }]
    }]
  });
  imported.features[0].generatedTopographyModels = [];
  const output = buildWorldBuilder(imported.settings, imported.features, imported.rawWorld);
  assert.equal("topography models" in output.features[0], false);
});

test("exports composition-based density models and reference densities", () => {
  const plate = createFeature("continental plate", 300000, 150000, 0);
  plate.densityEnabled = true;
  plate.densityEdited = true;
  plate.referenceDensity = 2825;
  const output = buildWorldBuilder(DEFAULT_SETTINGS, [plate]);
  assert.deepEqual(output.features[0]["density models"], [{
    model: "uniform", compositions: [0], operation: "replace"
  }]);
  assert.deepEqual(output["composition properties"], [{ index: 0, "reference density": 2825 }]);
  assert.equal(output["background density"], 3300);
  assert.deepEqual(output["gravity model"], { model: "uniform", magnitude: 9.81 });
});

test("exports and imports isostatic reference-column settings", () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    topographyMode: "isostatic",
    compensationDepth: 300000,
    integrationPoints: 120,
    referenceProfileX: 125000,
    referenceProfileY: 50000
  };
  const world = buildWorldBuilder(settings, []);
  assert.equal(world["compensation depth"], 300000);
  assert.equal(world["number of integration points"], 120);
  assert.deepEqual(world["Reference profile point"], [125000, 50000]);
  const imported = importWorldBuilder(world);
  assert.equal(imported.settings.topographyMode, "isostatic");
  assert.equal(imported.settings.compensationDepth, 300000);
});

test("spherical chunk grids convert editor depth to radial bounds", () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    coordinateSystem: "spherical",
    gridType: "chunk",
    xMin: 45, xMax: 135, yMin: -5, yMax: 5,
    zMin: 0, zMax: 1000000,
    radius: 6371000
  };
  const grid = buildGrid(settings);
  assert.match(grid, /x_min = 45/);
  assert.match(grid, /z_min = 5371000/);
  assert.match(grid, /z_max = 6371000/);
  const imported = applyGridConfig(settings, grid);
  assert.equal(imported.zMin, 0);
  assert.equal(imported.zMax, 1000000);
});

test("grid text populates 3D domain settings", () => {
  const settings = applyGridConfig(DEFAULT_SETTINGS, "grid_type = chunk\ndim = 3\ny_min = -10\ny_max = 20\nn_cell_y = 15\n");
  assert.equal(settings.coordinateSystem, "spherical");
  assert.equal(settings.dimension, 3);
  assert.equal(settings.yMin, -10);
  assert.equal(settings.cellsY, 15);
});

test("preserves sub-degree coordinates for tomography-derived feature outlines", () => {
  const anomaly = createFeature("mantle layer", 0, 0, 0);
  anomaly.points = [[-12.4, 4.875], [-11.95, 4.5], [-11.6, 5.125]];
  const world = buildWorldBuilder({ ...DEFAULT_SETTINGS, coordinateSystem: "spherical" }, [anomaly]);
  assert.deepEqual(world.features[0].coordinates, anomaly.points);
});

test("builds a validated SubMachine depth-slice request", () => {
  const request = new URL(buildSubmachineRequest({
    model: "model_s20rts", depth: 200, range: 1.5,
    west: -20, east: 30, south: -15, north: 25
  }));
  assert.equal(request.hostname, "orfeus-eu.org");
  assert.equal(request.searchParams.get("model_s20rts"), "True");
  assert.equal(request.searchParams.get("vmin"), "-1.5");
  assert.equal(request.searchParams.get("llcrnrlon"), "-20");
  assert.equal(request.searchParams.get("urcrnrlat"), "25");
});

test("rejects unsafe tomography models and extracts generated images", () => {
  assert.throws(() => buildSubmachineRequest({
    model: "../../bad", depth: 200, range: 1, west: -20, east: 20, south: -10, north: 10
  }), /Unsupported/);
  const url = extractSubmachineImageUrl(
    '<a href="./generated/example_tomo_depth.jpg">Open the figure</a>',
    "https://orfeus-eu.org/submachine/index.php?page=tomo_depth"
  );
  assert.equal(url, "https://orfeus-eu.org/submachine/generated/example_tomo_depth.jpg");
});
