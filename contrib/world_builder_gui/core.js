export const FEATURE_TYPES = {
  "continental plate": { label: "Continental plate", icon: "▰", color: "#e6a85b", geometry: "area" },
  "oceanic plate": { label: "Oceanic plate", icon: "≈", color: "#3e9db5", geometry: "area" },
  "subducting plate": { label: "Subduction", icon: "↘", color: "#ef6a54", geometry: "line" },
  fault: { label: "Fault", icon: "╱", color: "#a98bd4", geometry: "line" },
  "mantle layer": { label: "Mantle layer", icon: "▱", color: "#ce765e", geometry: "area" },
  plume: { label: "Plume", icon: "♨", color: "#e6533f", geometry: "point" }
};

export const DEFAULT_SETTINGS = {
  version: "1.2",
  coordinateSystem: "cartesian",
  gridType: "cartesian",
  dimension: 2,
  compositions: 2,
  xMin: 0,
  xMax: 1000000,
  yMin: 0,
  yMax: 600000,
  zMin: 0,
  zMax: 400000,
  cellsX: 40,
  cellsY: 24,
  cellsZ: 20,
  surfaceTemperature: 293.15,
  mantleTemperature: 1600,
  topographyMode: "terrain",
  backgroundDensity: 3300,
  gravityMagnitude: 9.81,
  compensationDepth: 250000,
  integrationPoints: 100,
  referenceProfileX: 0,
  referenceProfileY: 0,
  radius: 6371000
};

const roundCoordinate = value => Number(Number(value).toFixed(6));
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

export function createPlacementPoints(geometry, x, y, shape, spherical = false) {
  if (geometry === "point") return [[x, y]];
  const spanX = spherical ? 4 : geometry === "line" ? 80000 : 90000;
  const spanY = spherical ? 2.5 : 50000;
  if (geometry === "line") {
    if (shape === "curved") {
      return Array.from({ length: 7 }, (_, index) => {
        const t = index / 6 * 2 - 1;
        return [x + t * spanX, y - (1 - t * t) * spanY * .9];
      });
    }
    if (shape === "segmented") {
      return [
        [x - spanX, y + spanY * .35], [x - spanX * .5, y - spanY * .45],
        [x, y + spanY * .25], [x + spanX * .5, y - spanY * .25],
        [x + spanX, y + spanY * .2]
      ];
    }
    return [[x - spanX, y], [x + spanX, y]];
  }
  if (shape === "ellipse") {
    return Array.from({ length: 16 }, (_, index) => {
      const angle = index / 16 * Math.PI * 2;
      return [x + Math.cos(angle) * spanX, y + Math.sin(angle) * spanY];
    });
  }
  if (shape === "wedge") {
    return [[x - spanX, y - spanY], [x + spanX, y], [x - spanX, y + spanY]];
  }
  if (shape === "irregular") {
    return [
      [x - spanX, y - spanY * .25], [x - spanX * .45, y - spanY],
      [x + spanX * .35, y - spanY * .82], [x + spanX, y - spanY * .1],
      [x + spanX * .6, y + spanY * .82], [x - spanX * .25, y + spanY],
      [x - spanX * .85, y + spanY * .45]
    ];
  }
  return [
    [x - spanX, y - spanY], [x + spanX, y - spanY],
    [x + spanX, y + spanY], [x - spanX, y + spanY]
  ];
}

