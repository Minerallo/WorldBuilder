export const LITHOSPHERE_CATALOG = [
  {
    id: "litho1", name: "LITHO1.0", provider: "GWB bundled dataset / EarthScope",
    coverage: "Global · 1° · −5 to 320 km",
    fields: ["layer tops", "thickness", "Vp", "Vs", "density"],
    formats: ["NetCDF", "GeoTess", "native"],
    availability: "builtin", availabilityLabel: "Built into GWB",
    summary: "Bundled in GWB for spherical feature depth boundaries and depth-surface topography; EarthScope also provides the original model.",
    sourceUrl: "https://ds.iris.edu/ds/products/emc-litho10/",
    citation: "Pasyanos et al. (2014), LITHO1.0.",
    citationUrl: "https://doi.org/10.1002/2013JB010626"
  },
  {
    id: "crust1", name: "CRUST1.0", provider: "EarthScope EMC / UCSD",
    coverage: "Global · 1° crust",
    fields: ["Moho depth", "layer thickness", "Vp", "Vs", "density"],
    formats: ["GeoCSV", "NetCDF", "native text"],
    availability: "table", availabilityLabel: "CSV import ready",
    summary: "Nine-layer global crustal model including water, ice, sediments, crystalline crust and uppermost mantle.",
    sourceUrl: "https://ds.iris.edu/ds/products/emc-crust10/",
    downloadUrl: "https://ds.iris.edu/dms/products/emc/data/OLD/CRUST1.0/",
    citation: "Laske, Masters, Ma & Pasyanos (2013), CRUST1.0.",
    citationUrl: "https://igppweb.ucsd.edu/~gabi/crust1.html"
  },
  {
    id: "lithoref18", name: "LithoRef18", provider: "LitMod / GPlates",
    coverage: "Global · 2° · surface to 410 km",
    fields: ["LAB depth", "Moho depth", "temperature", "density", "composition"],
    formats: ["XYZ tables", "GPlates portal"],
    availability: "table", availabilityLabel: "Table import ready",
    summary: "Joint inversion reference model constrained by gravity, geoid, elevation, seismic, thermal and petrological data.",
    sourceUrl: "https://www.juanafonso.com/software",
    citation: "Afonso et al. (2019), LithoRef18.",
    citationUrl: "https://doi.org/10.1093/gji/ggz094"
  },
  {
    id: "wintercg", name: "WINTERC-G", provider: "3D Earth",
    coverage: "Global lithosphere and upper mantle · to 330 km",
    fields: ["temperature", "density", "composition", "Vs"],
    formats: ["download archive", "depth layers"],
    availability: "download", availabilityLabel: "Download model",
    summary: "Thermochemical reference model derived from coupled waveform, heat-flow, elevation and satellite-gravity constraints.",
    sourceUrl: "https://www.3dearth.uni-kiel.de/en/global-reference-model",
    citation: "Fullea et al. (2021), WINTERC-G.",
    citationUrl: "https://doi.org/10.1093/gji/ggab094"
  },
  {
    id: "tc1", name: "TC1", provider: "Lithosphere.info",
    coverage: "Continental lithosphere · global · 5°",
    fields: ["temperature", "thermal gradient", "550/900/1300°C isotherms", "LAB"],
    formats: ["text tables", "download archive"],
    availability: "table", availabilityLabel: "Table import ready",
    summary: "Global thermal model of continental lithosphere with temperatures at 40–200 km and thermal-thickness estimates.",
    sourceUrl: "https://lithosphere.info/downloads.html",
    citation: "Artemieva (2006), Global 1°×1° thermal model TC1.",
    citationUrl: "https://lithosphere.info/publications.html"
  },
  {
    id: "cam2016", name: "CAM2016", provider: "EarthScope EMC",
    coverage: "Global crust and upper mantle",
    fields: ["Vsv", "Vsh", "anisotropy"],
    formats: ["depth tables", "compressed archives"],
    availability: "download", availabilityLabel: "Download model",
    summary: "Global radially anisotropic crust and upper-mantle model distributed as individual depth surfaces.",
    sourceUrl: "https://ds.iris.edu/ds/products/emc-cam2016/",
    citation: "Ho et al. (2016), CAM2016.",
    citationUrl: "https://doi.org/10.1093/gji/ggw292"
  },
  {
    id: "eunaseis", name: "EUNAseis", provider: "Lithosphere.info",
    coverage: "Europe, North Atlantic and surroundings",
    fields: ["crustal structure", "Vp", "Vs", "density"],
    formats: ["regional download archive"],
    availability: "download", availabilityLabel: "Download model",
    summary: "Regional seismic model intended for high-resolution lithospheric structure in Europe and the North Atlantic.",
    sourceUrl: "https://lithosphere.info/downloads.html",
    citation: "Artemieva and Thybo, EUNAseis regional model.",
    citationUrl: "https://lithosphere.info/publications.html"
  }
];

export function lithosphereModelById(id) {
  return LITHOSPHERE_CATALOG.find(model => model.id === id) || null;
}

export function searchLithosphereModels(query = "", provider = "all") {
  const needle = String(query).trim().toLowerCase();
  return LITHOSPHERE_CATALOG.filter(model => {
    if (provider !== "all" && model.provider !== provider) return false;
    if (!needle) return true;
    return [
      model.name, model.provider, model.coverage, model.summary,
      model.fields.join(" "), model.formats.join(" "), model.availabilityLabel
    ].join(" ").toLowerCase().includes(needle);
  });
}
