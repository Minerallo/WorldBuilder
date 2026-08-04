const GAS_CONSTANT = 8.314462618;

export const DEFAULT_RHEOLOGY = Object.freeze({
  strainRate: 1e-15,
  prefactor: 1.1e-16,
  stressExponent: 3.5,
  activationEnergy: 530e3,
  activationVolume: 1.4e-5,
  frictionAngle: 30,
  cohesion: 20e6,
  maxYieldStress: 500e6,
  density: 2800,
  gravity: 9.81,
  surfaceTemperature: 273,
  mantleTemperature: 1573,
  samplesX: 32,
  samplesY: 20,
  depthSamples: 121,
  showBdt: true,
  showSeismicity: true,
  earthquakes: [],
  result: null
});

export function dislocationStress({ strainRate, prefactor, stressExponent, activationEnergy, activationVolume, pressure, temperature }) {
  const rate = Math.max(1e-30, Number(strainRate));
  const A = Math.max(1e-40, Number(prefactor));
  const n = Math.max(1e-6, Number(stressExponent));
  const T = Math.max(1, Number(temperature));
  const exponent = (Number(activationEnergy) + Math.max(0, Number(pressure)) * Number(activationVolume)) / (n * GAS_CONSTANT * T);
  return Math.pow(rate / A, 1 / n) * Math.exp(Math.min(700, exponent));
}

export function druckerPragerYield({ cohesion, frictionAngle, pressure, dimension = 3, maxYieldStress = Infinity }) {
  const phi = Number(frictionAngle) * Math.PI / 180;
  const C = Math.max(0, Number(cohesion));
  const P = Math.max(0, Number(pressure));
  const raw = Number(dimension) === 2
    ? C * Math.cos(phi) + P * Math.sin(phi)
    : (6 * C * Math.cos(phi) + 6 * P * Math.sin(phi)) / (Math.sqrt(3) * (3 + Math.sin(phi)));
  return Math.min(Math.max(0, Number(maxYieldStress)), raw);
}

export function computeStrengthProfile(options = {}) {
  const config = { ...DEFAULT_RHEOLOGY, ...options };
  const maxDepthKm = Math.max(1, Number(config.maxDepthKm ?? 400));
  const count = Math.max(3, Math.round(Number(config.depthSamples)));
  const rows = [];
  let pressure = 0;
  let previousDepthM = 0;
  let previousDensity = Number(config.density);
  for (let index = 0; index < count; index += 1) {
    const depthKm = index / (count - 1) * maxDepthKm;
    const depthM = depthKm * 1000;
    const material = typeof config.materialAt === "function" ? (config.materialAt(depthKm) || {}) : {};
    const density = Number(material.density ?? config.density);
    if (index > 0) pressure += 0.5 * (previousDensity + density) * Number(config.gravity) * (depthM - previousDepthM);
    const temperature = typeof config.temperatureAt === "function"
      ? Number(config.temperatureAt(depthKm))
      : Number(config.surfaceTemperature) + depthKm / maxDepthKm * (Number(config.mantleTemperature) - Number(config.surfaceTemperature));
    const plastic = druckerPragerYield({
      cohesion: material.cohesion ?? config.cohesion, frictionAngle: material.frictionAngle ?? config.frictionAngle, pressure,
      dimension: config.dimension, maxYieldStress: material.maxYieldStress ?? config.maxYieldStress
    });
    const viscous = dislocationStress({
      strainRate: material.strainRate ?? config.strainRate, prefactor: material.prefactor ?? config.prefactor, stressExponent: material.stressExponent ?? config.stressExponent,
      activationEnergy: material.activationEnergy ?? config.activationEnergy, activationVolume: material.activationVolume ?? config.activationVolume, pressure, temperature
    });
    rows.push({ depthKm, pressure, temperature, density, materialName: material.name || "Inherited material", plasticPa: plastic, viscousPa: viscous, differentialStressPa: Math.min(plastic, viscous), regime: plastic <= viscous ? "plastic" : "viscous" });
    previousDepthM = depthM;
    previousDensity = density;
  }
  let bdtDepthKm = null;
  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1].viscousPa - rows[index - 1].plasticPa;
    const current = rows[index].viscousPa - rows[index].plasticPa;
    if (previous >= 0 && current <= 0) {
      const fraction = previous === current ? 0 : previous / (previous - current);
      bdtDepthKm = rows[index - 1].depthKm + fraction * (rows[index].depthKm - rows[index - 1].depthKm);
      break;
    }
  }
  return { rows, bdtDepthKm, maxDepthKm };
}

export function computeBdtGrid({ bounds, nx = 32, ny = 20, columnAt }) {
  const values = [];
  const profiles = [];
  for (let row = 0; row < ny; row += 1) {
    for (let column = 0; column < nx; column += 1) {
      const x = bounds.xMin + (column + 0.5) / nx * (bounds.xMax - bounds.xMin);
      const y = bounds.yMin + (row + 0.5) / ny * (bounds.yMax - bounds.yMin);
      const profile = computeStrengthProfile(columnAt(x, y));
      profiles.push(profile);
      values.push(profile.bdtDepthKm);
    }
  }
  const finite = values.filter(Number.isFinite);
  return { nx, ny, bounds: { ...bounds }, values, profiles, min: finite.length ? Math.min(...finite) : null, max: finite.length ? Math.max(...finite) : null };
}

export function parseEarthquakeGeoJson(input) {
  const object = typeof input === "string" ? JSON.parse(input) : input;
  return (object?.features || []).map((feature, index) => {
    const coordinates = feature?.geometry?.coordinates || [];
    return {
      id: String(feature.id ?? `event-${index + 1}`),
      longitude: Number(coordinates[0]), latitude: Number(coordinates[1]), depthKm: Math.max(0, Number(coordinates[2]) || 0),
      magnitude: Number(feature.properties?.mag), time: Number(feature.properties?.time) || null,
      title: feature.properties?.title || feature.properties?.place || "Earthquake"
    };
  }).filter(event => Number.isFinite(event.longitude) && Number.isFinite(event.latitude));
}

export function compareSeismicityToBdt(events, bdtAt) {
  const comparisons = events.map(event => {
    const bdtDepthKm = Number(bdtAt(event));
    return { ...event, bdtDepthKm, residualKm: event.depthKm - bdtDepthKm, insidePlasticDomain: Number.isFinite(bdtDepthKm) && event.depthKm <= bdtDepthKm };
  });
  const comparable = comparisons.filter(item => Number.isFinite(item.bdtDepthKm));
  const matched = comparable.filter(item => item.insidePlasticDomain).length;
  return { comparisons, comparable: comparable.length, matched, matchPercent: comparable.length ? matched / comparable.length * 100 : null };
}