export function createFeature(model, x, z, index = 0) {
  const meta = FEATURE_TYPES[model];
  if (!meta) throw new Error(`Unknown feature model: ${model}`);
  const id = `feature-${Date.now()}-${index}`;
  const base = {
    id,
    model,
    name: `${meta.label} ${index + 1}`,
    minDepth: 0,
    maxDepth: model === "continental plate" ? 100000 : model === "oceanic plate" ? 80000 : 200000,
    temperatureModel: "uniform",
    temperature: model === "subducting plate" ? 650 : 1100,
    composition: 0,
    densityEnabled: false,
    referenceDensity: model === "continental plate" ? 2850 : model === "oceanic plate" ? 3200 : 3300,
    densityOperation: "replace",
    layerMode: "count",
    layers: []
  };
  if (meta.geometry === "area") {
    base.points = createPlacementPoints("area", x, z, "rectangle");
  } else if (meta.geometry === "line") {
    base.points = createPlacementPoints("line", x, z, "straight");
  } else {
    base.points = [[x, z]];
    base.crossSectionDepth = 250000;
    base.semiMajorAxis = 70000;
    base.eccentricity = 0.25;
  }
  if (model === "subducting plate" || model === "fault") {
    base.dipPoint = [x, z + 180000];
    base.segmentLength = 250000;
    base.thickness = 90000;
    base.angle = 45;
  }
  if (model === "subducting plate") {
    base.spreadingVelocity = 0.05;
    base.subductingVelocity = 0.05;
  }
  return base;
}

export function geologicalLayerPreset(feature) {
  const start = Number(feature.minDepth) || 0;
  if (feature.model === "continental plate") {
    return [
      { name: "Upper crust", minDepth: start, maxDepth: start + 25000, composition: 0, temperature: Number(feature.temperature), density: 2750 },
      { name: "Lower crust", minDepth: start + 25000, maxDepth: start + 40000, composition: 1, temperature: Number(feature.temperature), density: 2900 },
      { name: "Continental mantle lithosphere", minDepth: start + 40000, maxDepth: start + 100000, composition: 2, temperature: Number(feature.temperature), density: 3300 }
    ];
  }
  if (feature.model === "oceanic plate") {
    return [
      { name: "Oceanic crust", minDepth: start, maxDepth: start + 8000, composition: 0, temperature: Number(feature.temperature), density: 3000 },
      { name: "Oceanic mantle lithosphere", minDepth: start + 8000, maxDepth: start + 80000, composition: 1, temperature: Number(feature.temperature), density: 3300 }
    ];
  }
  return [];
}

function layerDistanceKeys(model) {
  if (model === "subducting plate") return ["min distance slab top", "max distance slab top"];
  if (model === "fault") return ["min distance fault center", "max distance fault center"];
  return ["min depth", "max depth"];
}

function inferLayers(rawFeature, created) {
  const [minKey, maxKey] = layerDistanceKeys(rawFeature.model);
  const compositions = rawFeature["composition models"] || [];
  const temperatures = rawFeature["temperature models"] || [];
  if (compositions.length < 2 && temperatures.length < 2) return [];
  const source = compositions.length >= temperatures.length ? compositions : temperatures;
  return source.map((model, index) => ({
    name: model.name || `Layer ${index + 1}`,
    minDepth: Number(model[minKey] ?? (index ? source[index - 1]?.[maxKey] : 0) ?? 0),
    maxDepth: Number(model[maxKey] ?? (rawFeature.model === "subducting plate" || rawFeature.model === "fault"
      ? created.thickness
      : rawFeature["max depth"] ?? created.maxDepth)),
    composition: Number(compositions[index]?.compositions?.[0] ?? created.composition + index),
    temperature: Number(temperatures[index]?.temperature
      ?? temperatures[index]?.["top temperature"]
      ?? created.temperature),
    density: Number(created.referenceDensity)
  }));
}

