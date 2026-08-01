export const ASPECT_TOMOGRAPHY_DEFAULTS = Object.freeze({
  sourceField: "dvs",
  dvsDvpRatio: 1.8,
  vsToDensity: 0.25,
  thermalExpansion: 2e-5,
  referenceTemperature: 1600,
  removeMean: true,
  shallowCutoffKm: 0,
  maxAbsAnomaly: 1200
});

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function convertTomographyToTemperature(values, options = {}) {
  const config = { ...ASPECT_TOMOGRAPHY_DEFAULTS, ...options };
  const source = Array.from(values || [], value => finite(value, 0));
  if (!source.length) throw new Error("Tomography conversion needs at least one numerical sample.");
  const ratio = Math.max(Number.EPSILON, finite(config.dvsDvpRatio, 1.8));
  const dvsPercent = source.map(value => config.sourceField === "dvp" ? value * ratio : value);
  const mean = config.removeMean ? dvsPercent.reduce((sum, value) => sum + value, 0) / dvsPercent.length : 0;
  const alpha = finite(config.thermalExpansion, 2e-5);
  if (!(alpha > 0)) throw new Error("Thermal expansion must be greater than zero.");
  const scale = finite(config.vsToDensity, 0.25) / alpha / 100;
  const limit = Math.max(0, finite(config.maxAbsAnomaly, 1200));
  const depthKm = finite(config.depthKm, Infinity);
  const suppressed = depthKm < Math.max(0, finite(config.shallowCutoffKm, 0));
  const anomaly = dvsPercent.map(value => {
    if (suppressed) return 0;
    const raw = -(value - mean) * scale;
    return limit ? Math.max(-limit, Math.min(limit, raw)) : raw;
  });
  const reference = finite(config.referenceTemperature, 1600);
  const temperature = anomaly.map(value => reference + value);
  return {
    temperature, anomaly, meanVelocityAnomalyPercent: mean,
    min: Math.min(...temperature), max: Math.max(...temperature),
    formula: "delta_T = -(xi/alpha) * delta_ln_Vs",
    config: { ...config, depthKm, suppressed }
  };
}
