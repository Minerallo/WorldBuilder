const LONGITUDE_NAMES = ["longitude", "lon", "long", "x"];
const LATITUDE_NAMES = ["latitude", "lat", "y"];

function normalizedName(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function splitRow(line, delimiter) {
  return delimiter
    ? line.split(delimiter).map(value => value.trim())
    : line.trim().split(/\s+/);
}

export function parseLithosphereTable(text) {
  const rawLines = String(text).split(/\r?\n/).map(line => line.trim());
  const declaredDelimiter = rawLines
    .map(line => line.match(/^#\s*delimiter:\s*(.+?)\s*$/i)?.[1])
    .find(Boolean);
  const lines = rawLines
    .filter(line => line && !line.startsWith("#") && !line.startsWith("//"));
  if (lines.length < 3) throw new Error("The table needs a header and at least two data rows.");
  const delimiter = declaredDelimiter || (lines[0].includes(",") ? "," : lines[0].includes("|") ? "|" : "");
  const first = splitRow(lines[0], delimiter);
  const hasHeader = first.some(value => !Number.isFinite(Number(value)));
  if (!hasHeader) throw new Error("Add a header naming longitude, latitude and at least one scalar field.");
  const columns = first.map(normalizedName);
  const longitudeIndex = columns.findIndex(name => LONGITUDE_NAMES.includes(name));
  const latitudeIndex = columns.findIndex(name => LATITUDE_NAMES.includes(name));
  if (longitudeIndex < 0 || latitudeIndex < 0) {
    throw new Error("The header must contain longitude/lon and latitude/lat columns.");
  }
  const rows = lines.slice(1).map(line => splitRow(line, delimiter))
    .filter(row => row.length >= columns.length)
    .map(row => row.map(Number))
    .filter(row => Number.isFinite(row[longitudeIndex]) && Number.isFinite(row[latitudeIndex]));
  if (rows.length < 4) throw new Error("Fewer than four valid geographic samples were found.");
  const fields = columns.filter((name, index) => index !== longitudeIndex && index !== latitudeIndex
    && rows.some(row => Number.isFinite(row[index])));
  if (!fields.length) throw new Error("No numerical scalar field was found.");
  return { columns, longitudeIndex, latitudeIndex, fields, rows };
}

export function regularLithosphereGrid(table, field) {
  const fieldIndex = table.columns.indexOf(normalizedName(field));
  if (fieldIndex < 0) throw new Error(`Field “${field}” is not present in the table.`);
  const longitudes = [...new Set(table.rows.map(row => row[table.longitudeIndex]))].sort((a, b) => a - b);
  const latitudes = [...new Set(table.rows.map(row => row[table.latitudeIndex]))].sort((a, b) => b - a);
  if (longitudes.length < 2 || latitudes.length < 2) throw new Error("The selected data must cover at least a 2 × 2 longitude/latitude grid.");
  if (longitudes.length * latitudes.length > 750000) throw new Error("This table is too large for the browser preview; crop or resample it first.");
  const lonIndex = new Map(longitudes.map((value, index) => [value, index]));
  const latIndex = new Map(latitudes.map((value, index) => [value, index]));
  const values = new Array(longitudes.length * latitudes.length).fill(null);
  table.rows.forEach(row => {
    const value = row[fieldIndex];
    if (!Number.isFinite(value)) return;
    values[latIndex.get(row[table.latitudeIndex]) * longitudes.length + lonIndex.get(row[table.longitudeIndex])] = value;
  });
  const finite = values.filter(Number.isFinite);
  if (finite.length < 4) throw new Error("The selected field has too few finite values.");
  const range = finite.reduce((result, value) => [Math.min(result[0], value), Math.max(result[1], value)], [Infinity, -Infinity]);
  return {
    nx: longitudes.length, ny: latitudes.length,
    west: longitudes[0], east: longitudes.at(-1),
    north: latitudes[0], south: latitudes.at(-1),
    values, min: range[0], max: range[1],
    field: table.columns[fieldIndex]
  };
}

function sampleRegularGrid(grid, longitude, latitude) {
  const x = (longitude - grid.west) / Math.max(1e-12, grid.east - grid.west) * (grid.nx - 1);
  const y = (grid.north - latitude) / Math.max(1e-12, grid.north - grid.south) * (grid.ny - 1);
  const x0 = Math.max(0, Math.min(grid.nx - 1, Math.floor(x)));
  const x1 = Math.max(0, Math.min(grid.nx - 1, x0 + 1));
  const y0 = Math.max(0, Math.min(grid.ny - 1, Math.floor(y)));
  const y1 = Math.max(0, Math.min(grid.ny - 1, y0 + 1));
  const tx = x - x0;
  const ty = y - y0;
  const samples = [
    [grid.values[y0 * grid.nx + x0], (1 - tx) * (1 - ty)],
    [grid.values[y0 * grid.nx + x1], tx * (1 - ty)],
    [grid.values[y1 * grid.nx + x0], (1 - tx) * ty],
    [grid.values[y1 * grid.nx + x1], tx * ty]
  ].filter(([value]) => Number.isFinite(value));
  const weight = samples.reduce((sum, sample) => sum + sample[1], 0);
  return weight > 0 ? samples.reduce((sum, sample) => sum + sample[0] * sample[1], 0) / weight : null;
}

export function remapGeographicGridToCartesian(grid, sourceBounds, targetBounds, limits = {}) {
  const geographicBounds = {
    west: Math.max(grid.west, Number(sourceBounds.west)),
    east: Math.min(grid.east, Number(sourceBounds.east)),
    south: Math.max(grid.south, Number(sourceBounds.south)),
    north: Math.min(grid.north, Number(sourceBounds.north))
  };
  if (!(geographicBounds.west < geographicBounds.east && geographicBounds.south < geographicBounds.north)) {
    throw new Error("The selected geographic source window does not overlap this dataset.");
  }
  if (!(Number(targetBounds.west) < Number(targetBounds.east) && Number(targetBounds.south) < Number(targetBounds.north))) {
    throw new Error("The Cartesian model domain has invalid X/Y bounds.");
  }
  const nx = Math.max(2, Math.min(Number(limits.maxNx) || 180, grid.nx));
  const ny = Math.max(2, Math.min(Number(limits.maxNy) || 90, grid.ny));
  const values = [];
  for (let row = 0; row < ny; row++) {
    const latitude = geographicBounds.north - row / Math.max(1, ny - 1) * (geographicBounds.north - geographicBounds.south);
    for (let column = 0; column < nx; column++) {
      const longitude = geographicBounds.west + column / Math.max(1, nx - 1) * (geographicBounds.east - geographicBounds.west);
      values.push(sampleRegularGrid(grid, longitude, latitude));
    }
  }
  const finite = values.filter(Number.isFinite);
  if (finite.length < 4) throw new Error("The selected geographic window contains too few finite samples.");
  return {
    ...grid,
    nx,
    ny,
    west: Number(targetBounds.west),
    east: Number(targetBounds.east),
    south: Number(targetBounds.south),
    north: Number(targetBounds.north),
    values,
    min: Math.min(...finite),
    max: Math.max(...finite),
    geographicBounds,
    sourceCoordinateSystem: "longitude-latitude",
    coordinateMapping: "equirectangular-to-cartesian"
  };
}