export function importFeature(rawFeature, index = 0) {
  const model = rawFeature.model;
  const coordinates = Array.isArray(rawFeature.coordinates) && rawFeature.coordinates.length
    ? rawFeature.coordinates
    : [[200000 + index * 120000, 150000]];
  const created = createFeature(model, coordinates[0][0], coordinates[0][1], index);
  const firstTemperature = rawFeature["temperature models"]?.[0];
  const firstComposition = rawFeature["composition models"]?.[0];
  const firstDensity = rawFeature["density models"]?.[0];
  const firstSegment = rawFeature.segments?.[0];
  const imported = {
    ...created,
    raw: clone(rawFeature),
    name: rawFeature.name || created.name,
    points: clone(coordinates),
    minDepth: rawFeature["min depth"] ?? created.minDepth,
    maxDepth: rawFeature["max depth"] ?? created.maxDepth,
    dipPoint: clone(rawFeature["dip point"] || created.dipPoint),
    segmentLength: firstSegment?.length ?? created.segmentLength,
    thickness: firstSegment?.thickness?.[0] ?? created.thickness,
    angle: firstSegment?.angle?.[0] ?? created.angle,
    temperatureModel: firstTemperature?.model || created.temperatureModel,
    temperature: firstTemperature?.temperature
      ?? firstTemperature?.["top temperature"]
      ?? created.temperature,
    spreadingVelocity: firstTemperature?.["spreading velocity"] ?? created.spreadingVelocity,
    subductingVelocity: firstTemperature?.["subducting velocity"] ?? created.subductingVelocity,
    composition: firstComposition?.compositions?.[0] ?? created.composition,
    densityEnabled: Boolean(rawFeature["density models"]?.length),
    densityOperation: firstDensity?.operation || created.densityOperation,
    crossSectionDepth: rawFeature["cross section depths"]?.[0] ?? created.crossSectionDepth,
    semiMajorAxis: rawFeature["semi-major axis"]?.[0] ?? created.semiMajorAxis,
    eccentricity: rawFeature.eccentricity?.[0] ?? created.eccentricity
  };
  imported.layers = inferLayers(rawFeature, imported);
  imported.layerMode = imported.layers.length ? "depths" : "count";
  return imported;
}

function temperatureModels(feature) {
  if (feature.model === "subducting plate" && feature.temperatureModel === "mass conserving") {
    return [{
      model: "mass conserving",
      "spreading velocity": Number(feature.spreadingVelocity),
      "subducting velocity": Number(feature.subductingVelocity)
    }];
  }
  if (feature.temperatureModel === "linear") {
    const distanceKey = feature.model === "subducting plate"
      ? "max distance slab top"
      : feature.model === "fault" ? "max distance fault center" : "max depth";
    return [{ model: "linear", [distanceKey]: Number(feature.maxDepth), "top temperature": Number(feature.temperature), "bottom temperature": -1 }];
  }
  return [{ model: "uniform", temperature: Number(feature.temperature) }];
}

function layeredModels(feature) {
  const [minKey, maxKey] = layerDistanceKeys(feature.model);
  const layers = [...(feature.layers || [])].sort((a, b) => Number(a.minDepth) - Number(b.minDepth));
  return {
    temperatures: layers.map(layer => ({
      model: "uniform",
      [minKey]: Number(layer.minDepth),
      [maxKey]: Number(layer.maxDepth),
      temperature: Number(layer.temperature)
    })),
    compositions: layers.map(layer => ({
      model: "uniform",
      [minKey]: Number(layer.minDepth),
      [maxKey]: Number(layer.maxDepth),
      compositions: [Number(layer.composition)]
    })),
    densities: layers.map(layer => ({
      model: "uniform",
      [minKey]: Number(layer.minDepth),
      [maxKey]: Number(layer.maxDepth),
      compositions: [Number(layer.composition)],
      operation: feature.densityOperation || "replace"
    }))
  };
}

