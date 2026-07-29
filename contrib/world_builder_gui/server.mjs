import { createServer } from "node:http";
import { access, readFile, readdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSubmachineRequest, extractSubmachineImageUrl } from "./submachine.mjs";
import { loadSphericalTomographyGrid } from "./tomography-grid.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const worldBuilderRoot = fileURLToPath(new URL("../../", import.meta.url));
const logoSource = fileURLToPath(new URL("./assets/gwb-logo.png", import.meta.url));
const gplatesDataRoot = fileURLToPath(new URL("../gplates/data/", import.meta.url));
const port = Number(process.env.PORT || 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png"
};
const gplatesModels = {
  MULLER2022: [0, 1000], ZAHIROVIC2022: [0, 410], MERDITH2021: [0, 1000],
  CLENNETT2020: [0, 170], MULLER2019: [0, 250], MULLER2016: [0, 230],
  MATTHEWS2016: [0, 410], SETON2012: [0, 200], GOLONKA: [0, 550],
  PALEOMAP: [0, 1100], RODINIA: [540, 1100]
};
const gplatesEndpoints = {
  coastlines: "https://gws.gplates.org/reconstruct/coastlines/",
  subduction: "https://gws.gplates.org/topology/get_subduction_zones",
  boundaries: "https://gws.gplates.org/topology/plate_boundaries"
};
const localGplatesLayers = {
  coastlines: "continents.geojson",
  subduction: "trenches_with_avg_parameters.geojson",
  boundaries: "ridges_and_transforms.geojson"
};
const lithosphereTables = {
  "crust1-rho": "https://ds.iris.edu/dms/products/emc/data/OLD/CRUST1.0/CRUST1.0-rho.csv",
  "crust1-vp": "https://ds.iris.edu/dms/products/emc/data/OLD/CRUST1.0/CRUST1.0-vp.csv",
  "crust1-vs": "https://ds.iris.edu/dms/products/emc/data/OLD/CRUST1.0/CRUST1.0-vs.csv"
};
const interfaceCapabilities = [
  { title: "Feature geometry editor", category: "interface", action: "shape", text: "Draw polygons, ellipses, curves and segmented lines; add, move and delete vertices; resize thickness and internal layers." },
  { title: "Tomography and iso-geometry", category: "interface", action: "tomography", text: "Load numerical S20RTS or S40RTS dVs, derive dVp with an explicit ratio, draw iso-boundaries and convert anomaly regions into editable features." },
  { title: "Gravity modelling", category: "interface", action: "gravity", text: "Compute Bouguer, free-air, residual gravity and tensor components from editable density volumes with map, 3D and section layouts." },
  { title: "Topography workspace", category: "interface", action: "topography", text: "Draw elevation, use noise, import rasters or ETOPO, calculate isostatic topography and convert terrain to feature topography." },
  { title: "GPlates paleogeography", category: "interface", action: "paleogeography", text: "Load reconstructed coastlines, subduction zones and plate boundaries from bundled data or the GPlates Web Service." },
  { title: "Sections and split views", category: "interface", action: "section", text: "Draw multi-point sections, compare plan, 3D and depth views side by side, and link cameras like ParaView." },
  { title: "Project and scientific exports", category: "interface", action: "exports", text: "Save editable project state and export World Builder JSON, grid configuration, VTK.js geometry, CSV fields and screenshots." }
];

async function collectResearchFiles(directory, category, extensions, relativeBase = worldBuilderRoot, output = []) {
  if (output.length >= 600) return output;
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return output; }
  for (const entry of entries) {
    if (output.length >= 600) break;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectResearchFiles(absolute, category, extensions, relativeBase, output);
    } else if (extensions.some(extension => entry.name.endsWith(extension))) {
      try {
        const body = await readFile(absolute, "utf8");
        const text = body.slice(0, 220000);
        const heading = text.match(/^#{1,3}\s+(.+)$/m)?.[1]?.trim();
        output.push({
          title: heading || entry.name.replace(/\.[^.]+$/, "").replaceAll("_", " "),
          category,
          path: absolute.slice(relativeBase.length).replace(/^[/\\]/, ""),
          text
        });
      } catch {}
    }
  }
  return output;
}

