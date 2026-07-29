export const TOMOGRAPHY_CATALOG = [
  {
    id: "model_s20rts", name: "S20RTS", provider: "ASPECT / SubMachine",
    coverage: "Global mantle", fields: ["dVs"], formats: ["Spherical harmonics"],
    availability: "numerical", availabilityLabel: "Numerical now",
    summary: "Global shear-wave model evaluated locally from the ASPECT coefficient file.",
    sourceUrl: "https://orfeus-eu.org/submachine/",
    citation: "Ritsema, van Heijst & Woodhouse (1999), Science 286, 1925–1928.",
    citationUrl: "https://doi.org/10.1126/science.286.5446.1925"
  },
  {
    id: "model_s40rts", name: "S40RTS", provider: "ASPECT / SubMachine",
    coverage: "Global mantle", fields: ["dVs"], formats: ["Spherical harmonics"],
    availability: "numerical", availabilityLabel: "Numerical now",
    summary: "Global shear-wave model evaluated locally from the ASPECT coefficient file.",
    sourceUrl: "https://orfeus-eu.org/submachine/",
    citation: "Ritsema et al. (2011), Geophysical Journal International 184, 1223–1236.",
    citationUrl: "https://doi.org/10.1111/j.1365-246X.2010.04884.x"
  },
  {
    id: "model_semucb_wm1", name: "SEMUCB-WM1", provider: "SubMachine",
    coverage: "Global mantle", fields: ["dVs"], formats: ["Rendered depth slices"],
    availability: "preview", availabilityLabel: "Rendered fallback",
    summary: "Whole-mantle shear-wave model; the current GUI uses the SubMachine depth-slice service.",
    sourceUrl: "https://orfeus-eu.org/submachine/",
    citation: "French & Romanowicz (2014), Geophysical Journal International 199, 1303–1327.",
    citationUrl: "https://doi.org/10.1093/gji/ggu334"
  },
  {
    id: "model_tx2019slab_s", name: "TX2019slab-S", provider: "SubMachine",
    coverage: "Global mantle", fields: ["dVs"], formats: ["Rendered depth slices"],
    availability: "preview", availabilityLabel: "Rendered fallback",
    summary: "S-wave version of the TX2019slab mantle model.",
    sourceUrl: "https://orfeus-eu.org/submachine/",
    citation: "Lu et al. (2019), Journal of Geophysical Research: Solid Earth 124.",
    citationUrl: "https://doi.org/10.1029/2019JB017448"
  },
  {
    id: "model_tx2019slab_p", name: "TX2019slab-P", provider: "SubMachine",
    coverage: "Global mantle", fields: ["dVp"], formats: ["Rendered depth slices"],
    availability: "preview", availabilityLabel: "Rendered fallback",
    summary: "P-wave version of the TX2019slab mantle model.",
    sourceUrl: "https://orfeus-eu.org/submachine/",
    citation: "Lu et al. (2019), Journal of Geophysical Research: Solid Earth 124.",
    citationUrl: "https://doi.org/10.1029/2019JB017448"
  },
  {
    id: "model_savani", name: "SAVANI", provider: "SubMachine",
    coverage: "Global mantle", fields: ["dVs", "anisotropy"], formats: ["Rendered depth slices"],
    availability: "preview", availabilityLabel: "Rendered fallback",
    summary: "Whole-mantle anisotropic shear-wave model.",
    sourceUrl: "https://orfeus-eu.org/submachine/",
    citation: "Auer et al. (2014), Geophysical Journal International 199, 498–523.",
    citationUrl: "https://doi.org/10.1093/gji/ggu149"
  },
  {
    id: "model_gypsum_s", name: "GyPSuM-S", provider: "SubMachine",
    coverage: "Global mantle", fields: ["dVs"], formats: ["Rendered depth slices"],
    availability: "preview", availabilityLabel: "Rendered fallback",
    summary: "Joint geodynamic and seismic mantle model, S-wave field.",
    sourceUrl: "https://orfeus-eu.org/submachine/",
    citation: "Simmons et al. (2010), Journal of Geophysical Research: Solid Earth 115.",
    citationUrl: "https://doi.org/10.1029/2010JB007631"
  },
  {
    id: "model_gypsum_p", name: "GyPSuM-P", provider: "SubMachine",
    coverage: "Global mantle", fields: ["dVp"], formats: ["Rendered depth slices"],
    availability: "preview", availabilityLabel: "Rendered fallback",
    summary: "Joint geodynamic and seismic mantle model, P-wave field.",
    sourceUrl: "https://orfeus-eu.org/submachine/",
    citation: "Simmons et al. (2010), Journal of Geophysical Research: Solid Earth 115.",
    citationUrl: "https://doi.org/10.1029/2010JB007631"
  },
  {
    id: "cos_euwa310", name: "EUWA310", provider: "ETH COS",
    coverage: "Europe and Western Asia · upper mantle", fields: ["Vsv"],
    formats: ["NetCDF · 2 GB", "HDF5/XDMF · 3 or 12 GB"],
    availability: "download", availabilityLabel: "Downloadable volume",
    summary: "Regional full-waveform inversion from 310 quasi-Newton updates.",
    sourceUrl: "https://cos.ethz.ch/models.html#euwa310-europe-and-western-asia-fwi",
    citation: "Schiller et al. (2026), The upper mantle of Europe and Western Asia.",
    citationUrl: "https://doi.org/10.48550/arXiv.2605.26871"
  },
  {
    id: "cos_csem2", name: "CSEM2", provider: "ETH COS",
    coverage: "Global, with seven regional submodels", fields: ["Vp", "Vsv", "Vsh"],
    formats: ["Regional NetCDF volumes"],
    availability: "download", availabilityLabel: "Downloadable volume",
    summary: "Second-generation global, multi-resolution Collaborative Seismic Earth Model.",
    sourceUrl: "https://cos.ethz.ch/models.html#collaborative-seismic-earth-model-generation-2",
    citation: "The Collaborative Seismic Earth Model: Generation 2 (2024).",
    citationUrl: "https://doi.org/10.1029/2024JB029656"
  },
  {
    id: "cos_reveal", name: "REVEAL", provider: "ETH COS",
    coverage: "Global mantle", fields: ["Vsv", "Vsh", "Vp"],
    formats: ["NetCDF · 400 MB", "HDF5/XDMF · 4 GB"],
    availability: "download", availabilityLabel: "Downloadable volume",
    summary: "Global transversely isotropic full-waveform inversion model.",
    sourceUrl: "https://cos.ethz.ch/models.html#reveal-global-scale-full-waveform-inversion-model",
    citation: "Thrastarson et al. (2024), REVEAL: A global full-waveform inversion model.",
    citationUrl: "https://cos.ethz.ch/models.html#reveal-global-scale-full-waveform-inversion-model"
  },
  {
    id: "cos_africa_fwi", name: "African Plate FWI", provider: "ETH COS",
    coverage: "African Plate", fields: ["Vsv"],
    formats: ["NetCDF", "HDF5"],
    availability: "download", availabilityLabel: "Downloadable volume",
    summary: "Regional full seismic waveform inversion of the African Plate.",
    sourceUrl: "https://cos.ethz.ch/models.html#fwi-of-the-african-plate",
    citation: "van Herwaarden et al. (2023), Full-waveform tomography of the African Plate.",
    citationUrl: "https://doi.org/10.1029/2022JB026023"
  },
  {
    id: "cos_lowe", name: "LOWE", provider: "ETH COS",
    coverage: "Global mantle", fields: ["Vp", "Vsv", "Vsh"],
    formats: ["NetCDF", "HDF5"],
    availability: "download", availabilityLabel: "Downloadable volume",
    summary: "Long-wavelength, radially anisotropic whole-Earth model.",
    sourceUrl: "https://cos.ethz.ch/models.html#long-wavelength-earth-model-lowe",
    citation: "Thrastarson et al. (2022), Data-adaptive global full-waveform inversion.",
    citationUrl: "https://doi.org/10.1093/gji/ggac122"
  },
  {
    id: "cos_csem1", name: "CSEM1", provider: "ETH COS / EarthScope EMC",
    coverage: "Global crust and mantle", fields: ["Vp", "Vs"],
    formats: ["EarthScope EMC volume"],
    availability: "download", availabilityLabel: "Downloadable volume",
    summary: "First-generation Collaborative Seismic Earth Model.",
    sourceUrl: "https://cos.ethz.ch/models.html#collaborative-seismic-earth-model-generation-1",
    citation: "Fichtner et al. (2018), The Collaborative Seismic Earth Model: Generation 1.",
    citationUrl: "https://cos.ethz.ch/models.html#collaborative-seismic-earth-model-generation-1"
  }
];

export function tomographyModelById(id) {
  return TOMOGRAPHY_CATALOG.find(model => model.id === id) || null;
}

export function searchTomographyModels(query = "", provider = "all") {
  const needle = String(query).trim().toLowerCase();
  return TOMOGRAPHY_CATALOG.filter(model => {
    if (provider !== "all" && model.provider !== provider) return false;
    if (!needle) return true;
    return [
      model.name, model.provider, model.coverage, model.summary,
      model.fields.join(" "), model.formats.join(" "), model.availabilityLabel
    ].join(" ").toLowerCase().includes(needle);
  });
}