export function featureToWorldBuilder(feature) {
  const output = feature.raw ? clone(feature.raw) : {};
  output.model = feature.model;
  output.name = feature.name;
  output.coordinates = feature.points.map(point => point.map(roundCoordinate));

  output["min depth"] = Number(feature.minDepth);
  output["max depth"] = Number(feature.maxDepth);

  if (feature.model === "subducting plate" || feature.model === "fault") {
    output["dip point"] = feature.dipPoint.map(roundCoordinate);
    if (!feature.raw || feature.segmentEdited) {
      const firstSegment = {
        ...(output.segments?.[0] || {}),
        length: Number(feature.segmentLength),
        thickness: [Number(feature.thickness)],
        angle: [Number(feature.angle)]
      };
      output.segments = [firstSegment, ...(output.segments?.slice(1) || [])];
    }
  }

  if (feature.model === "plume" && (!feature.raw || feature.plumeGeometryEdited)) {
    output["cross section depths"] = [Number(feature.crossSectionDepth)];
    output["semi-major axis"] = [Number(feature.semiMajorAxis)];
    output.eccentricity = [Number(feature.eccentricity)];
    output["rotation angles"] = [0];
  }

  if (feature.layersEdited) {
    if (feature.layers?.length) {
      const models = layeredModels(feature);
      output["temperature models"] = models.temperatures;
      output["composition models"] = models.compositions;
    } else {
      output["temperature models"] = temperatureModels(feature);
      output["composition models"] = [{ model: "uniform", compositions: [Number(feature.composition)] }];
    }
  } else if (!feature.raw || feature.thermalEdited) {
    output["temperature models"] = temperatureModels(feature);
  }
  if (!feature.layersEdited && (!feature.raw || feature.compositionEdited)) {
    output["composition models"] = [{ model: "uniform", compositions: [Number(feature.composition)] }];
  }
  if (feature.densityEdited || !feature.raw) {
    if (feature.densityEnabled) {
      output["density models"] = feature.layers?.length
        ? layeredModels(feature).densities
        : [{
            model: "uniform",
            compositions: [Number(feature.composition)],
            operation: feature.densityOperation || "replace"
          }];
    } else {
      delete output["density models"];
    }
  }
  if (Array.isArray(feature.generatedTopographyModels)) {
    if (feature.generatedTopographyModels.length) output["topography models"] = clone(feature.generatedTopographyModels);
    else delete output["topography models"];
  }
  return output;
}

export function buildWorldBuilder(settings, features, rawWorld = null) {
  const world = rawWorld ? clone(rawWorld) : {};
  world.version = settings.version;
  world["coordinate system"] = settings.coordinateSystem === "spherical"
    ? { ...(world["coordinate system"] || {}), model: "spherical", "depth method": world["coordinate system"]?.["depth method"] || "begin at end segment", radius: Number(settings.radius) || world["coordinate system"]?.radius || 6371000 }
    : { model: "cartesian" };
  world["surface temperature"] = Number(settings.surfaceTemperature);
  world["potential mantle temperature"] = Number(settings.mantleTemperature);
  world.features = features.map(featureToWorldBuilder);
  const densityFeatures = features.filter(feature => feature.densityEnabled);
  const densityByComposition = new Map();
  densityFeatures.forEach(feature => {
    if (feature.layers?.length) {
      feature.layers.forEach(layer => densityByComposition.set(
        Number(layer.composition),
        { index: Number(layer.composition), name: layer.name || `Composition ${layer.composition}`, "reference density": Number(layer.density || feature.referenceDensity || 3300) }
      ));
    } else {
      densityByComposition.set(
        Number(feature.composition),
        { index: Number(feature.composition), "reference density": Number(feature.referenceDensity || 3300) }
      );
    }
  });
  if (densityByComposition.size || settings.topographyMode === "isostatic") {
    const existing = new Map((world["composition properties"] || []).map(property => [Number(property.index), property]));
    densityByComposition.forEach((property, index) => existing.set(index, { ...(existing.get(index) || {}), ...property }));
    world["composition properties"] = [...existing.values()].sort((a, b) => Number(a.index) - Number(b.index));
    world["background density"] = Number(settings.backgroundDensity);
    world["gravity model"] = { model: "uniform", magnitude: Number(settings.gravityMagnitude) };
  }
  if (settings.topographyMode === "isostatic") {
    world["compensation depth"] = Number(settings.compensationDepth);
    world["number of integration points"] = Math.max(2, Math.round(Number(settings.integrationPoints)));
    world["Reference profile point"] = [Number(settings.referenceProfileX), Number(settings.referenceProfileY)];
  } else if (settings.topographyMode != null) {
    delete world["compensation depth"];
    delete world["number of integration points"];
    delete world["Reference profile point"];
  }
  if (Number(settings.dimension) === 2) {
    world["cross section"] = settings.section || [
      [Number(settings.xMin), Number(settings.yMin)],
      [Number(settings.xMax), Number(settings.yMin)]
    ];
  }
  return world;
}