const researchIndexPromise = Promise.all([
  collectResearchFiles(join(worldBuilderRoot, "doc/sphinx/user_manual"), "manual", [".md"]),
  collectResearchFiles(join(worldBuilderRoot, "tests/gwb-dat"), "example", [".wb", ".json"])
]).then(([manual, examples]) => [...interfaceCapabilities, ...manual, ...examples]);

function researchSnippet(text, tokens) {
  const plain = String(text).replace(/[#*`>{}\[\]"]/g, " ").replace(/\s+/g, " ").trim();
  const lower = plain.toLowerCase();
  const position = Math.max(0, ...tokens.map(token => lower.indexOf(token)).filter(index => index >= 0));
  const start = Math.max(0, position - 55);
  return `${start ? "…" : ""}${plain.slice(start, start + 230)}${start + 230 < plain.length ? "…" : ""}`;
}

async function searchResearch(query, scope) {
  const tokens = query.toLowerCase().split(/\s+/).filter(token => token.length > 1).slice(0, 8);
  if (!tokens.length) return interfaceCapabilities.map(item => ({ ...item, snippet: item.text, score: 1 }));
  const index = await researchIndexPromise;
  return index.filter(item => scope === "all" || item.category === scope).map(item => {
    const title = item.title.toLowerCase();
    const haystack = `${item.title} ${item.path || ""} ${item.text}`.toLowerCase();
    let score = 0;
    tokens.forEach(token => {
      if (title.includes(token)) score += 12;
      if ((item.path || "").toLowerCase().includes(token)) score += 5;
      let from = 0; let matches = 0;
      while ((from = haystack.indexOf(token, from)) >= 0 && matches < 8) { score += 1; from += token.length; matches++; }
    });
    return { title: item.title, category: item.category, action: item.action, path: item.path, snippet: researchSnippet(item.text, tokens), score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 24);
}

async function findTomographyDataDirectory() {
  const candidates = [
    process.env.ASPECT_SOURCE_DIR && join(process.env.ASPECT_SOURCE_DIR, "data/initial-temperature/S40RTS"),
    join(root, "../../../../../aspect_install/aspect_fs_fortran/aspect/data/initial-temperature/S40RTS"),
    join(root, "../../../../../aspect_install/aspect/data/initial-temperature/S40RTS")
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(join(candidate, "Spline_knots.txt"));
      return candidate;
    } catch {}
  }
  throw new Error("S20RTS/S40RTS coefficient data was not found. Set ASPECT_SOURCE_DIR to an ASPECT source tree.");
}

createServer(async (request, response) => {
  const requestUrl = new URL(request.url, "http://localhost");
  const pathname = decodeURIComponent(requestUrl.pathname);
  if (pathname === "/assets/gwb-logo.png") {
    try {
      response.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" });
      response.end(await readFile(logoSource));
    } catch {
      response.writeHead(404).end("Logo not found");
    }
    return;
  }
  if (pathname === "/api/etopo/relief") {
    try {
      const west = Number(requestUrl.searchParams.get("west"));
      const east = Number(requestUrl.searchParams.get("east"));
      const south = Number(requestUrl.searchParams.get("south"));
      const north = Number(requestUrl.searchParams.get("north"));
      if (![west, east, south, north].every(Number.isFinite)
        || west < -180 || east > 180 || south < -90 || north > 90
        || west >= east || south >= north) {
        throw new Error("Invalid ETOPO longitude/latitude bounds.");
      }
      const parameters = new URLSearchParams({
        bbox: `${west},${south},${east},${north}`,
        bboxSR: "4326", imageSR: "4326", size: "1200,800",
        format: "png32", transparent: "false", layers: "show:0", f: "image"
      });
      const sourceUrl = `https://gis.ngdc.noaa.gov/arcgis/rest/services/etopo1/MapServer/export?${parameters}`;
      const image = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(45000),
        headers: { "User-Agent": "GWB-Visual-Builder/1.0 (NOAA ETOPO interactive client)" }
      });
      if (!image.ok) throw new Error(`NOAA ETOPO returned HTTP ${image.status}.`);
      const body = Buffer.from(await image.arrayBuffer());
      response.writeHead(200, {
        "Content-Type": image.headers.get("content-type") || "image/png",
        "Content-Length": body.length,
        "Cache-Control": "private, max-age=900",
        "X-ETOPO-Source": sourceUrl
      });
      response.end(body);
    } catch (error) {
      response.writeHead(/Invalid/.test(error.message) ? 400 : 502, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error.message);
    }
    return;
  }
  if (pathname === "/api/gplates/reconstruction") {
    try {
      const layer = requestUrl.searchParams.get("layer");
      const model = String(requestUrl.searchParams.get("model") || "").toUpperCase();
      const time = Number(requestUrl.searchParams.get("time"));
      const anchorPlateId = Number(requestUrl.searchParams.get("anchor_plate_id") || 0);
      const range = gplatesModels[model];
      if (!gplatesEndpoints[layer] || !range || !Number.isFinite(time)
        || time < range[0] || time > range[1] || ![0, 1].includes(anchorPlateId)) {
        throw new Error("Invalid GPlates layer, model, age, or reference frame.");
      }
      const parameters = new URLSearchParams({ time: String(time), model });
      if (layer === "coastlines") parameters.set("anchor_plate_id", String(anchorPlateId));
      const sourceUrl = `${gplatesEndpoints[layer]}?${parameters}`;
      const source = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(60000),
        headers: { "User-Agent": "GWB-Visual-Builder/1.0 (EarthByte GPlates interactive client)" }
      });
      if (!source.ok) throw new Error(`GPlates Web Service returned HTTP ${source.status}.`);
      const body = Buffer.from(await source.arrayBuffer());
      response.writeHead(200, {
        "Content-Type": source.headers.get("content-type") || "application/geo+json",
        "Content-Length": body.length,
        "Cache-Control": "private, max-age=3600",
        "X-GPlates-Source": sourceUrl
      });
      response.end(body);
    } catch (error) {
      const status = /Invalid/.test(error.message) ? 400 : 502;
      response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error.message);
    }
    return;
  }
  if (pathname === "/api/gplates/local") {
    try {
      const layer = requestUrl.searchParams.get("layer");
      const filename = localGplatesLayers[layer];
      if (!filename) throw new Error("Invalid bundled GPlates layer.");
      const body = await readFile(join(gplatesDataRoot, filename));
      response.writeHead(200, {
        "Content-Type": "application/geo+json; charset=utf-8",
        "Content-Length": body.length,
        "Cache-Control": "private, max-age=3600",
        "X-GPlates-Source": `contrib/gplates/data/${filename}`
      });
      response.end(body);
    } catch (error) {
      response.writeHead(/Invalid/.test(error.message) ? 400 : 404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error.message);
    }
    return;
  }
  if (pathname === "/api/lithosphere/table") {
    try {
      const model = requestUrl.searchParams.get("model");
      const sourceUrl = lithosphereTables[model];
      if (!sourceUrl) throw new Error("Invalid lithosphere table.");
      const source = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(90000),
        headers: { "User-Agent": "GWB-Visual-Builder/1.0 (EarthScope lithosphere client)" }
      });
      if (!source.ok) throw new Error(`EarthScope returned HTTP ${source.status}.`);
      const body = Buffer.from(await source.arrayBuffer());
      response.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Length": body.length,
        "Cache-Control": "private, max-age=86400",
        "X-Lithosphere-Source": sourceUrl
      });
      response.end(body);
    } catch (error) {
      response.writeHead(/Invalid/.test(error.message) ? 400 : 502, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error.message);
    }
    return;
  }
  if (pathname === "/api/submachine/slice") {
    try {
      const sourceRequest = buildSubmachineRequest(Object.fromEntries(requestUrl.searchParams));
      const handlerRequest = sourceRequest
        .replace("index.php?", "cgi-bin/server_tomo_depth.php?")
        .replace("page=tomo_depth&", "");
      const landing = await fetch("https://orfeus-eu.org/submachine/index.php?page=tomo_depth", {
        signal: AbortSignal.timeout(30000),
        headers: { "User-Agent": "GWB-Visual-Builder/1.0 (interactive SubMachine client)" }
      });
      let sessionCookie = landing.headers.get("set-cookie")?.split(";")[0];
      if (!sessionCookie) throw new Error("SubMachine did not create a plotting session.");
      const generated = await fetch(handlerRequest, {
        redirect: "manual",
        signal: AbortSignal.timeout(45000),
        headers: {
          "User-Agent": "GWB-Visual-Builder/1.0 (interactive SubMachine client)",
          Cookie: sessionCookie,
          Referer: "https://orfeus-eu.org/submachine/index.php?page=tomo_depth"
        }
      });
      if (generated.status >= 400) throw new Error(`SubMachine returned HTTP ${generated.status}.`);
      sessionCookie = generated.headers.get("set-cookie")?.split(";")[0] || sessionCookie;
      const result = await fetch(sourceRequest, {
        redirect: "follow",
        signal: AbortSignal.timeout(45000),
        headers: {
          "User-Agent": "GWB-Visual-Builder/1.0 (interactive SubMachine client)",
          Cookie: sessionCookie
        }
      });
      if (!result.ok) throw new Error(`SubMachine returned HTTP ${result.status}.`);
      const resultHtml = await result.text();
      const imageUrl = extractSubmachineImageUrl(resultHtml, result.url);
      const image = await fetch(imageUrl, {
        signal: AbortSignal.timeout(30000),
        headers: { "User-Agent": "GWB-Visual-Builder/1.0 (interactive SubMachine client)" }
      });
      if (!image.ok) throw new Error(`The generated slice returned HTTP ${image.status}.`);
      const body = Buffer.from(await image.arrayBuffer());
      response.writeHead(200, {
        "Content-Type": image.headers.get("content-type") || "image/jpeg",
        "Content-Length": body.length,
        "Cache-Control": "private, max-age=300",
        "X-Submachine-Result-Url": result.url,
        "X-Submachine-Image-Url": imageUrl
      });
      response.end(body);
    } catch (error) {
      const status = /Unsupported|numeric|outside|Invalid/.test(error.message) ? 400 : 502;
      response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error.message);
    }
    return;
  }
  if (pathname === "/api/tomography/grid") {
    try {
      buildSubmachineRequest(Object.fromEntries(requestUrl.searchParams));
      if (!["model_s20rts", "model_s40rts"].includes(requestUrl.searchParams.get("model"))) {
        throw new Error("This SubMachine model does not expose a numerical grid through the current public service.");
      }
      const grid = await loadSphericalTomographyGrid({
        ...Object.fromEntries(requestUrl.searchParams),
        dataDirectory: await findTomographyDataDirectory()
      });
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, max-age=3600"
      });
      response.end(JSON.stringify(grid));
    } catch (error) {
      const unavailable = /does not expose/.test(error.message);
      const invalid = /numeric|outside|Invalid/.test(error.message);
      response.writeHead(unavailable ? 422 : invalid ? 400 : 503, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error.message);
    }
    return;
  }
  if (pathname === "/api/research/search") {
    try {
      const query = String(requestUrl.searchParams.get("q") || "").trim().slice(0, 120);
      const requestedScope = String(requestUrl.searchParams.get("scope") || "all");
      const scope = ["all", "interface", "manual", "example"].includes(requestedScope) ? requestedScope : "all";
      const results = await searchResearch(query, scope);
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, max-age=60"
      });
      response.end(JSON.stringify({
        query, scope, count: results.length, results,
        links: {
          manual: "https://gwb.readthedocs.io/",
          github: `https://github.com/GeodynamicWorldBuilder/WorldBuilder/search?q=${encodeURIComponent(query)}&type=code`
        }
      }));
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(`Research index failed: ${error.message}`);
    }
    return;
  }
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const target = normalize(join(root, relative));
  if (!target.startsWith(root)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const body = await readFile(target);
    response.writeHead(200, {
      "Content-Type": mime[extname(target)] || "application/octet-stream",
      "Content-Length": body.length
    });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`GWB Visual Builder: http://127.0.0.1:${port}`);
});
