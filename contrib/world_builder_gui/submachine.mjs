export const SUBMACHINE_MODELS = new Set([
  "model_s20rts",
  "model_s40rts",
  "model_semucb_wm1",
  "model_tx2019slab_s",
  "model_tx2019slab_p",
  "model_savani",
  "model_gypsum_p",
  "model_gypsum_s"
]);

const ALL_MODEL_FIELDS = [
  "model_gypsum_p", "model_gypsum_s", "model_pri_p05", "model_pri_s05", "model_gap_p4",
  "model_savani", "model_llnl_g3dv3", "model_semucb_wm1", "model_mitp_usa_2011mar",
  "model_s40rts", "model_uu_p07", "model_tx2011", "model_hmsl_p06", "model_hmsl_s06",
  "model_mitp08", "model_s10mean", "model_s20rts", "model_ox_p16", "model_sl2013sv",
  "model_sp12rts_p", "model_sp12rts_s", "model_spani_p", "model_spani_s",
  "model_s362ani_m", "model_semum", "model_saw642anb", "model_mitp_usa_2016may",
  "model_tx2015", "model_3D2016_09Sv", "model_sigloch2011", "model_zaroli2016",
  "model_sglobe_rani", "model_seisglob1", "model_seisglob2", "model_pmean", "model_smean",
  "model_mit2018_p", "model_mit2018_s", "model_mit2018_p_std", "model_mit2018_s_std",
  "model_detox_p1", "model_detox_p2", "model_detox_p3", "model_tx2019slab_p",
  "model_tx2019slab_s", "model_sam5_p_2019", "model_feng13s", "model_schimmel03p",
  "model_schimmel03s", "model_rocha19ap", "model_rocha19bp", "model_sa2019s",
  "model_rrox19", "vm_14_001_low", "vm_14_001_high", "model_unica25"
];

export function buildSubmachineRequest(input) {
  const values = {
    model: String(input.model || ""),
    depth: Number(input.depth),
    range: Number(input.range),
    west: Number(input.west),
    east: Number(input.east),
    south: Number(input.south),
    north: Number(input.north)
  };
  if (!SUBMACHINE_MODELS.has(values.model)) throw new Error("Unsupported tomography model.");
  if (![values.depth, values.range, values.west, values.east, values.south, values.north].every(Number.isFinite)) {
    throw new Error("Tomography parameters must be numeric.");
  }
  if (values.depth < 0 || values.depth > 2890 || values.range <= 0 || values.range > 10) {
    throw new Error("Depth or color range is outside the supported range.");
  }
  if (values.west < -180 || values.east > 180 || values.south < -90 || values.north > 90
    || values.west >= values.east || values.south >= values.north) {
    throw new Error("Invalid tomography bounds.");
  }
  const parameters = new URLSearchParams({
    page: "tomo_depth",
    depth: String(values.depth),
    vmin: String(-values.range),
    vmax: String(values.range),
    lon_0: "180",
    lat_0: "20",
    remove_mean: "0",
    sigma_gauss: "0",
    ref_bg_model: "0",
    map_proj: "cyl",
    plot_coastline: "c",
    plot_plate_bound: "0",
    plot_hotspots: "0",
    sel_cmap_name: "custom-005",
    sel_cmap_numb: "17",
    plot_graticules: "0",
    plot_recons_plate: "0",
    plot_subduction: "0",
    plot_ridge: "0",
    plot_recon_coastline: "0",
    plate_sinking_rate_um_low: "10",
    plate_sinking_rate_um_high: "0",
    plate_sinking_rate_lm_low: "10",
    plate_sinking_rate_lm_high: "0",
    option_recons_time: "option_rt_0",
    user_recons_time: "100",
    sel_age_low_plate_color: "magenta",
    sel_age_low_coastline_color: "lightgrey",
    plot_shear_wave_splitting: "0",
    user_sws_scale: "1",
    sel_color_sws: "magenta",
    llcrnrlon: String(values.west),
    llcrnrlat: String(values.south),
    urcrnrlon: String(values.east),
    urcrnrlat: String(values.north),
    plot_ulvz: "0",
    user_ulvz_opac: "0.01",
    sel_color_ulvz: "magenta",
    user_image_dpi: "120",
    user_image_format: "JPEG",
    download_grid: "0",
    Submit: "Submit"
  });
  ALL_MODEL_FIELDS.forEach(model => parameters.set(model, model === values.model ? "True" : "0"));
  return `https://orfeus-eu.org/submachine/index.php?${parameters}`;
}

export function extractSubmachineImageUrl(html, resultUrl) {
  const match = html.match(/(?:href|src)=["']([^"']*generated\/[^"'?#]+\.(?:jpe?g|png))[^"']*["']/i);
  if (!match) throw new Error("SubMachine completed the request but did not return a slice image.");
  return new URL(match[1].replaceAll("&amp;", "&"), resultUrl).href;
}