export function importWorldBuilder(world) {
  const coordinateSystem = world["coordinate system"]?.model || "cartesian";
  const settings = {
    ...DEFAULT_SETTINGS,
    version: world.version || DEFAULT_SETTINGS.version,
    coordinateSystem,
    gridType: coordinateSystem === "spherical" ? "chunk" : "cartesian",
    surfaceTemperature: world["surface temperature"] ?? DEFAULT_SETTINGS.surfaceTemperature,
    mantleTemperature: world["potential mantle temperature"] ?? DEFAULT_SETTINGS.mantleTemperature,
    topographyMode: world["Reference profile point"] ? "isostatic" : DEFAULT_SETTINGS.topographyMode,
    backgroundDensity: world["background density"] ?? DEFAULT_SETTINGS.backgroundDensity,
    gravityMagnitude: world["gravity model"]?.magnitude ?? DEFAULT_SETTINGS.gravityMagnitude,
    compensationDepth: world["compensation depth"] ?? DEFAULT_SETTINGS.compensationDepth,
    integrationPoints: world["number of integration points"] ?? DEFAULT_SETTINGS.integrationPoints,
    referenceProfileX: world["Reference profile point"]?.[0] ?? DEFAULT_SETTINGS.referenceProfileX,
    referenceProfileY: world["Reference profile point"]?.[1] ?? DEFAULT_SETTINGS.referenceProfileY,
    radius: world["coordinate system"]?.radius ?? DEFAULT_SETTINGS.radius,
    section: clone(world["cross section"])
  };
  const compositionDensities = new Map((world["composition properties"] || [])
    .map(property => [Number(property.index), Number(property["reference density"])]));
  const features = (world.features || []).filter(feature => FEATURE_TYPES[feature.model]).map(importFeature);
  features.forEach(feature => {
    const composition = Number(feature.raw?.["density models"]?.[0]?.compositions?.[0] ?? feature.composition);
    if (compositionDensities.has(composition)) feature.referenceDensity = compositionDensities.get(composition);
    (feature.layers || []).forEach(layer => {
      if (compositionDensities.has(Number(layer.composition))) layer.density = compositionDensities.get(Number(layer.composition));
    });
  });
  return {
    settings,
    features,
    connections: [],
    rawWorld: clone(world)
  };
}

