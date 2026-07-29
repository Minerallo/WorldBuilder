export const PLANETARY_BODY_CATALOG = [
  {
    id: "earth", name: "Earth", family: "terrestrial planet", symbol: "⊕",
    radius: 6371000, gravity: 9.81, surfaceTemperature: 288, mantleTemperature: 1600,
    modelDepth: 400000, backgroundDensity: 3300,
    summary: "Reference terrestrial body with plate tectonics, oceans and abundant global geophysical constraints.",
    fields: ["ETOPO relief", "gravity", "crust", "lithosphere", "tomography", "plate reconstructions"],
    data: [
      ["NOAA ETOPO", "https://www.ncei.noaa.gov/products/etopo-global-relief-model"],
      ["EarthScope data", "https://www.earthscope.org/data/"]
    ]
  },
  {
    id: "moon", name: "Moon", family: "rocky satellite", symbol: "☾",
    radius: 1737400, gravity: 1.62, surfaceTemperature: 250, mantleTemperature: 1500,
    modelDepth: 500000, backgroundDensity: 3340,
    summary: "Airless differentiated body suited to crust, mantle, impact-basin, mascon and tidal-evolution models.",
    fields: ["LOLA topography", "GRAIL gravity", "crustal thickness", "geology", "imagery"],
    data: [
      ["USGS lunar catalog", "https://astrogeology.usgs.gov/search?target=Moon"],
      ["PDS Geosciences Node", "https://pds-geosciences.wustl.edu/missions/lro/"]
    ]
  },
  {
    id: "mars", name: "Mars", family: "terrestrial planet", symbol: "♂",
    radius: 3389500, gravity: 3.71, surfaceTemperature: 210, mantleTemperature: 1650,
    modelDepth: 600000, backgroundDensity: 3500,
    summary: "Rocky planet with exceptional global topography, gravity and crustal-thickness coverage.",
    fields: ["MOLA topography", "gravity", "crustal thickness", "geology", "thermal inertia"],
    data: [
      ["USGS Mars foundational products", "https://fdp.astrogeology.usgs.gov/fdp/mars/"],
      ["PDS Mars Orbital Data Explorer", "https://ode.rsl.wustl.edu/mars/"]
    ]
  },
  {
    id: "venus", name: "Venus", family: "terrestrial planet", symbol: "♀",
    radius: 6051800, gravity: 8.87, surfaceTemperature: 737, mantleTemperature: 1700,
    modelDepth: 700000, backgroundDensity: 3300,
    summary: "Hot stagnant-lid candidate with Magellan radar topography, gravity and global geological mapping.",
    fields: ["Magellan topography", "gravity", "radar mosaic", "geology"],
    data: [
      ["USGS Venus catalog", "https://astrogeology.usgs.gov/search?target=Venus"],
      ["PDS Venus Orbital Data Explorer", "https://ode.rsl.wustl.edu/venus/"]
    ]
  },
  {
    id: "mercury", name: "Mercury", family: "terrestrial planet", symbol: "☿",
    radius: 2439700, gravity: 3.70, surfaceTemperature: 440, mantleTemperature: 1800,
    modelDepth: 450000, backgroundDensity: 3400,
    summary: "Large-core rocky planet with MESSENGER topography, gravity, chemistry and global image products.",
    fields: ["MESSENGER DEM", "gravity", "crustal chemistry", "geology", "imagery"],
    data: [
      ["USGS MESSENGER global products", "https://astrogeology.usgs.gov/search/map/mercury-messenger-global-products"],
      ["PDS Mercury Orbital Data Explorer", "https://ode.rsl.wustl.edu/mercury/"]
    ]
  },
  {
    id: "io", name: "Io", family: "volcanic icy-world satellite", symbol: "◉",
    radius: 1821600, gravity: 1.796, surfaceTemperature: 110, mantleTemperature: 1700,
    modelDepth: 500000, backgroundDensity: 3500,
    summary: "Tidally heated silicate world for plume, magma-ocean, lithosphere and extreme heat-flow experiments.",
    fields: ["global mosaic", "shape", "volcanic centers", "heat flow", "tidal forcing"],
    data: [
      ["USGS planetary catalog", "https://astrogeology.usgs.gov/search?target=Io"],
      ["PDS Cartography and Imaging", "https://pds-imaging.jpl.nasa.gov/"]
    ]
  },
  {
    id: "europa", name: "Europa", family: "icy satellite", symbol: "◌",
    radius: 1560800, gravity: 1.315, surfaceTemperature: 102, mantleTemperature: 1250,
    modelDepth: 200000, backgroundDensity: 3000,
    summary: "Ice-shell and subsurface-ocean target for tidal heating, convection and shell-thickness models.",
    fields: ["global mosaic", "shape", "geology", "ice shell", "tidal gravity"],
    data: [
      ["USGS planetary catalog", "https://astrogeology.usgs.gov/search?target=Europa"],
      ["PDS Cartography and Imaging", "https://pds-imaging.jpl.nasa.gov/"]
    ]
  },
  {
    id: "ganymede", name: "Ganymede", family: "icy satellite", symbol: "◍",
    radius: 2634100, gravity: 1.428, surfaceTemperature: 110, mantleTemperature: 1400,
    modelDepth: 800000, backgroundDensity: 3000,
    summary: "Differentiated icy moon with a rocky mantle, deep ocean layers and an intrinsic magnetic field.",
    fields: ["global mosaic", "shape", "geology", "gravity", "interior layering"],
    data: [
      ["USGS planetary catalog", "https://astrogeology.usgs.gov/search?target=Ganymede"],
      ["PDS Cartography and Imaging", "https://pds-imaging.jpl.nasa.gov/"]
    ]
  },
  {
    id: "titan", name: "Titan", family: "icy satellite", symbol: "◐",
    radius: 2574700, gravity: 1.352, surfaceTemperature: 94, mantleTemperature: 1200,
    modelDepth: 500000, backgroundDensity: 2500,
    summary: "Icy world with a dense atmosphere, hydrocarbon surface system and likely subsurface ocean.",
    fields: ["Cassini radar DEM", "shape", "gravity", "geology", "surface liquids"],
    data: [
      ["USGS planetary catalog", "https://astrogeology.usgs.gov/search?target=Titan"],
      ["PDS Ring-Moon Systems Node", "https://pds-rings.seti.org/"]
    ]
  },
  {
    id: "enceladus", name: "Enceladus", family: "icy satellite", symbol: "✧",
    radius: 252100, gravity: 0.113, surfaceTemperature: 75, mantleTemperature: 1000,
    modelDepth: 100000, backgroundDensity: 2400,
    summary: "Small active icy moon with a global DEM, south-polar tectonics, plumes and ocean constraints.",
    fields: ["Cassini global DEM", "shape", "gravity", "geology", "plume sources"],
    data: [
      ["USGS Enceladus global DEM", "https://astrogeology.usgs.gov/search/map/enceladus-cassini-global-dem-200m-schenk"],
      ["PDS Ring-Moon Systems Node", "https://pds-rings.seti.org/"]
    ]
  },
  {
    id: "pluto", name: "Pluto", family: "dwarf planet", symbol: "♇",
    radius: 1188000, gravity: 0.62, surfaceTemperature: 38, mantleTemperature: 900,
    modelDepth: 350000, backgroundDensity: 2200,
    summary: "Ice-rock dwarf planet with New Horizons topography, tectonics and volatile-ice provinces.",
    fields: ["New Horizons DEM", "shape", "geology", "imagery", "volatile units"],
    data: [
      ["USGS planetary catalog", "https://astrogeology.usgs.gov/search?target=Pluto"],
      ["PDS Small Bodies Node", "https://pds-smallbodies.astro.umd.edu/"]
    ]
  }
];

export function planetaryBodyById(id) {
  return PLANETARY_BODY_CATALOG.find(body => body.id === id);
}

export function searchPlanetaryBodies(query = "", family = "all") {
  const tokens = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  return PLANETARY_BODY_CATALOG.filter(body => {
    if (family !== "all" && body.family !== family) return false;
    const haystack = `${body.name} ${body.family} ${body.summary} ${body.fields.join(" ")}`.toLowerCase();
    return tokens.every(token => haystack.includes(token));
  });
}
