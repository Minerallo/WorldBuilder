function finitePairs(observed, predicted) {
  const length = Math.min(observed?.length || 0, predicted?.length || 0);
  const pairs = [];
  for (let index = 0; index < length; index++) {
    const observation = Number(observed[index]);
    const prediction = Number(predicted[index]);
    if (Number.isFinite(observation) && Number.isFinite(prediction)) pairs.push([observation, prediction]);
  }
  return pairs;
}

export function pairedStatistics(observed, predicted) {
  const pairs = finitePairs(observed, predicted);
  if (!pairs.length) return { count: 0, bias: null, mae: null, rmse: null, pearson: null, r2: null };
  const count = pairs.length;
  const meanObserved = pairs.reduce((sum, pair) => sum + pair[0], 0) / count;
  const meanPredicted = pairs.reduce((sum, pair) => sum + pair[1], 0) / count;
  let sumError = 0; let sumAbs = 0; let sumSquared = 0;
  let covariance = 0; let observedVariance = 0; let predictedVariance = 0;
  pairs.forEach(([observation, prediction]) => {
    const error = prediction - observation;
    sumError += error; sumAbs += Math.abs(error); sumSquared += error * error;
    covariance += (observation - meanObserved) * (prediction - meanPredicted);
    observedVariance += (observation - meanObserved) ** 2;
    predictedVariance += (prediction - meanPredicted) ** 2;
  });
  const pearsonDenominator = Math.sqrt(observedVariance * predictedVariance);
  return {
    count,
    bias: sumError / count,
    mae: sumAbs / count,
    rmse: Math.sqrt(sumSquared / count),
    pearson: pearsonDenominator > 0 ? covariance / pearsonDenominator : null,
    r2: observedVariance > 0 ? 1 - sumSquared / observedVariance : null
  };
}

export function moransI(values, width, height, connectivity = 4) {
  width = Math.max(0, Math.floor(Number(width)));
  height = Math.max(0, Math.floor(Number(height)));
  const size = width * height;
  if (!size || values?.length < size) return { count: 0, value: null, expected: null, weights: 0 };
  const valid = [];
  for (let index = 0; index < size; index++) if (Number.isFinite(Number(values[index]))) valid.push(index);
  if (valid.length < 2) return { count: valid.length, value: null, expected: null, weights: 0 };
  const mean = valid.reduce((sum, index) => sum + Number(values[index]), 0) / valid.length;
  const denominator = valid.reduce((sum, index) => sum + (Number(values[index]) - mean) ** 2, 0);
  if (denominator === 0) return { count: valid.length, value: null, expected: -1 / (valid.length - 1), weights: 0 };
  const validSet = new Set(valid);
  const offsets = connectivity === 8
    ? [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]
    : [[0,-1],[-1,0],[1,0],[0,1]];
  let numerator = 0; let weights = 0;
  valid.forEach(index => {
    const x = index % width; const y = Math.floor(index / width);
    offsets.forEach(([dx, dy]) => {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) return;
      const neighbor = ny * width + nx;
      if (!validSet.has(neighbor)) return;
      numerator += (Number(values[index]) - mean) * (Number(values[neighbor]) - mean);
      weights += 1;
    });
  });
  return {
    count: valid.length,
    value: weights ? valid.length / weights * numerator / denominator : null,
    expected: -1 / (valid.length - 1),
    weights
  };
}

function pointCoordinates(point) {
  if (Array.isArray(point)) return [Number(point[0]), Number(point[1])];
  return [Number(point?.x), Number(point?.y)];
}

function nearestDistances(from, to) {
  if (!from.length || !to.length) return [];
  return from.map(source => {
    const [x, y] = pointCoordinates(source);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    let nearest = Infinity;
    to.forEach(target => {
      const [tx, ty] = pointCoordinates(target);
      if (Number.isFinite(tx) && Number.isFinite(ty)) nearest = Math.min(nearest, Math.hypot(x - tx, y - ty));
    });
    return Number.isFinite(nearest) ? nearest : null;
  }).filter(Number.isFinite);
}

function distanceSummary(distances) {
  if (!distances.length) return { count: 0, mean: null, median: null, rmse: null, p95: null };
  const sorted = [...distances].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    count: distances.length,
    mean: distances.reduce((sum, value) => sum + value, 0) / distances.length,
    median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    rmse: Math.sqrt(distances.reduce((sum, value) => sum + value * value, 0) / distances.length),
    p95: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * .95) - 1)]
  };
}

export function pointPatternMisfit(predicted, observed, tolerance = Infinity) {
  const cleanPredicted = (predicted || []).filter(point => pointCoordinates(point).every(Number.isFinite));
  const cleanObserved = (observed || []).filter(point => pointCoordinates(point).every(Number.isFinite));
  const observationDistances = nearestDistances(cleanObserved, cleanPredicted);
  const predictionDistances = nearestDistances(cleanPredicted, cleanObserved);
  const threshold = Math.max(0, Number(tolerance));
  const observationHits = observationDistances.filter(distance => distance <= threshold).length;
  const predictionHits = predictionDistances.filter(distance => distance <= threshold).length;
  const observation = distanceSummary(observationDistances);
  const prediction = distanceSummary(predictionDistances);
  return {
    predictedCount: cleanPredicted.length,
    observedCount: cleanObserved.length,
    observation,
    prediction,
    recall: cleanObserved.length ? observationHits / cleanObserved.length : null,
    precision: cleanPredicted.length ? predictionHits / cleanPredicted.length : null,
    symmetricMean: observation.mean == null || prediction.mean == null ? null : (observation.mean + prediction.mean) / 2,
    tolerance: threshold
  };
}