export function applyGridConfig(settings, gridText = "") {
  const next = { ...settings };
  const keyMap = {
    grid_type: "gridType", dim: "dimension", compositions: "compositions",
    x_min: "xMin", x_max: "xMax", y_min: "yMin", y_max: "yMax",
    z_min: "zMin", z_max: "zMax", n_cell_x: "cellsX", n_cell_y: "cellsY", n_cell_z: "cellsZ"
  };
  for (const line of gridText.split(/\r?\n/)) {
    const clean = line.replace(/#.*/, "").trim();
    const match = clean.match(/^([^=]+)=(.+)$/);
    if (!match) continue;
    const sourceKey = match[1].trim();
    const targetKey = keyMap[sourceKey];
    if (!targetKey) continue;
    const rawValue = match[2].trim();
    next[targetKey] = sourceKey === "grid_type" ? rawValue : Number(rawValue);
  }
  next.coordinateSystem = next.gridType === "chunk" ? "spherical" : "cartesian";
  if (next.gridType === "chunk" && Number(next.zMin) > Number(next.radius) / 2 && Number(next.zMax) > Number(next.radius) / 2) {
    const radialMin = Number(next.zMin);
    const radialMax = Number(next.zMax);
    next.zMin = Number(next.radius) - radialMax;
    next.zMax = Number(next.radius) - radialMin;
  }
  return next;
}

export function buildGrid(settings) {
  const spherical = settings.gridType === "chunk";
  const radius = Number(settings.radius) || DEFAULT_SETTINGS.radius;
  const lines = [
    "# output variables",
    `grid_type = ${settings.gridType}`,
    `dim = ${settings.dimension}`,
    `compositions = ${settings.compositions}`,
    "vtu_output_format = ASCII",
    "",
    "# domain of the grid",
    `x_min = ${settings.xMin}`,
    `x_max = ${settings.xMax}`,
    ...(Number(settings.dimension) === 3 ? [`y_min = ${settings.yMin}`, `y_max = ${settings.yMax}`] : []),
    ...(spherical
      ? [`# z is radius; the editor stores depth below the surface`, `z_min = ${radius - Number(settings.zMax)}`, `z_max = ${radius - Number(settings.zMin)}`]
      : [`z_min = ${settings.zMin}`, `z_max = ${settings.zMax}`]),
    "",
    "# grid properties",
    `n_cell_x = ${settings.cellsX}`,
    ...(Number(settings.dimension) === 3 ? [`n_cell_y = ${settings.cellsY}`] : []),
    `n_cell_z = ${settings.cellsZ}`
  ];
  return `${lines.join("\n")}\n`;
}

export function buildVtp(settings, features) {
  const points = [];
  const temperature = [];
  const density = [];
  const composition = [];
  const featureIds = [];
  const modelTypes = [];
  const lineConnectivity = [];
  const lineOffsets = [];
  const polyConnectivity = [];
  const polyOffsets = [];
  const spherical = settings.coordinateSystem === "spherical";
  const radius = Number(settings.radius) || DEFAULT_SETTINGS.radius;
  const modelIndex = new Map(Object.keys(FEATURE_TYPES).map((model, index) => [model, index]));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const featureTemperature = feature => {
    if (!feature.layers?.length) return finite(feature.temperature, settings.mantleTemperature);
    let weight = 0; let total = 0;
    feature.layers.forEach(layer => {
      const thickness = Math.max(1, finite(layer.maxDepth) - finite(layer.minDepth));
      total += finite(layer.temperature, feature.temperature) * thickness;
      weight += thickness;
    });
    return total / Math.max(1, weight);
  };
  const featureDensity = feature => {
    if (!feature.layers?.length) return finite(feature.referenceDensity, settings.backgroundDensity);
    let weight = 0; let total = 0;
    feature.layers.forEach(layer => {
      const thickness = Math.max(1, finite(layer.maxDepth) - finite(layer.minDepth));
      total += finite(layer.density, feature.referenceDensity || settings.backgroundDensity) * thickness;
      weight += thickness;
    });
    return total / Math.max(1, weight);
  };
  const coordinate = ([x, y], depth) => {
    if (!spherical) return [finite(x), finite(y), -finite(depth)];
    const longitude = finite(x) * Math.PI / 180;
    const latitude = finite(y) * Math.PI / 180;
    const localRadius = radius - finite(depth);
    return [
      localRadius * Math.cos(latitude) * Math.cos(longitude),
      localRadius * Math.cos(latitude) * Math.sin(longitude),
      localRadius * Math.sin(latitude)
    ];
  };
  const addPoint = (point, depth, feature, featureIndex) => {
    const id = points.length / 3;
    points.push(...coordinate(point, depth));
    temperature.push(featureTemperature(feature));
    density.push(featureDensity(feature));
    composition.push(finite(feature.composition));
    featureIds.push(featureIndex);
    modelTypes.push(modelIndex.get(feature.model) ?? -1);
    return id;
  };
  const addLine = ids => {
    lineConnectivity.push(...ids);
    lineOffsets.push(lineConnectivity.length);
  };
  const addPoly = ids => {
    polyConnectivity.push(...ids);
    polyOffsets.push(polyConnectivity.length);
  };

  features.forEach((feature, featureIndex) => {
    const geometry = FEATURE_TYPES[feature.model]?.geometry;
    if (!geometry || !feature.points?.length) return;
    if (geometry === "area" && feature.points.length >= 3) {
      const top = feature.points.map(point => addPoint(point, finite(feature.minDepth), feature, featureIndex));
      const bottom = feature.points.map(point => addPoint(point, finite(feature.maxDepth), feature, featureIndex));
      addPoly(top);
      addPoly([...bottom].reverse());
      for (let index = 0; index < top.length; index++) {
        const next = (index + 1) % top.length;
        addPoly([top[index], top[next], bottom[next], bottom[index]]);
      }
      return;
    }
    if (geometry === "line") {
      const surface = feature.points.map(point => addPoint(point, finite(feature.minDepth), feature, featureIndex));
      addLine(surface);
      if ((feature.model === "subducting plate" || feature.model === "fault") && feature.points.length >= 2) {
        const center = feature.points.reduce((sum, point) => [sum[0] + point[0] / feature.points.length, sum[1] + point[1] / feature.points.length], [0, 0]);
        const direction = [finite(feature.dipPoint?.[0], center[0]) - center[0], finite(feature.dipPoint?.[1], center[1]) - center[1]];
        const norm = Math.hypot(...direction) || 1;
        const angle = finite(feature.angle, 45) * Math.PI / 180;
        const length = finite(feature.segmentLength, 250000);
        const drop = Math.min(finite(feature.maxDepth, length), Math.abs(length * Math.sin(angle)));
        const run = Math.abs(length * Math.cos(angle)) / (spherical ? 111194 : 1);
        const shifted = feature.points.map(point => [
          point[0] + direction[0] / norm * run,
          point[1] + direction[1] / norm * run
        ]);
        const deep = shifted.map(point => addPoint(point, drop, feature, featureIndex));
        addLine(deep);
        for (let index = 0; index < surface.length - 1; index++) {
          addPoly([surface[index], surface[index + 1], deep[index + 1], deep[index]]);
        }
      }
      return;
    }
    const center = feature.points[0];
    const centerDepth = finite(feature.crossSectionDepth, 250000);
    const plumeRadius = Math.max(1, finite(feature.semiMajorAxis, 70000));
    const horizontalRadius = plumeRadius / (spherical ? 111194 : 1);
    const vertices = [
      addPoint(center, Math.max(0, centerDepth - plumeRadius), feature, featureIndex),
      addPoint(center, centerDepth + plumeRadius, feature, featureIndex),
      addPoint([center[0] + horizontalRadius, center[1]], centerDepth, feature, featureIndex),
      addPoint([center[0], center[1] + horizontalRadius], centerDepth, feature, featureIndex),
      addPoint([center[0] - horizontalRadius, center[1]], centerDepth, feature, featureIndex),
      addPoint([center[0], center[1] - horizontalRadius], centerDepth, feature, featureIndex)
    ];
    [[0,2,3],[0,3,4],[0,4,5],[0,5,2],[1,3,2],[1,4,3],[1,5,4],[1,2,5]]
      .forEach(indices => addPoly(indices.map(index => vertices[index])));
  });

  const array = values => values.map(value => Number(value).toPrecision(9)).join(" ");
  const integers = values => values.join(" ");
  return `<?xml version="1.0"?>
<VTKFile type="PolyData" version="1.0" byte_order="LittleEndian">
  <PolyData>
    <Piece NumberOfPoints="${points.length / 3}" NumberOfVerts="0" NumberOfLines="${lineOffsets.length}" NumberOfStrips="0" NumberOfPolys="${polyOffsets.length}">
      <PointData Scalars="Temperature">
        <DataArray type="Float32" Name="Temperature" NumberOfComponents="1" format="ascii">${array(temperature)}</DataArray>
        <DataArray type="Float32" Name="Density" NumberOfComponents="1" format="ascii">${array(density)}</DataArray>
        <DataArray type="Int32" Name="Composition" NumberOfComponents="1" format="ascii">${integers(composition.map(Math.round))}</DataArray>
        <DataArray type="Int32" Name="FeatureId" NumberOfComponents="1" format="ascii">${integers(featureIds)}</DataArray>
        <DataArray type="Int32" Name="ModelType" NumberOfComponents="1" format="ascii">${integers(modelTypes)}</DataArray>
      </PointData>
      <CellData/>
      <Points><DataArray type="Float64" Name="Points" NumberOfComponents="3" format="ascii">${array(points)}</DataArray></Points>
      <Verts><DataArray type="Int32" Name="connectivity" format="ascii"></DataArray><DataArray type="Int32" Name="offsets" format="ascii"></DataArray></Verts>
      <Lines><DataArray type="Int32" Name="connectivity" format="ascii">${integers(lineConnectivity)}</DataArray><DataArray type="Int32" Name="offsets" format="ascii">${integers(lineOffsets)}</DataArray></Lines>
      <Strips><DataArray type="Int32" Name="connectivity" format="ascii"></DataArray><DataArray type="Int32" Name="offsets" format="ascii"></DataArray></Strips>
      <Polys><DataArray type="Int32" Name="connectivity" format="ascii">${integers(polyConnectivity)}</DataArray><DataArray type="Int32" Name="offsets" format="ascii">${integers(polyOffsets)}</DataArray></Polys>
    </Piece>
  </PolyData>
</VTKFile>
`;
}

export function connectFeatures(source, target) {
  if (!source || !target || source.id === target.id) return false;
  const sourcePoint = source.points[source.points.length - 1];
  let nearest = 0;
  let distance = Infinity;
  target.points.forEach((point, index) => {
    const candidate = Math.hypot(point[0] - sourcePoint[0], point[1] - sourcePoint[1]);
    if (candidate < distance) {
      nearest = index;
      distance = candidate;
    }
  });
  target.points[nearest] = [...sourcePoint];
  return true;
}

export function validateProject(settings, features) {
  const errors = [];
  if (!(Number(settings.xMax) > Number(settings.xMin))) errors.push("Grid x max must be greater than x min.");
  if (!(Number(settings.yMax) > Number(settings.yMin))) errors.push("Surface y/latitude max must be greater than min.");
  if (!(Number(settings.zMax) > Number(settings.zMin))) errors.push("Grid z max must be greater than z min.");
  if (Number(settings.cellsX) < 1 || Number(settings.cellsZ) < 1) errors.push("Mesh resolution must be at least one cell.");
  if (Number(settings.dimension) === 3 && !(Number(settings.yMax) > Number(settings.yMin))) errors.push("Grid y max must be greater than y min.");
  if (Number(settings.dimension) === 3 && Number(settings.cellsY) < 1) errors.push("Y mesh resolution must be at least one cell.");
  if (settings.topographyMode === "isostatic") {
    if (!(Number(settings.backgroundDensity) > 0)) errors.push("Isostasy needs a positive background density.");
    if (!(Number(settings.compensationDepth) > 0)) errors.push("Isostasy needs a positive compensation depth.");
    if (Number(settings.integrationPoints) < 2) errors.push("Isostasy needs at least two integration points.");
  }
  if (settings.coordinateSystem === "spherical") {
    if (Number(settings.xMin) < -360 || Number(settings.xMax) > 360) errors.push("Spherical longitude must stay between -360° and 360°.");
    if (Number(settings.yMin) < -90 || Number(settings.yMax) > 90) errors.push("Spherical latitude must stay between -90° and 90°.");
    if (Number(settings.zMax) >= Number(settings.radius)) errors.push("Maximum depth must be smaller than the spherical radius.");
  }
  for (const feature of features) {
    if (!feature.name.trim()) errors.push(`${FEATURE_TYPES[feature.model].label} needs a name.`);
    if (feature.points.length === 0) errors.push(`${feature.name} needs coordinates.`);
    if (feature.model === "subducting plate" && Number(feature.segmentLength) <= 0) errors.push(`${feature.name} needs a positive segment length.`);
    if (feature.densityEnabled && !(Number(feature.referenceDensity) > 0) && !feature.layers?.length) errors.push(`${feature.name} needs a positive reference density.`);
    for (const [index, layer] of (feature.layers || []).entries()) {
      if (!(Number(layer.maxDepth) > Number(layer.minDepth))) errors.push(`${feature.name} layer ${index + 1} needs a bottom deeper than its top.`);
      if (Number(layer.composition) < 0 || !Number.isInteger(Number(layer.composition))) errors.push(`${feature.name} layer ${index + 1} needs a non-negative integer composition.`);
      if (feature.densityEnabled && !(Number(layer.density) > 0)) errors.push(`${feature.name} layer ${index + 1} needs a positive density.`);
    }
  }
  return errors;
}
