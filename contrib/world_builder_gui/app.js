import {
  FEATURE_TYPES, DEFAULT_SETTINGS, createFeature, buildWorldBuilder, buildGrid, buildVtp,
  buildLegacyVtk, buildObj, buildGeoJson, buildGeometryCsv,
  connectFeatures, validateProject, importWorldBuilder, importFeature,
  applyGridConfig, featureToWorldBuilder, geologicalLayerPreset, createPlacementPoints
} from "./core.js";
import { TOMOGRAPHY_CATALOG, searchTomographyModels, tomographyModelById } from "./tomography-catalog.mjs";
import { LITHOSPHERE_CATALOG, searchLithosphereModels, lithosphereModelById } from "./lithosphere-catalog.mjs";
import { parseLithosphereTable, regularLithosphereGrid, remapGeographicGridToCartesian } from "./lithosphere-table.mjs";
import { parseWorldBuilderText, serializeWorldBuilder } from "./wb-provenance.mjs";
import { PLANETARY_BODY_CATALOG, searchPlanetaryBodies, planetaryBodyById } from "./planetary-catalog.mjs";

const STORAGE_KEY = "gwb-visual-builder-v1";
const COLOR_MAP_VERSION = 4;
const DEFAULT_APPEARANCE = {
  theme: "dark", renderMode: "geology", shading: true, light: 65,
  autoTemperaturePreview: true, temperatureContours: true, slabProjection: true, temperatureMin: 273, temperatureMax: 1800,
  viewZoom: 1, viewRotation: 0, viewPanX: 0, viewPanY: 0
};
const DEFAULT_TOPOGRAPHY = {
  width: 48, height: 32, values: [], opacity: 70, hillshade: true,
  bounds: null, imageSrc: null, source: null, exportToFeatures: true
};
const DEFAULT_PALEOGEOGRAPHY = {
  model: "MULLER2022", age: 100, anchorPlateId: 0, visible: true,
  source: null, layers: {}
};
const DEFAULT_GRAVITY = {
  enabled: false, field: "bouguer", referenceDensity: 3300, topographyDensity: 2670,
  samplesX: 32, samplesY: 20, opacity: 55, residualBase: "bouguer",
  observations: [], result: null, signature: null
};
const DEFAULT_TOMOGRAPHY = {
  visible: true, opacity: 76, grid: null, sourceMode: null,
  scalarField: "dvs", vpVsRatio: 1.8, isoValue: 0.5, isoMode: "above",
  showIso: true, isoThicknessKm: 100
};
const DEFAULT_LITHOSPHERE = {
  visible: true, opacity: 72, grid: null, selectedModelId: null, sourceName: null
};
const DEFAULT_EXPORT_OPTIONS = { comments: true, references: true };
const COLOR_PRESETS = {
  "crameri-vik": ["#001261", "#034481", "#307da6", "#94bed2", "#ece5e0", "#dbaa8d", "#c27041", "#912d06", "#590008"],
  "crameri-oleron": ["#1a2659", "#4c598c", "#8390c3", "#bcc9f3", "#e6f2ff", "#1a4c00", "#63640a", "#aa9050", "#edc99d", "#fdfde6"],
  thermal: ["#07104d", "#225bd6", "#8a2be2", "#e43b31", "#ff9b24", "#fff36a", "#ffffff"],
  coolwarm: ["#2166ac", "#67a9cf", "#f7f7f7", "#ef8a62", "#b2182b"],
  viridis: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"],
  magma: ["#000004", "#51127c", "#b73779", "#fc8961", "#fcfdbf"],
  terrain: ["#123f78", "#2691bd", "#4f8f55", "#a8b86c", "#a97545", "#ffffff"],
  grayscale: ["#101010", "#777777", "#f7f7f7"]
};
const OLERON_TWO_SLOPE_POSITIONS = {
  ocean: [0, 2133.333333 / 8500, 4266.666667 / 8500, 6400 / 8500, 8466.666667 / 8500],
  land: [0, 1147.058824 / 4500, 2276.470588 / 4500, 3405.882353 / 4500, 1]
};
const PLANETARY_VISUALS = {
  earth: ["#eef9f7", "#477f91", "#102d3a"],
  moon: ["#f0eee7", "#9a968b", "#393936"],
  mars: ["#ffd7ad", "#b85f39", "#52251f"],
  venus: ["#fff0ba", "#c58b47", "#5b3423"],
  mercury: ["#eee9dd", "#8b8175", "#37332f"],
  io: ["#fff3a8", "#d49a32", "#5c3920"],
  europa: ["#f4f1dc", "#9f9276", "#3d3f43"],
  ganymede: ["#e2d4bd", "#817466", "#34313a"],
  titan: ["#f8dda1", "#bb7635", "#44312c"],
  enceladus: ["#f7ffff", "#a7c7d4", "#334851"],
  pluto: ["#ead9c9", "#977866", "#332b2e"]
};
const DEFAULT_COLOR_MAPS = {
  temperature: { preset: "thermal", min: 273, max: 1800, reverse: false, steps: 0, opacity: 100, colors: ["#07104d", "#e43b31", "#ffffff"] },
  gravity: { preset: "coolwarm", min: -100, max: 100, reverse: false, steps: 0, opacity: 55, colors: ["#2166ac", "#f7f7f7", "#b2182b"] },
  tomography: { preset: "crameri-vik", min: -1, max: 1, reverse: false, steps: 0, opacity: 76, colors: ["#001261", "#ece5e0", "#590008"] },
  lithosphere: { preset: "viridis", min: 0, max: 1, reverse: false, steps: 0, opacity: 72, colors: ["#440154", "#21918c", "#fde725"] },
  topography: { preset: "crameri-oleron", min: -8500, max: 4500, reverse: false, steps: 0, opacity: 70, colors: ["#1a2659", "#e6f2ff", "#fdfde6"] }
};
const DEFAULT_SCENE_LAYERS = {
  grid: true, features: true, labels: true, connections: true, slabs: true,
  topography: true, paleogeography: true, referenceMap: true, tomography: true,
  lithosphere: true, gravity: true, legend: true
};
const DEFAULT_UI = {
  paletteCollapsed: false, inspectorCollapsed: false, splitView: false,
  linkedCameras: true, secondaryView: "three-d", secondaryCamera: null,
  cameraControls: null, floatingEditors: {}, areaPlacementShape: "rectangle", linePlacementShape: "straight",
  gravityLegendPositions: { primary: null, secondary: null },
  cameraControlsExpanded: false,
  gravityWorkspaceMinimized: false, gravityWorkspaceLayout: "triple",
  gravityWorkspaceContoursOnly: false,
  gravityWorkspaceSectionPicking: false, gravityWorkspaceContourEditing: false,
  compactPanel: null
};
const primaryCanvas = document.querySelector("#model-canvas");
const primaryContext = primaryCanvas.getContext("2d");
const secondaryCanvas = document.querySelector("#secondary-canvas");
const secondaryContext = secondaryCanvas.getContext("2d");
const gravityMapCanvas = document.querySelector("#gravity-map-canvas");
const gravity3DCanvas = document.querySelector("#gravity-3d-canvas");
const gravitySectionCanvas = document.querySelector("#gravity-section-canvas");
let canvas = primaryCanvas;
let context = primaryContext;
let renderOptions = {
  featureContoursOnly: false, suppressFeatureHandles: false,
  featureVertexHandlesOnly: false, suppressGravityLegend: false
};
const wrap = document.querySelector("#canvas-wrap");
let state = loadState();
let selectedId = null;
let selectedIds = new Set();
let tool = "select";
let connectingFrom = null;
let sectionDraft = [];
let drag = null;
let outputKind = "wb";
let viewMode = "plan";
let toastTimer;
let examples = [];
let exampleQuery = "";
let exampleCategory = "all";
let drawPoints = [];
let freehandDrawing = false;
let selectedPointIndex = null;
let hoverPoint = null;
let referenceImage = null;
let tomographyRequest = null;
let lithosphereTable = null;
let topographyImage = null;
let terrainDrawing = false;
let terrainSelection = [];
let cameraPanMode = false;
let cameraDrag = null;
let marqueeSelection = null;
let cameraControlsDrag = null;
let gravityWorkspaceDrag = null;
let gravityWorkspaceGeometryDrag = null;
let gravityLegendDrag = null;
let gravityLegendBounds = { primary: null, secondary: null };
let floatingEditorDrag = null;
let floatingEditorZ = 10;
let researchTimer = null;
let activitySequence = 0;
let activityHideTimer = null;
let activeViewport = "primary";
let viewportModes = { primary: "plan", secondary: state.ui.secondaryView || "three-d" };
let viewportCameras = {
  primary: {
    zoom: Number(state.appearance.viewZoom) || 1,
    rotation: Number(state.appearance.viewRotation) || 0,
    panX: Number(state.appearance.viewPanX) || 0,
    panY: Number(state.appearance.viewPanY) || 0,
    orbitYaw: Number(state.appearance.orbitYaw ?? -25),
    orbitPitch: Number(state.appearance.orbitPitch ?? 28)
  },
  secondary: {
    zoom: Number(state.ui.secondaryCamera?.zoom) || 1,
    rotation: Number(state.ui.secondaryCamera?.rotation) || 0,
    panX: Number(state.ui.secondaryCamera?.panX) || 0,
    panY: Number(state.ui.secondaryCamera?.panY) || 0,
    orbitYaw: Number(state.ui.secondaryCamera?.orbitYaw ?? -25),
    orbitPitch: Number(state.ui.secondaryCamera?.orbitPitch ?? 28)
  }
};
let renderCamera = viewportCameras.primary;
let undoStack = [];
let redoStack = [];
let restoringHistory = false;
let lastHistorySignature = "";

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.settings && Array.isArray(saved.features)) {
      saved.settings = { ...DEFAULT_SETTINGS, ...saved.settings };
      saved.settings.coordinateSystem = saved.settings.gridType === "chunk" ? "spherical" : "cartesian";
      saved.settings.radius ||= DEFAULT_SETTINGS.radius;
      saved.appearance = { ...DEFAULT_APPEARANCE, ...(saved.appearance || {}) };
      saved.topography = { ...DEFAULT_TOPOGRAPHY, ...(saved.topography || {}) };
      saved.paleogeography = { ...DEFAULT_PALEOGEOGRAPHY, ...(saved.paleogeography || {}), layers: {} };
      saved.sceneLayers = { ...DEFAULT_SCENE_LAYERS, ...(saved.sceneLayers || {}) };
      saved.gravity = { ...DEFAULT_GRAVITY, ...(saved.gravity || {}) };
      saved.tomography = { ...DEFAULT_TOMOGRAPHY, ...(saved.tomography || {}) };
      saved.lithosphere = { ...DEFAULT_LITHOSPHERE, ...(saved.lithosphere || {}) };
      saved.provenance = {
        tomographyModelIds: Array.isArray(saved.provenance?.tomographyModelIds) ? saved.provenance.tomographyModelIds : [],
        lithosphereModelIds: Array.isArray(saved.provenance?.lithosphereModelIds) ? saved.provenance.lithosphereModelIds : []
      };
      saved.exportOptions = { ...DEFAULT_EXPORT_OPTIONS, ...(saved.exportOptions || {}) };
      const storedColorMapVersion = Number(saved.colorMapVersion || 0);
      const storedTopographyPreset = saved.colorMaps?.topography?.preset;
      saved.colorMaps = Object.fromEntries(Object.entries(DEFAULT_COLOR_MAPS).map(([key, value]) => [key, { ...value, ...(saved.colorMaps?.[key] || {}) }]));
      if (storedColorMapVersion < 2) {
        saved.colorMaps.tomography = { ...DEFAULT_COLOR_MAPS.tomography };
      }
      if (storedColorMapVersion < 3 && (!storedTopographyPreset || storedTopographyPreset === "terrain")) {
        saved.colorMaps.topography.preset = DEFAULT_COLOR_MAPS.topography.preset;
        saved.colorMaps.topography.colors = [...DEFAULT_COLOR_MAPS.topography.colors];
      }
      if (storedColorMapVersion < 4 && saved.colorMaps.topography.preset === "crameri-oleron"
        && Number(saved.colorMaps.topography.min) === -5000 && Number(saved.colorMaps.topography.max) === 5000) {
        saved.colorMaps.topography.min = DEFAULT_COLOR_MAPS.topography.min;
        saved.colorMaps.topography.max = DEFAULT_COLOR_MAPS.topography.max;
      }
      saved.colorMapVersion = COLOR_MAP_VERSION;
      saved.layerGroups = Array.isArray(saved.layerGroups) ? saved.layerGroups : [];
      saved.ui = { ...DEFAULT_UI, ...(saved.ui || {}) };
      saved.ui.gravityLegendPositions = {
        primary: saved.ui.gravityLegendPositions?.primary || null,
        secondary: saved.ui.gravityLegendPositions?.secondary || null
      };
      saved.sectionPath = Array.isArray(saved.sectionPath) ? saved.sectionPath : (saved.settings.section || []);
      return saved;
    }
  } catch {}
  return {
    settings: { ...DEFAULT_SETTINGS }, features: [], connections: [], rawWorld: null,
    appearance: { ...DEFAULT_APPEARANCE }, topography: { ...DEFAULT_TOPOGRAPHY },
    paleogeography: { ...DEFAULT_PALEOGEOGRAPHY }, sceneLayers: { ...DEFAULT_SCENE_LAYERS },
    gravity: { ...DEFAULT_GRAVITY }, tomography: { ...DEFAULT_TOMOGRAPHY }, lithosphere: { ...DEFAULT_LITHOSPHERE },
    provenance: { tomographyModelIds: [], lithosphereModelIds: [] }, exportOptions: { ...DEFAULT_EXPORT_OPTIONS },
    colorMaps: structuredClone(DEFAULT_COLOR_MAPS), colorMapVersion: COLOR_MAP_VERSION,
    layerGroups: [], ui: { ...DEFAULT_UI }, sectionPath: []
  };
}

document.body.dataset.theme = state.appearance.theme;

function sceneLayerVisible(key) {
  return state.sceneLayers?.[key] !== false;
}

function featureVisible(feature) {
  const group = state.layerGroups?.find(item => item.id === feature?.layerGroup);
  return sceneLayerVisible("features") && feature?.visible !== false && group?.visible !== false;
}

function featureSublayerVisible(feature, index) {
  return !feature?.hiddenSublayers?.includes(index);
}

function persist() {
  try {
    const persistentState = {
      ...state,
      paleogeography: state.paleogeography ? { ...state.paleogeography, layers: {} } : null
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistentState));
    document.querySelector("#save-state").textContent = "Saved locally";
  } catch {
    const safeState = {
      ...state,
      background: state.background ? { ...state.background, src: null } : null,
      topography: state.topography ? { ...state.topography, imageSrc: null } : null,
      paleogeography: state.paleogeography ? { ...state.paleogeography, layers: {} } : null
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeState));
    document.querySelector("#save-state").textContent = "Model saved · map kept this session";
  }
}

function buildProjectStateDocument() {
  return {
    format: "gwb-visual-builder-project",
    formatVersion: 1,
    savedAt: new Date().toISOString(),
    state,
    workspace: {
      selectedId,
      selectedIds: [...selectedIds],
      activeViewport,
      viewportModes,
      viewportCameras,
      outputKind
    }
  };
}

function restoreProjectStateDocument(documentState) {
  if (documentState?.format !== "gwb-visual-builder-project" || !documentState.state?.settings || !Array.isArray(documentState.state.features)) {
    throw new Error("This is not a Visual Builder project-state file.");
  }
  const restored = documentState.state;
  state = {
    ...restored,
    settings: { ...DEFAULT_SETTINGS, ...(restored.settings || {}) },
    features: restored.features,
    connections: Array.isArray(restored.connections) ? restored.connections : [],
    appearance: { ...DEFAULT_APPEARANCE, ...(restored.appearance || {}) },
    topography: { ...DEFAULT_TOPOGRAPHY, ...(restored.topography || {}) },
    paleogeography: { ...DEFAULT_PALEOGEOGRAPHY, ...(restored.paleogeography || {}) },
    sceneLayers: { ...DEFAULT_SCENE_LAYERS, ...(restored.sceneLayers || {}) },
    gravity: { ...DEFAULT_GRAVITY, ...(restored.gravity || {}) },
    tomography: { ...DEFAULT_TOMOGRAPHY, ...(restored.tomography || {}) },
    lithosphere: { ...DEFAULT_LITHOSPHERE, ...(restored.lithosphere || {}) },
    provenance: {
      tomographyModelIds: Array.isArray(restored.provenance?.tomographyModelIds) ? restored.provenance.tomographyModelIds : [],
      lithosphereModelIds: Array.isArray(restored.provenance?.lithosphereModelIds) ? restored.provenance.lithosphereModelIds : []
    },
    exportOptions: { ...DEFAULT_EXPORT_OPTIONS, ...(restored.exportOptions || {}) },
    colorMapVersion: COLOR_MAP_VERSION,
    layerGroups: Array.isArray(restored.layerGroups) ? restored.layerGroups : [],
    ui: {
      ...DEFAULT_UI,
      ...(restored.ui || {}),
      gravityLegendPositions: {
        primary: restored.ui?.gravityLegendPositions?.primary || null,
        secondary: restored.ui?.gravityLegendPositions?.secondary || null
      }
    }
  };
  const workspace = documentState.workspace || {};
  const validModes = new Set(["plan", "three-d", "section"]);
  viewportModes = {
    primary: validModes.has(workspace.viewportModes?.primary) ? workspace.viewportModes.primary : "plan",
    secondary: validModes.has(workspace.viewportModes?.secondary) ? workspace.viewportModes.secondary : state.ui.secondaryView || "three-d"
  };
  viewportCameras = {
    primary: { ...viewportCameras.primary, ...(workspace.viewportCameras?.primary || {}) },
    secondary: { ...viewportCameras.secondary, ...(workspace.viewportCameras?.secondary || {}) }
  };
  activeViewport = workspace.activeViewport === "secondary" && state.ui.splitView ? "secondary" : "primary";
  selectedId = state.features.some(feature => feature.id === workspace.selectedId)
    ? workspace.selectedId : state.features.at(-1)?.id || null;
  selectedIds = new Set((workspace.selectedIds || []).filter(id => state.features.some(feature => feature.id === id)));
  if (!selectedIds.size && selectedId) selectedIds.add(selectedId);
  outputKind = workspace.outputKind === "grid" ? "grid" : "wb";
  tool = "select";
  drawPoints = [];
  selectedPointIndex = null;
  referenceImage = null;
  topographyImage = null;
  undoStack = [];
  redoStack = [];
  lastHistorySignature = "";
  document.body.dataset.theme = state.appearance.theme;
  applyWorkspaceUI();
  syncSettingsForm();
  syncAppearanceEditor();
  syncGravityUI();
  updateTopographyUI();
  updatePaleoUI();
  updatePlacementShapeUI();
  restoreReferenceImage();
  restoreTopographyImage();
  setActiveViewport(activeViewport);
  updateViewportLabels();
  updateAll();
}

function projectSnapshot() {
  return JSON.stringify({
    settings: state.settings,
    features: state.features,
    connections: state.connections,
    rawWorld: state.rawWorld
  });
}

function updateHistoryUI() {
  const undoButton = document.querySelector("#undo-action");
  const redoButton = document.querySelector("#redo-action");
  if (!undoButton || !redoButton) return;
  undoButton.disabled = undoStack.length <= 1;
  redoButton.disabled = redoStack.length === 0;
}

function commitHistory() {
  if (restoringHistory) return;
  const snapshot = projectSnapshot();
  if (snapshot === lastHistorySignature) return;
  undoStack.push(snapshot);
  if (undoStack.length > 40) undoStack.shift();
  redoStack = [];
  lastHistorySignature = snapshot;
  updateHistoryUI();
}

function restoreProjectSnapshot(snapshot) {
  const restored = JSON.parse(snapshot);
  state.settings = restored.settings;
  state.features = restored.features;
  state.connections = restored.connections;
  state.rawWorld = restored.rawWorld;
  if (!state.features.some(feature => feature.id === selectedId)) selectedId = state.features.at(-1)?.id || null;
  selectedIds = new Set([...selectedIds].filter(id => state.features.some(feature => feature.id === id)));
  if (!selectedIds.size && selectedId) selectedIds.add(selectedId);
  restoringHistory = true;
  lastHistorySignature = snapshot;
  syncSettingsForm();
  updateAll();
  restoringHistory = false;
  updateHistoryUI();
}

function undoModelEdit() {
  if (undoStack.length <= 1) return showToast("Nothing to undo");
  redoStack.push(undoStack.pop());
  restoreProjectSnapshot(undoStack.at(-1));
  showToast("Model edit undone");
}

function redoModelEdit() {
  if (!redoStack.length) return showToast("Nothing to redo");
  const snapshot = redoStack.pop();
  undoStack.push(snapshot);
  restoreProjectSnapshot(snapshot);
  showToast("Model edit restored");
}

function restoreReferenceImage() {
  if (!state.background?.src) {
    referenceImage = null;
    return;
  }
  const image = new Image();
  image.onload = () => { referenceImage = image; syncMapEditor(); draw(); };
  image.src = state.background.src;
}

function restoreTopographyImage() {
  if (!state.topography?.imageSrc) {
    topographyImage = null;
    return;
  }
  const image = new Image();
  image.onload = () => { topographyImage = image; draw(); };
  image.src = state.topography.imageSrc;
}

function worldToCanvas([x, y]) {
  const { xMin, xMax, yMin, yMax } = state.settings;
  const pad = 42;
  return [
    pad + ((x - xMin) / (xMax - xMin)) * (canvas.clientWidth - pad * 2),
    canvas.clientHeight - pad - ((y - yMin) / (yMax - yMin)) * (canvas.clientHeight - pad * 2)
  ];
}

function canvasToWorld(x, y) {
  const { xMin, xMax, yMin, yMax } = state.settings;
  const pad = 42;
  return [
    xMin + ((x - pad) / (canvas.clientWidth - pad * 2)) * (xMax - xMin),
    yMin + ((canvas.clientHeight - pad - y) / (canvas.clientHeight - pad * 2)) * (yMax - yMin)
  ];
}

function resize() {
  const scale = window.devicePixelRatio || 1;
  [[primaryCanvas, primaryContext], [secondaryCanvas, secondaryContext]].forEach(([target, targetContext]) => {
    const rect = target.parentElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    target.width = Math.floor(rect.width * scale);
    target.height = Math.floor(rect.height * scale);
    target.style.width = `${rect.width}px`;
    target.style.height = `${rect.height}px`;
    targetContext.setTransform(scale, 0, 0, scale, 0, 0);
  });
  positionCameraControls();
  positionFloatingEditors();
  draw();
}

function positionCameraControls() {
  const controls = document.querySelector(".camera-controls");
  const position = state.ui.cameraControls;
  if (!position) {
    controls.style.removeProperty("left");
    controls.style.removeProperty("top");
    controls.style.removeProperty("transform");
    return;
  }
  const maxX = Math.max(8, wrap.clientWidth - controls.offsetWidth - 8);
  const maxY = Math.max(8, wrap.clientHeight - controls.offsetHeight - 8);
  controls.style.left = `${Math.max(8, Math.min(maxX, Number(position.x) * maxX))}px`;
  controls.style.top = `${Math.max(8, Math.min(maxY, Number(position.y) * maxY))}px`;
  controls.style.transform = "none";
}

function positionFloatingEditor(editor) {
  if (!editor || editor.classList.contains("hidden")) return;
  const position = state.ui.floatingEditors?.[editor.id];
  if (!position) {
    editor.style.removeProperty("left");
    editor.style.removeProperty("top");
    editor.style.removeProperty("right");
    return;
  }
  const maxX = Math.max(8, wrap.clientWidth - editor.offsetWidth - 8);
  const maxY = Math.max(8, wrap.clientHeight - editor.offsetHeight - 8);
  editor.style.left = `${Math.max(8, Math.min(maxX, Number(position.x) * maxX))}px`;
  editor.style.top = `${Math.max(8, Math.min(maxY, Number(position.y) * maxY))}px`;
  editor.style.right = "auto";
}

function positionFloatingEditors() {
  document.querySelectorAll(".shape-editor, .map-editor").forEach(positionFloatingEditor);
}

function bindFloatingEditor(editor) {
  const handle = editor.querySelector(".shape-editor-header");
  if (!handle) return;
  handle.title = "Drag to move · double-click to reset position";
  handle.addEventListener("pointerdown", event => {
    if (event.target.closest("button, input, select, a")) return;
    event.preventDefault();
    const rect = editor.getBoundingClientRect();
    floatingEditorZ += 1;
    editor.style.zIndex = String(floatingEditorZ);
    floatingEditorDrag = {
      editor, handle, pointerId: event.pointerId,
      offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top
    };
    handle.setPointerCapture(event.pointerId);
    handle.classList.add("dragging");
  });
  handle.addEventListener("pointermove", event => {
    if (!floatingEditorDrag || floatingEditorDrag.pointerId !== event.pointerId || floatingEditorDrag.editor !== editor) return;
    const wrapRect = wrap.getBoundingClientRect();
    const maxX = Math.max(8, wrap.clientWidth - editor.offsetWidth - 8);
    const maxY = Math.max(8, wrap.clientHeight - editor.offsetHeight - 8);
    const left = Math.max(8, Math.min(maxX, event.clientX - wrapRect.left - floatingEditorDrag.offsetX));
    const top = Math.max(8, Math.min(maxY, event.clientY - wrapRect.top - floatingEditorDrag.offsetY));
    editor.style.left = `${left}px`;
    editor.style.top = `${top}px`;
    editor.style.right = "auto";
    state.ui.floatingEditors ||= {};
    state.ui.floatingEditors[editor.id] = { x: left / maxX, y: top / maxY };
  });
  const finishDrag = event => {
    if (!floatingEditorDrag || floatingEditorDrag.pointerId !== event.pointerId || floatingEditorDrag.editor !== editor) return;
    floatingEditorDrag = null;
    handle.classList.remove("dragging");
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    persist();
  };
  handle.addEventListener("pointerup", finishDrag);
  handle.addEventListener("pointercancel", finishDrag);
  handle.addEventListener("dblclick", event => {
    if (event.target.closest("button")) return;
    event.preventDefault();
    if (state.ui.floatingEditors) delete state.ui.floatingEditors[editor.id];
    positionFloatingEditor(editor);
    persist();
    showToast(`${editor.getAttribute("aria-label") || "Window"} returned to its default position`);
  });
  new MutationObserver(() => {
    if (!editor.classList.contains("hidden")) requestAnimationFrame(() => positionFloatingEditor(editor));
  }).observe(editor, { attributes: true, attributeFilter: ["class"] });
}

function screenPointToCanvas(screenX, screenY) {
  const centerX = canvas.clientWidth / 2; const centerY = canvas.clientHeight / 2;
  const zoom = Number(renderCamera.zoom) || 1;
  const angle = -Number(renderCamera.rotation || 0) * Math.PI / 180;
  const panX = Number(renderCamera.panX) || 0;
  const panY = Number(renderCamera.panY) || 0;
  const dx = (screenX - centerX - panX) / zoom; const dy = (screenY - centerY - panY) / zoom;
  return [
    centerX + dx * Math.cos(angle) - dy * Math.sin(angle),
    centerY + dx * Math.sin(angle) + dy * Math.cos(angle)
  ];
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return screenPointToCanvas(event.clientX - rect.left, event.clientY - rect.top);
}

function rawCanvasPoint(target, event) {
  const rect = target.getBoundingClientRect();
  return [event.clientX - rect.left, event.clientY - rect.top];
}

function applyWorkspaceUI() {
  state.ui = { ...DEFAULT_UI, ...(state.ui || {}) };
  const workspace = document.querySelector(".workspace");
  const compact = window.matchMedia("(max-width: 700px)").matches;
  document.body.classList.toggle("compact-workspace", compact);
  const paletteCollapsed = compact ? state.ui.compactPanel !== "palette" : state.ui.paletteCollapsed;
  const inspectorCollapsed = compact ? state.ui.compactPanel !== "inspector" : state.ui.inspectorCollapsed;
  workspace.classList.toggle("palette-collapsed", paletteCollapsed);
  workspace.classList.toggle("inspector-collapsed", inspectorCollapsed);
  const paletteButton = document.querySelector("#toggle-palette-panel");
  const inspectorButton = document.querySelector("#toggle-inspector-panel");
  paletteButton.classList.toggle("active", !paletteCollapsed);
  inspectorButton.classList.toggle("active", !inspectorCollapsed);
  paletteButton.setAttribute("aria-pressed", String(!paletteCollapsed));
  inspectorButton.setAttribute("aria-pressed", String(!inspectorCollapsed));
  wrap.classList.toggle("split-view", state.ui.splitView);
  document.querySelector("#toggle-split-view").classList.toggle("active", state.ui.splitView);
  document.querySelector("#toggle-split-view").setAttribute("aria-pressed", String(state.ui.splitView));
  document.querySelector("#link-cameras").classList.toggle("hidden", !state.ui.splitView);
  document.querySelector("#link-cameras").classList.toggle("active", state.ui.linkedCameras);
  document.querySelector("#link-cameras").setAttribute("aria-pressed", String(state.ui.linkedCameras));
  syncCameraControlsExpansion();
  requestAnimationFrame(resize);
}

function setActiveViewport(name) {
  if (name === "secondary" && !state.ui.splitView) name = "primary";
  activeViewport = name;
  canvas = name === "primary" ? primaryCanvas : secondaryCanvas;
  context = name === "primary" ? primaryContext : secondaryContext;
  viewMode = viewportModes[name];
  renderCamera = viewportCameras[name];
  document.querySelectorAll(".viewport-pane").forEach(pane => pane.classList.toggle("active", pane.dataset.viewport === name));
  document.querySelectorAll("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === viewMode));
  updateCameraUI();
}

function updateViewportLabels() {
  const labels = { plan: "Plan", "three-d": "3D", section: "Depth" };
  document.querySelector('[data-activate-viewport="primary"]').textContent = `A · ${labels[viewportModes.primary]}`;
  document.querySelector('[data-activate-viewport="secondary"]').textContent = `B · ${labels[viewportModes.secondary]}`;
}

function applyViewTransform() {
  const centerX = canvas.clientWidth / 2; const centerY = canvas.clientHeight / 2;
  context.translate(Number(renderCamera.panX) || 0, Number(renderCamera.panY) || 0);
  context.translate(centerX, centerY);
  context.rotate(Number(renderCamera.rotation || 0) * Math.PI / 180);
  context.scale(Number(renderCamera.zoom) || 1, Number(renderCamera.zoom) || 1);
  context.translate(-centerX, -centerY);
}

function updateCameraUI() {
  const camera = viewportCameras[activeViewport];
  const zoomText = `${Math.round((Number(camera.zoom) || 1) * 100)}%`;
  document.querySelector("#zoom-level").textContent = zoomText;
  document.querySelector("#camera-zoom-compact").textContent = zoomText;
  document.querySelector("#pan-camera").classList.toggle("active", cameraPanMode);
  document.querySelector("#pan-camera").setAttribute("aria-pressed", String(cameraPanMode));
}

function syncCameraControlsExpansion() {
  const controls = document.querySelector(".camera-controls");
  const toggle = document.querySelector("#toggle-camera-controls");
  if (!controls || !toggle) return;
  const expanded = Boolean(state.ui?.cameraControlsExpanded);
  controls.classList.toggle("collapsed", !expanded);
  toggle.setAttribute("aria-expanded", String(expanded));
  toggle.setAttribute("aria-label", expanded ? "Close camera controls" : "Open camera controls");
  toggle.title = expanded ? "Close camera controls" : "Open camera controls";
  document.querySelector("#camera-toggle-icon").textContent = expanded ? "⌃" : "⌖";
}

function changeCamera({ zoomFactor = 1, rotationDelta = 0, orbitYawDelta = 0, orbitPitchDelta = 0, panX = 0, panY = 0, reset = false }) {
  const targets = state.ui.splitView && state.ui.linkedCameras ? ["primary", "secondary"] : [activeViewport];
  targets.forEach(name => {
    const camera = viewportCameras[name];
    if (reset) Object.assign(camera, { zoom: 1, rotation: 0, panX: 0, panY: 0, orbitYaw: -25, orbitPitch: 28 });
    else {
      camera.zoom = Math.max(.35, Math.min(4, Number(camera.zoom || 1) * zoomFactor));
      camera.rotation = ((Number(camera.rotation || 0) + rotationDelta + 180) % 360) - 180;
      camera.orbitYaw = ((Number(camera.orbitYaw ?? -25) + orbitYawDelta + 180) % 360) - 180;
      camera.orbitPitch = Math.max(5, Math.min(82, Number(camera.orbitPitch ?? 28) + orbitPitchDelta));
      camera.panX = Number(camera.panX || 0) + panX;
      camera.panY = Number(camera.panY || 0) + panY;
    }
  });
  Object.assign(state.appearance, {
    viewZoom: viewportCameras.primary.zoom,
    viewRotation: viewportCameras.primary.rotation,
    viewPanX: viewportCameras.primary.panX,
    viewPanY: viewportCameras.primary.panY,
    orbitYaw: viewportCameras.primary.orbitYaw,
    orbitPitch: viewportCameras.primary.orbitPitch
  });
  state.ui.secondaryCamera = { ...viewportCameras.secondary };
  renderCamera = viewportCameras[activeViewport];
  updateCameraUI();
  persist();
  draw();
}

function setCameraPanMode(enabled) {
  cameraPanMode = enabled;
  cameraDrag = null;
  canvas.style.cursor = enabled ? "grab" : viewMode === "three-d" ? "grab" : (viewMode === "plan" && tool === "connect" ? "crosshair" : "default");
  updateCameraUI();
}

function canvasPalette() {
  return state.appearance.theme === "light"
    ? { background: "#f4f7f7", grid: "#d8e0e2", border: "#91a2a8", muted: "#62757c", text: "#172126", plane: "#e5ebed", deep: "#dbe4e6" }
    : { background: "#0b1115", grid: "#1d2a30", border: "#405057", muted: "#6f8188", text: "#edf3f0", plane: "#101c21", deep: "#091014" };
}

function ensureColorMaps() {
  state.colorMaps ||= {};
  Object.entries(DEFAULT_COLOR_MAPS).forEach(([field, defaults]) => {
    state.colorMaps[field] = { ...defaults, ...(state.colorMaps[field] || {}) };
  });
  return state.colorMaps;
}

function hexToRgb(hex) {
  const value = String(hex).replace("#", "");
  const expanded = value.length === 3 ? value.split("").map(character => character + character).join("") : value;
  const number = Number.parseInt(expanded, 16);
  return [number >> 16 & 255, number >> 8 & 255, number & 255];
}

function colorMapStops(field) {
  const map = ensureColorMaps()[field];
  const colors = map.preset === "custom" ? map.colors : (COLOR_PRESETS[map.preset] || COLOR_PRESETS.viridis);
  return map.reverse ? [...colors].reverse() : colors;
}

function colorMapPositions(field) {
  const map = ensureColorMaps()[field];
  const colors = colorMapStops(field);
  const minimum = Number(map.min);
  const maximum = Number(map.max);
  let positions;
  if (map.preset === "crameri-oleron" && minimum < 0 && maximum > 0 && colors.length === 10) {
    const seaLevel = -minimum / (maximum - minimum);
    positions = [
      ...OLERON_TWO_SLOPE_POSITIONS.ocean.map(position => position * seaLevel),
      ...OLERON_TWO_SLOPE_POSITIONS.land.map(position => seaLevel + position * (1 - seaLevel))
    ];
  } else {
    positions = colors.map((_, index) => index / Math.max(1, colors.length - 1));
  }
  return map.reverse ? positions.map(position => 1 - position).reverse() : positions;
}

function scalarRgb(field, value, fallbackMinimum, fallbackMaximum) {
  const map = ensureColorMaps()[field];
  const minimum = Number.isFinite(Number(map.min)) ? Number(map.min) : fallbackMinimum;
  const maximum = Math.max(minimum + 1e-12, Number.isFinite(Number(map.max)) ? Number(map.max) : fallbackMaximum);
  let t = Math.max(0, Math.min(1, (Number(value) - minimum) / (maximum - minimum)));
  const steps = Number(map.steps) || 0;
  if (steps >= 2) t = Math.round(t * (steps - 1)) / (steps - 1);
  const colors = colorMapStops(field).map(hexToRgb);
  const positions = colorMapPositions(field);
  let upperIndex = positions.findIndex(position => position >= t);
  if (upperIndex < 0) upperIndex = colors.length - 1;
  const lowerIndex = Math.max(0, upperIndex - 1);
  const span = Math.max(1e-12, positions[upperIndex] - positions[lowerIndex]);
  const amount = upperIndex === lowerIndex ? 0 : (t - positions[lowerIndex]) / span;
  return colors[lowerIndex].map((channel, index) => Math.round(channel + (colors[upperIndex][index] - channel) * amount));
}

function temperatureRgb(temperature) {
  const min = Number(state.appearance.temperatureMin);
  const max = Math.max(min + 1, Number(state.appearance.temperatureMax));
  return scalarRgb("temperature", temperature, min, max);
}

function temperatureColor(temperature, alpha = 1) {
  const opacity = Number(ensureColorMaps().temperature.opacity ?? 100) / 100;
  return `rgba(${temperatureRgb(temperature).join(",")},${alpha * opacity})`;
}

function viewportFeatureLabel(feature, extra = "") {
  let name = feature.name;
  if (canvas.clientWidth < 520 && name.length > 14) name = `${name.slice(0, 13)}…`;
  const temperature = state.appearance.renderMode === "temperature" ? ` · ${Math.round(featureTemperature(feature))}K` : "";
  return `${name}${extra}${temperature}`;
}

function featureTemperature(feature) {
  if (!feature.layers?.length) return Number(feature.temperature);
  let totalWeight = 0; let total = 0;
  feature.layers.forEach(layer => {
    const weight = Math.max(1, Number(layer.maxDepth) - Number(layer.minDepth));
    total += Number(layer.temperature) * weight;
    totalWeight += weight;
  });
  return total / totalWeight;
}

function featureFill(feature, points, alpha = .34) {
  if (renderOptions.featureContoursOnly) return "rgba(0,0,0,0)";
  const meta = FEATURE_TYPES[feature.model];
  const temperature = featureTemperature(feature);
  const base = state.appearance.renderMode === "temperature" ? temperatureColor(temperature, alpha) : `${meta.color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
  if (!state.appearance.shading || points.length < 2) return base;
  const xs = points.map(point => point[0]); const ys = points.map(point => point[1]);
  const minX = Math.min(...xs); const minY = Math.min(...ys);
  const maxX = Math.max(...xs); const maxY = Math.max(...ys);
  const gradient = context.createLinearGradient(minX, minY, maxX, maxY);
  const strength = Number(state.appearance.light) / 100;
  if (state.appearance.renderMode === "temperature") {
    gradient.addColorStop(0, temperatureColor(temperature + 180 * strength, Math.min(1, alpha + .25)));
    gradient.addColorStop(.48, temperatureColor(temperature, alpha));
    gradient.addColorStop(1, temperatureColor(temperature - 170 * strength, Math.min(1, alpha + .12)));
  } else {
    gradient.addColorStop(0, `${meta.color}${Math.round(Math.min(1, alpha + .3 * strength) * 255).toString(16).padStart(2, "0")}`);
    gradient.addColorStop(.55, base);
    gradient.addColorStop(1, "#05090c99");
  }
  return gradient;
}

function drawTemperatureLegend(width, height) {
  if (!sceneLayerVisible("legend") || state.appearance.renderMode !== "temperature") return;
  const x = Math.max(64, width - 220); const y = height - 44; const legendWidth = 180;
  const gradient = context.createLinearGradient(x, 0, x + legendWidth, 0);
  [[0, 273], [.2, 550], [.4, 850], [.6, 1150], [.78, 1450], [.92, 1700], [1, 1800]].forEach(([stop]) => {
    const value = Number(state.appearance.temperatureMin) + stop * (Number(state.appearance.temperatureMax) - Number(state.appearance.temperatureMin));
    gradient.addColorStop(stop, temperatureColor(value));
  });
  context.save();
  context.fillStyle = "rgba(5,10,13,.72)"; context.fillRect(x - 10, y - 19, legendWidth + 20, 39);
  context.fillStyle = gradient; context.fillRect(x, y, legendWidth, 8);
  context.strokeStyle = "#96a7ad"; context.strokeRect(x, y, legendWidth, 8);
  context.fillStyle = "#edf3f0"; context.font = "9px ui-monospace";
  context.fillText(`${state.appearance.temperatureMin} K`, x, y - 5);
  const hot = `${state.appearance.temperatureMax} K`;
  context.fillText(hot, x + legendWidth - context.measureText(hot).width, y - 5);
  context.restore();
}

function formatElevation(value) {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(Math.abs(value) >= 10000 ? 0 : 1)} km`;
  return `${Math.round(value)} m`;
}

function drawTopographyLegend(width, height) {
  if (!sceneLayerVisible("legend") || !sceneLayerVisible("topography") || state.settings.topographyMode !== "terrain" || viewMode === "section") return;
  if (viewMode === "three-d" && state.settings.coordinateSystem === "spherical") return;
  const topography = state.topography;
  if (!topography?.values?.length || topography.values.length !== topography.width * topography.height) return;
  const minimum = Math.min(...topography.values);
  const maximum = Math.max(...topography.values);
  const legendWidth = Math.min(180, width - 40);
  const x = 20;
  const temperatureVisible = state.appearance.renderMode === "temperature";
  const y = height - (temperatureVisible ? 92 : 44);
  const gradient = context.createLinearGradient(x, 0, x + legendWidth, 0);
  for (let step = 0; step <= 10; step++) {
    const fraction = step / 10;
    gradient.addColorStop(fraction, elevationColor(minimum + fraction * (maximum - minimum), minimum, maximum));
  }
  context.save();
  context.fillStyle = "rgba(5,10,13,.74)";
  context.fillRect(x - 10, y - 23, legendWidth + 20, 47);
  context.fillStyle = "#edf3f0"; context.font = "700 8px ui-monospace";
  context.fillText("ELEVATION", x, y - 11);
  context.fillStyle = gradient; context.fillRect(x, y, legendWidth, 9);
  context.strokeStyle = "#96a7ad"; context.strokeRect(x, y, legendWidth, 9);
  context.font = "9px ui-monospace";
  context.fillStyle = "#edf3f0";
  context.fillText(formatElevation(minimum), x, y + 20);
  const maximumLabel = formatElevation(maximum);
  context.fillText(maximumLabel, x + legendWidth - context.measureText(maximumLabel).width, y + 20);
  if (minimum < 0 && maximum > 0) {
    const seaX = x + (-minimum / (maximum - minimum)) * legendWidth;
    context.strokeStyle = "#f5f7f5"; context.beginPath(); context.moveTo(seaX, y - 2); context.lineTo(seaX, y + 12); context.stroke();
    const seaLabel = "0 m";
    context.fillText(seaLabel, Math.max(x, Math.min(x + legendWidth - context.measureText(seaLabel).width, seaX - context.measureText(seaLabel).width / 2)), y - 2);
  }
  context.restore();
}

function terrainBounds() {
  return state.topography?.bounds || {
    west: Number(state.settings.xMin), east: Number(state.settings.xMax),
    south: Number(state.settings.yMin), north: Number(state.settings.yMax)
  };
}

function geographicSourceBounds() {
  if (state.settings.coordinateSystem === "spherical") {
    return {
      west: Number(state.settings.xMin), east: Number(state.settings.xMax),
      south: Number(state.settings.yMin), north: Number(state.settings.yMax)
    };
  }
  const bounds = {
    west: Number(state.settings.geographicSourceWest ?? -20),
    east: Number(state.settings.geographicSourceEast ?? 20),
    south: Number(state.settings.geographicSourceSouth ?? -15),
    north: Number(state.settings.geographicSourceNorth ?? 15)
  };
  if (!(bounds.west < bounds.east && bounds.south < bounds.north)) {
    throw new Error("Geographic source bounds must have west < east and south < north.");
  }
  return bounds;
}

function cartesianModelBounds() {
  return {
    west: Number(state.settings.xMin), east: Number(state.settings.xMax),
    south: Number(state.settings.yMin), north: Number(state.settings.yMax)
  };
}

function syncGeographicBoundsUI() {
  const values = {
    west: state.settings.geographicSourceWest ?? -20,
    east: state.settings.geographicSourceEast ?? 20,
    south: state.settings.geographicSourceSouth ?? -15,
    north: state.settings.geographicSourceNorth ?? 15
  };
  document.querySelectorAll("[data-geographic-bound]").forEach(input => {
    input.value = values[input.dataset.geographicBound];
  });
  document.querySelectorAll("[data-cartesian-mapping-note]").forEach(note => {
    note.classList.toggle("hidden", state.settings.coordinateSystem === "spherical");
  });
}

function ensureTopography() {
  state.topography = { ...DEFAULT_TOPOGRAPHY, ...(state.topography || {}) };
  const size = state.topography.width * state.topography.height;
  if (state.topography.values.length !== size) state.topography.values = Array(size).fill(0);
  state.topography.bounds ||= terrainBounds();
  return state.topography;
}

function terrainIndex(column, row, topography = state.topography) {
  return Math.max(0, Math.min(topography.height - 1, row)) * topography.width
    + Math.max(0, Math.min(topography.width - 1, column));
}

function pointInPolygon([x, y], polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [xi, yi] = polygon[index]; const [xj, yj] = polygon[previous];
    const crosses = ((yi > y) !== (yj > y))
      && x < (xj - xi) * (y - yi) / (yj - yi || 1e-20) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function sampleTopographyValue([x, y], topography = state.topography) {
  const bounds = terrainBounds();
  const column = Math.max(0, Math.min(topography.width - 1,
    (x - bounds.west) / Math.max(1e-20, bounds.east - bounds.west) * (topography.width - 1)));
  const row = Math.max(0, Math.min(topography.height - 1,
    (bounds.north - y) / Math.max(1e-20, bounds.north - bounds.south) * (topography.height - 1)));
  const c0 = Math.floor(column); const c1 = Math.min(topography.width - 1, c0 + 1);
  const r0 = Math.floor(row); const r1 = Math.min(topography.height - 1, r0 + 1);
  const tx = column - c0; const ty = row - r0;
  const top = topography.values[terrainIndex(c0, r0, topography)] * (1 - tx)
    + topography.values[terrainIndex(c1, r0, topography)] * tx;
  const bottom = topography.values[terrainIndex(c0, r1, topography)] * (1 - tx)
    + topography.values[terrainIndex(c1, r1, topography)] * tx;
  return top * (1 - ty) + bottom * ty;
}

function ensureGravity() {
  state.gravity = { ...DEFAULT_GRAVITY, ...(state.gravity || {}) };
  state.gravity.observations = Array.isArray(state.gravity.observations) ? state.gravity.observations : [];
  return state.gravity;
}

function gravityFeatureContains(feature, point) {
  const geometry = FEATURE_TYPES[feature.model].geometry;
  if (geometry === "area") return pointInPolygon(point, feature.points);
  if (geometry === "point") {
    const radius = Math.max(1, Number(feature.semiMajorAxis) || 70000);
    return Math.hypot(point[0] - feature.points[0][0], point[1] - feature.points[0][1]) <= radius;
  }
  const domainWidth = Math.abs(Number(state.settings.xMax) - Number(state.settings.xMin));
  const physicalWidth = Math.max(
    state.settings.coordinateSystem === "spherical" ? domainWidth * 111320 * .012 : domainWidth * .012,
    Number(feature.thickness || 0) * .25
  );
  const width = state.settings.coordinateSystem === "spherical" ? physicalWidth / 111320 : physicalWidth;
  return feature.points.slice(0, -1).some((start, index) => distanceToSegment(point, start, feature.points[index + 1]).distance <= width);
}

function integratedDensityContrast(feature, referenceDensity) {
  const layers = feature.layers || [];
  if (layers.length) {
    return layers.reduce((sum, layer) => {
      const density = Number(layer.density || feature.referenceDensity || referenceDensity);
      return sum + (density - referenceDensity) * Math.max(0, Number(layer.maxDepth) - Number(layer.minDepth));
    }, 0);
  }
  const thickness = feature.model === "subducting plate" || feature.model === "fault"
    ? Number(feature.thickness)
    : Math.max(0, Number(feature.maxDepth) - Number(feature.minDepth));
  return (Number(feature.referenceDensity || referenceDensity) - referenceDensity) * thickness;
}

function nearestObservedGravity(point, observations) {
  let nearest = null;
  observations.forEach(observation => {
    const distance = Math.hypot(point[0] - observation.x, point[1] - observation.y);
    if (!nearest || distance < nearest.distance) nearest = { distance, value: observation.value };
  });
  return nearest?.value ?? null;
}

function gravitySignature(gravity) {
  return JSON.stringify({
    bounds: [state.settings.xMin, state.settings.xMax, state.settings.yMin, state.settings.yMax],
    features: state.features.map(feature => ({
      model: feature.model, points: feature.points, minDepth: feature.minDepth, maxDepth: feature.maxDepth,
      thickness: feature.thickness, semiMajorAxis: feature.semiMajorAxis, referenceDensity: feature.referenceDensity,
      layers: feature.layers
    })),
    topography: state.topography?.values,
    topographyBounds: state.topography?.bounds,
    config: {
      field: gravity.field, referenceDensity: gravity.referenceDensity, topographyDensity: gravity.topographyDensity,
      samplesX: gravity.samplesX, samplesY: gravity.samplesY, residualBase: gravity.residualBase,
      observations: gravity.observations
    }
  });
}

function gravityDeltaMeters(dx, dy) {
  if (state.settings.coordinateSystem !== "spherical") return [dx, dy];
  const latitude = (Number(state.settings.yMin) + Number(state.settings.yMax)) / 2 * Math.PI / 180;
  return [dx * 111320 * Math.max(.1, Math.cos(latitude)), dy * 111320];
}

function buildGravityVoxelSources(gravity, nx, ny) {
  const sx = Math.max(8, Math.min(28, Math.ceil(nx * .6)));
  const sy = Math.max(6, Math.min(20, Math.ceil(ny * .6)));
  const stepX = (Number(state.settings.xMax) - Number(state.settings.xMin)) / sx;
  const stepY = (Number(state.settings.yMax) - Number(state.settings.yMin)) / sy;
  const [stepXMeters, stepYMeters] = gravityDeltaMeters(stepX, stepY);
  const cellArea = Math.abs(stepXMeters * stepYMeters);
  const sources = [];
  for (let row = 0; row < sy; row++) {
    const y = Number(state.settings.yMin) + (row + .5) * stepY;
    for (let column = 0; column < sx; column++) {
      const x = Number(state.settings.xMin) + (column + .5) * stepX;
      state.features.forEach(feature => {
        if (!gravityFeatureContains(feature, [x, y])) return;
        const layerOffset = feature.model === "subducting plate" || feature.model === "fault" ? Number(feature.minDepth) || 0 : 0;
        const ranges = feature.layers?.length ? feature.layers.map(layer => ({
          top: layerOffset + Number(layer.minDepth), bottom: layerOffset + Number(layer.maxDepth),
          density: Number(layer.density || feature.referenceDensity || gravity.referenceDensity)
        })) : [{
          top: Number(feature.minDepth) || 0,
          bottom: feature.model === "subducting plate" || feature.model === "fault"
            ? (Number(feature.minDepth) || 0) + Number(feature.thickness)
            : Number(feature.maxDepth),
          density: Number(feature.referenceDensity || gravity.referenceDensity)
        }];
        ranges.forEach(range => {
          const thickness = Math.max(0, range.bottom - range.top);
          const contrast = range.density - Number(gravity.referenceDensity);
          if (!thickness || Math.abs(contrast) < 1e-9) return;
          sources.push({
            x, y, depth: (range.top + range.bottom) / 2,
            massContrast: contrast * cellArea * thickness
          });
        });
      });
    }
  }
  return sources;
}

function gravityTensorAt(point, elevation, sources) {
  const gravitationalConstant = 6.67430e-11;
  const tensor = { gxx: 0, gxy: 0, gxz: 0, gyy: 0, gyz: 0, gzz: 0 };
  sources.forEach(source => {
    const [dx, dy] = gravityDeltaMeters(point[0] - source.x, point[1] - source.y);
    const dz = elevation + source.depth;
    const radiusSquared = Math.max(1, dx * dx + dy * dy + dz * dz);
    const inverseR3 = 1 / Math.pow(radiusSquared, 1.5);
    const inverseR5 = 1 / Math.pow(radiusSquared, 2.5);
    const factor = gravitationalConstant * source.massContrast * 1e9;
    tensor.gxx += factor * (3 * dx * dx * inverseR5 - inverseR3);
    tensor.gxy += factor * (3 * dx * dy * inverseR5);
    tensor.gxz += factor * (3 * dx * dz * inverseR5);
    tensor.gyy += factor * (3 * dy * dy * inverseR5 - inverseR3);
    tensor.gyz += factor * (3 * dy * dz * inverseR5);
    tensor.gzz += factor * (3 * dz * dz * inverseR5 - inverseR3);
  });
  return tensor;
}

function computeGravityPreview(force = false) {
  const gravity = ensureGravity();
  const signature = gravitySignature(gravity);
  if (!force && gravity.signature === signature && gravity.result) return gravity.result;
  const nx = Math.max(8, Math.min(96, Number(gravity.samplesX) || 32));
  const ny = Math.max(6, Math.min(72, Number(gravity.samplesY) || 20));
  const referenceDensity = Number(gravity.referenceDensity) || 3300;
  const gravitationalConstant = 6.67430e-11;
  const tensorField = ["gxx", "gxy", "gxz", "gyy", "gyz", "gzz"].includes(gravity.field);
  const voxelSources = tensorField ? buildGravityVoxelSources(gravity, nx, ny) : [];
  const values = [];
  for (let row = 0; row < ny; row++) {
    const y = Number(state.settings.yMax) - (row + .5) / ny * (Number(state.settings.yMax) - Number(state.settings.yMin));
    for (let column = 0; column < nx; column++) {
      const x = Number(state.settings.xMin) + (column + .5) / nx * (Number(state.settings.xMax) - Number(state.settings.xMin));
      const point = [x, y];
      const integratedContrast = state.features.reduce((sum, feature) =>
        gravityFeatureContains(feature, point) ? sum + integratedDensityContrast(feature, referenceDensity) : sum, 0);
      const bouguer = 2 * Math.PI * gravitationalConstant * integratedContrast * 1e5;
      const hasTopography = state.topography?.values?.length === state.topography?.width * state.topography?.height;
      const elevation = hasTopography ? sampleTopographyValue(point) : 0;
      const simpleBouguerCorrection = 2 * Math.PI * gravitationalConstant * Number(gravity.topographyDensity) * elevation * 1e5;
      const freeAir = bouguer + simpleBouguerCorrection;
      const model = gravity.residualBase === "free-air" ? freeAir : bouguer;
      const observed = nearestObservedGravity(point, gravity.observations);
      const tensor = tensorField ? gravityTensorAt(point, elevation, voxelSources) : null;
      values.push(tensorField ? tensor[gravity.field]
        : gravity.field === "free-air" ? freeAir
          : gravity.field === "residual" ? (observed == null ? NaN : observed - model) : bouguer);
    }
  }
  const finite = values.filter(Number.isFinite);
  gravity.result = {
    nx, ny, values,
    min: finite.length ? Math.min(...finite) : 0,
    max: finite.length ? Math.max(...finite) : 0,
    unit: tensorField ? "E" : "mGal",
    sourceCount: voxelSources.length,
    computedAt: new Date().toISOString()
  };
  gravity.signature = signature;
  syncGravityUI();
  return gravity.result;
}

function gravityColor(value, limit, alpha = 1) {
  if (!Number.isFinite(value)) return `rgba(90,100,105,${alpha * .28})`;
  const rgb = scalarRgb("gravity", value, -limit, limit);
  return `rgba(${rgb.join(",")},${alpha})`;
}

function gravityScaleLimit(result) {
  const magnitude = Math.max(Math.abs(Number(result?.min) || 0), Math.abs(Number(result?.max) || 0));
  return magnitude > 0 ? magnitude : 1;
}

function gravityFieldLabel(field) {
  return {
    bouguer: "Bouguer anomaly",
    "free-air": "Free-air anomaly",
    residual: "Residual gravity",
    gxx: "Gravity gradient Gxx",
    gxy: "Gravity gradient Gxy",
    gxz: "Gravity gradient Gxz",
    gyy: "Gravity gradient Gyy",
    gyz: "Gravity gradient Gyz",
    gzz: "Gravity gradient Gzz"
  }[field] || String(field).toUpperCase();
}

function formatGravityScaleValue(value, unit) {
  const absolute = Math.abs(value);
  const digits = absolute >= 100 ? 0 : absolute >= 10 ? 1 : absolute >= 1 ? 2 : 3;
  const number = value.toFixed(digits);
  return `${value > 0 ? "+" : ""}${number}${unit ? ` ${unit}` : ""}`;
}

function drawGravityOverlay() {
  const gravity = ensureGravity();
  if (!gravity.enabled || !sceneLayerVisible("gravity")) return;
  const result = computeGravityPreview();
  const limit = gravityScaleLimit(result);
  const xStep = (Number(state.settings.xMax) - Number(state.settings.xMin)) / result.nx;
  const yStep = (Number(state.settings.yMax) - Number(state.settings.yMin)) / result.ny;
  context.save();
  result.values.forEach((value, index) => {
    const row = Math.floor(index / result.nx); const column = index % result.nx;
    const topLeft = worldToCanvas([
      Number(state.settings.xMin) + column * xStep,
      Number(state.settings.yMax) - row * yStep
    ]);
    const bottomRight = worldToCanvas([
      Number(state.settings.xMin) + (column + 1) * xStep,
      Number(state.settings.yMax) - (row + 1) * yStep
    ]);
    context.fillStyle = gravityColor(value, limit, Number(gravity.opacity) / 100);
    context.fillRect(topLeft[0], topLeft[1], bottomRight[0] - topLeft[0] + 1, bottomRight[1] - topLeft[1] + 1);
  });
  context.restore();
}

function drawGravity3DOverlay() {
  const gravity = ensureGravity();
  if (!gravity.enabled || !sceneLayerVisible("gravity")) return;
  const result = computeGravityPreview();
  const limit = gravityScaleLimit(result);
  const xStep = (Number(state.settings.xMax) - Number(state.settings.xMin)) / result.nx;
  const yStep = (Number(state.settings.yMax) - Number(state.settings.yMin)) / result.ny;
  context.save();
  result.values.forEach((value, index) => {
    const row = Math.floor(index / result.nx); const column = index % result.nx;
    const west = Number(state.settings.xMin) + column * xStep;
    const east = west + xStep;
    const north = Number(state.settings.yMax) - row * yStep;
    const south = north - yStep;
    const corners = [[west, north], [east, north], [east, south], [west, south]].map(point => project3D(point, -400));
    context.fillStyle = gravityColor(value, limit, Math.max(.28, Number(gravity.opacity) / 100));
    context.beginPath(); context.moveTo(...corners[0]); corners.slice(1).forEach(point => context.lineTo(...point)); context.closePath(); context.fill();
  });
  context.restore();
}

function drawGravityLegend(width) {
  if (renderOptions.suppressGravityLegend) return;
  const gravity = ensureGravity();
  const viewportName = canvas === secondaryCanvas ? "secondary" : "primary";
  if (!gravity.enabled || !sceneLayerVisible("gravity") || !sceneLayerVisible("legend")) {
    gravityLegendBounds[viewportName] = null;
    return;
  }
  const result = computeGravityPreview();
  const limit = gravityScaleLimit(result);
  const legendWidth = Math.min(200, Math.max(120, width - 40));
  const legendHeight = 52;
  state.ui.gravityLegendPositions ||= { primary: null, secondary: null };
  const saved = state.ui.gravityLegendPositions[viewportName];
  const defaultX = Math.max(10, width - legendWidth - 20);
  const x = Math.max(10, Math.min(width - legendWidth - 10, Number(saved?.x ?? defaultX)));
  const y = Math.max(25, Math.min(canvas.clientHeight - 27, Number(saved?.y ?? 44)));
  gravityLegendBounds[viewportName] = { x: x - 10, y: y - 25, width: legendWidth + 20, height: legendHeight };
  const gradient = context.createLinearGradient(x, 0, x + legendWidth, 0);
  colorMapStops("gravity").forEach((color, index, colors) =>
    gradient.addColorStop(index / Math.max(1, colors.length - 1), color));
  context.save();
  context.fillStyle = state.appearance.theme === "light" ? "rgba(255,255,255,.90)" : "rgba(5,10,13,.82)";
  context.fillRect(x - 10, y - 25, legendWidth + 20, 52);
  context.fillStyle = state.appearance.theme === "light" ? "#172329" : "#edf3f0";
  context.font = "700 8px ui-monospace";
  context.fillText("⋮⋮", x, y - 12);
  context.fillText(`${gravityFieldLabel(gravity.field).toUpperCase()} · ${result.unit}`, x + 16, y - 12);
  context.fillStyle = gradient;
  context.fillRect(x, y, legendWidth, 10);
  context.strokeStyle = state.appearance.theme === "light" ? "#52656e" : "#96a7ad";
  context.strokeRect(x, y, legendWidth, 10);
  context.beginPath();
  context.moveTo(x + legendWidth / 2, y - 2);
  context.lineTo(x + legendWidth / 2, y + 13);
  context.stroke();
  context.fillStyle = state.appearance.theme === "light" ? "#172329" : "#edf3f0";
  context.font = "9px ui-monospace";
  const low = formatGravityScaleValue(-limit, "");
  const zero = "0";
  const high = formatGravityScaleValue(limit, "");
  context.fillText(low, x, y + 23);
  context.fillText(zero, x + legendWidth / 2 - context.measureText(zero).width / 2, y + 23);
  context.fillText(high, x + legendWidth - context.measureText(high).width, y + 23);
  context.restore();
}

function gravityLegendHit(viewport, point) {
  const bounds = gravityLegendBounds[viewport];
  return bounds && point[0] >= bounds.x && point[0] <= bounds.x + bounds.width
    && point[1] >= bounds.y && point[1] <= bounds.y + bounds.height;
}

function beginGravityLegendDrag(viewport, target, event, point) {
  if (event.button !== 0 || !gravityLegendHit(viewport, point)) return false;
  const bounds = gravityLegendBounds[viewport];
  gravityLegendDrag = {
    viewport,
    target,
    pointerId: event.pointerId,
    offsetX: point[0] - (bounds.x + 10),
    offsetY: point[1] - (bounds.y + 25)
  };
  target.style.cursor = "grabbing";
  target.setPointerCapture(event.pointerId);
  event.preventDefault();
  return true;
}

function moveGravityLegend(event, point) {
  if (!gravityLegendDrag) return false;
  state.ui.gravityLegendPositions ||= { primary: null, secondary: null };
  state.ui.gravityLegendPositions[gravityLegendDrag.viewport] = {
    x: point[0] - gravityLegendDrag.offsetX,
    y: point[1] - gravityLegendDrag.offsetY
  };
  draw();
  return true;
}

function finishGravityLegendDrag(target) {
  if (!gravityLegendDrag) return false;
  gravityLegendDrag = null;
  target.style.cursor = "grab";
  persist();
  draw();
  return true;
}

function resetGravityLegend(viewport) {
  state.ui.gravityLegendPositions ||= { primary: null, secondary: null };
  state.ui.gravityLegendPositions[viewport] = null;
  persist();
  draw();
  showToast("Gravity scale position reset");
}

function topographyModelForFeature(feature) {
  if (!["continental plate", "oceanic plate"].includes(feature.model) || feature.points.length < 3) return null;
  const topography = state.topography;
  if (!topography?.values?.length || topography.values.length !== topography.width * topography.height) return null;
  const bounds = terrainBounds();
  const xs = feature.points.map(point => point[0]); const ys = feature.points.map(point => point[1]);
  const overlaps = Math.max(...xs) >= bounds.west && Math.min(...xs) <= bounds.east
    && Math.max(...ys) >= bounds.south && Math.min(...ys) <= bounds.north;
  if (!overlaps) return null;

  const samples = new Map();
  const coordinateDigits = state.settings.coordinateSystem === "spherical" ? 6 : 0;
  const addSample = point => {
    const coordinate = point.map(value => Number(Number(value).toFixed(coordinateDigits)));
    const key = coordinate.join(",");
    samples.set(key, { coordinate, elevation: Math.round(sampleTopographyValue(point, topography)) });
  };
  feature.points.forEach(addSample);
  const centroid = feature.points.reduce((sum, point) => [sum[0] + point[0] / feature.points.length, sum[1] + point[1] / feature.points.length], [0, 0]);
  addSample(centroid);

  const stride = Math.max(1, Math.ceil(Math.sqrt(topography.width * topography.height / 140)));
  for (let row = 0; row < topography.height; row += stride) {
    for (let column = 0; column < topography.width; column += stride) {
      const point = [
        bounds.west + column / Math.max(1, topography.width - 1) * (bounds.east - bounds.west),
        bounds.north - row / Math.max(1, topography.height - 1) * (bounds.north - bounds.south)
      ];
      if (pointInPolygon(point, feature.points)) addSample(point);
    }
  }
  if (samples.size < 3) return null;

  const grouped = new Map();
  samples.forEach(({ coordinate, elevation }) => {
    // GWB's depth-surface plugin stores depth, then negates it to return elevation.
    const depthValue = -elevation;
    if (!grouped.has(depthValue)) grouped.set(depthValue, []);
    grouped.get(depthValue).push(coordinate);
  });
  return {
    model: {
      model: "depth surface",
      operation: "replace",
      topography: [...grouped.entries()].map(([depth, points]) => [depth, points])
    },
    sampleCount: samples.size
  };
}

function featuresWithTopography() {
  const mode = state.settings.topographyMode || "terrain";
  const enabled = state.topography?.exportToFeatures !== false;
  const hasField = state.topography?.values?.length === state.topography?.width * state.topography?.height;
  if (mode !== "terrain") {
    const status = document.querySelector("#topography-conversion-status");
    if (status) status.textContent = mode === "isostatic"
      ? "Feature topography surfaces are omitted; GWB receives density models and isostatic reference-column settings."
      : "No topography selected; all feature topography models are omitted from the exported file.";
    return state.features.map(feature => ({ ...feature, generatedTopographyModels: [] }));
  }
  let converted = 0; let samples = 0;
  const output = state.features.map(feature => {
    if (!enabled || !hasField) return feature;
    const result = topographyModelForFeature(feature);
    if (!result) return feature;
    converted++; samples += result.sampleCount;
    return { ...feature, generatedTopographyModels: [result.model] };
  });
  const status = document.querySelector("#topography-conversion-status");
  if (status) {
    status.textContent = !enabled
      ? "Conversion disabled · the terrain remains an editor-only layer."
      : !hasField
        ? "Add or generate a numeric elevation field to create GWB topography models."
        : converted
          ? `${converted} overlapping plate${converted === 1 ? "" : "s"} converted · ${samples} sampled surface points · GWB depth-surface convention`
          : "No continental or oceanic plate overlaps the elevation field.";
  }
  return output;
}

function hashNoise(x, y, seed) {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return (value - Math.floor(value)) * 2 - 1;
}

function smoothNoise(x, y, seed) {
  const x0 = Math.floor(x); const y0 = Math.floor(y);
  const tx = x - x0; const ty = y - y0;
  const fade = value => value * value * (3 - 2 * value);
  const sx = fade(tx); const sy = fade(ty);
  const a = hashNoise(x0, y0, seed); const b = hashNoise(x0 + 1, y0, seed);
  const c = hashNoise(x0, y0 + 1, seed); const d = hashNoise(x0 + 1, y0 + 1, seed);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}

function fractalNoise(x, y, seed, roughness) {
  let value = 0; let amplitude = 1; let frequency = 1; let total = 0;
  for (let octave = 0; octave < 5; octave++) {
    value += smoothNoise(x * frequency, y * frequency, seed + octave * 19) * amplitude;
    total += amplitude;
    amplitude *= roughness;
    frequency *= 2;
  }
  return value / total;
}

function generateTopography() {
  const topography = ensureTopography();
  const preset = document.querySelector("#terrain-preset").value;
  const amplitude = Number(document.querySelector("#terrain-amplitude").value);
  const roughness = Number(document.querySelector("#terrain-roughness").value);
  const scale = Number(document.querySelector("#terrain-scale").value);
  const seed = Number(document.querySelector("#terrain-seed").value);
  topography.bounds = {
    west: Number(state.settings.xMin), east: Number(state.settings.xMax),
    south: Number(state.settings.yMin), north: Number(state.settings.yMax)
  };
  topography.values = [];
  for (let row = 0; row < topography.height; row++) {
    for (let column = 0; column < topography.width; column++) {
      const nx = column / Math.max(1, topography.width - 1) * 2 - 1;
      const ny = row / Math.max(1, topography.height - 1) * 2 - 1;
      const noise = fractalNoise((nx + 1) * scale, (ny + 1) * scale, seed, roughness);
      let shape = noise;
      if (preset === "mountains") shape = Math.max(0, 1 - Math.abs(ny + .18 * Math.sin(nx * 5))) * .9 + noise * .42 - .2;
      if (preset === "rift") shape = -Math.max(0, 1 - Math.abs(nx - .22 * Math.sin(ny * 4)) * 2.4) + noise * .25 + .2;
      if (preset === "plateau") shape = (Math.hypot(nx, ny) < .62 ? .72 : -.12) + noise * .25;
      if (preset === "islands") {
        const islandA = Math.exp(-((nx + .35) ** 2 + (ny - .12) ** 2) * 8);
        const islandB = Math.exp(-((nx - .32) ** 2 + (ny + .2) ** 2) * 12);
        shape = islandA + islandB * .8 + noise * .18 - .35;
      }
      topography.values.push(Math.round(shape * amplitude));
    }
  }
  topography.source = `Procedural · ${preset}`;
  updateTopographyUI();
  updateAll(false);
}

function elevationColor(value, minimum, maximum, shade = 1) {
  const color = scalarRgb("topography", value, minimum, maximum);
  return `rgb(${color.map(component => Math.round(Math.max(0, Math.min(255, component * shade)))).join(",")})`;
}

function drawTopographySurface() {
  if (!sceneLayerVisible("topography") || state.settings.topographyMode !== "terrain") return;
  const topography = state.topography;
  if (!topography) return;
  const bounds = terrainBounds();
  const topLeft = worldToCanvas([bounds.west, bounds.north]);
  const bottomRight = worldToCanvas([bounds.east, bounds.south]);
  context.save();
  context.globalAlpha = Number(topography.opacity ?? 70) / 100;
  if (topographyImage?.complete) {
    context.drawImage(topographyImage, topLeft[0], topLeft[1], bottomRight[0] - topLeft[0], bottomRight[1] - topLeft[1]);
  }
  if (topography.values?.length === topography.width * topography.height) {
    const minimum = Math.min(...topography.values); const maximum = Math.max(...topography.values);
    const cellWidth = (bottomRight[0] - topLeft[0]) / topography.width;
    const cellHeight = (bottomRight[1] - topLeft[1]) / topography.height;
    for (let row = 0; row < topography.height; row++) {
      for (let column = 0; column < topography.width; column++) {
        const value = topography.values[terrainIndex(column, row, topography)];
        let shade = 1;
        if (topography.hillshade) {
          const dx = topography.values[terrainIndex(column + 1, row, topography)] - topography.values[terrainIndex(column - 1, row, topography)];
          const dy = topography.values[terrainIndex(column, row + 1, topography)] - topography.values[terrainIndex(column, row - 1, topography)];
          shade = Math.max(.55, Math.min(1.35, 1 + (-dx + dy) / Math.max(1, maximum - minimum) * 2.4));
        }
        context.fillStyle = elevationColor(value, minimum, maximum, shade);
        context.fillRect(topLeft[0] + column * cellWidth, topLeft[1] + row * cellHeight, cellWidth + .7, cellHeight + .7);
      }
    }
  }
  context.restore();
}

function geometryParts(geometry) {
  if (!geometry?.coordinates) return [];
  if (geometry.type === "LineString") return [{ points: geometry.coordinates, closed: false }];
  if (geometry.type === "MultiLineString") return geometry.coordinates.map(points => ({ points, closed: false }));
  if (geometry.type === "Polygon") return geometry.coordinates.map(points => ({ points, closed: true }));
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flatMap(polygon => polygon.map(points => ({ points, closed: true })));
  }
  return [];
}

function forEachGeoPart(collection, callback) {
  (collection?.features || []).forEach(feature => {
    geometryParts(feature.geometry).forEach(part => callback(part, feature.properties || {}));
  });
}

function traceGeoPart(points, closePath = false) {
  if (!points?.length) return false;
  let drawing = false;
  let previous = null;
  points.forEach((point, index) => {
    if (!Array.isArray(point) || !point.every(Number.isFinite)) return;
    const screen = worldToCanvas(point);
    const crossesDateline = previous && Math.abs(screen[0] - previous[0]) > canvas.clientWidth * .55;
    if (!drawing || crossesDateline) {
      context.moveTo(screen[0], screen[1]);
      drawing = true;
    } else {
      context.lineTo(screen[0], screen[1]);
    }
    previous = screen;
    if (index === points.length - 1 && closePath && !crossesDateline) context.closePath();
  });
  return drawing;
}

function drawSubductionTeeth(points, polarity = "left") {
  const sign = String(polarity).toLowerCase() === "right" ? 1 : -1;
  for (let index = 2; index < points.length; index += Math.max(3, Math.floor(points.length / 18))) {
    const a = worldToCanvas(points[index - 1]); const b = worldToCanvas(points[index]);
    if (Math.abs(a[0] - b[0]) > canvas.clientWidth * .55) continue;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 2) continue;
    const nx = sign * -(b[1] - a[1]) / length; const ny = sign * (b[0] - a[0]) / length;
    const mx = (a[0] + b[0]) / 2; const my = (a[1] + b[1]) / 2;
    context.beginPath();
    context.moveTo(mx - (b[0] - a[0]) / length * 3, my - (b[1] - a[1]) / length * 3);
    context.lineTo(mx + (b[0] - a[0]) / length * 3, my + (b[1] - a[1]) / length * 3);
    context.lineTo(mx + nx * 8, my + ny * 8);
    context.closePath();
    context.fill();
  }
}

function drawPaleogeography() {
  const paleo = state.paleogeography;
  if (!sceneLayerVisible("paleogeography") || !paleo?.visible || state.settings.coordinateSystem !== "spherical") return;
  const styles = {
    coastlines: { stroke: "#f0ca66", fill: "rgba(208,174,89,.13)", width: 1.2 },
    boundaries: { stroke: "#55c6d9", fill: null, width: 1.1 },
    subduction: { stroke: "#ff6f61", fill: "#ff6f61", width: 2 }
  };
  context.save();
  const [left, top] = worldToCanvas([state.settings.xMin, state.settings.yMax]);
  const [right, bottom] = worldToCanvas([state.settings.xMax, state.settings.yMin]);
  context.beginPath(); context.rect(left, top, right - left, bottom - top); context.clip();
  ["coastlines", "boundaries", "subduction"].forEach(layer => {
    const collection = paleo.layers?.[layer];
    if (!collection) return;
    const style = styles[layer];
    context.strokeStyle = style.stroke; context.fillStyle = style.fill || style.stroke;
    context.lineWidth = style.width;
    forEachGeoPart(collection, (part, properties) => {
      context.beginPath();
      traceGeoPart(part.points, part.closed);
      if (part.closed && style.fill) context.fill();
      context.stroke();
      if (layer === "subduction") drawSubductionTeeth(part.points, properties.polarity);
    });
  });
  context.restore();
}

function drawTerrainSelection() {
  if (!terrainSelection.length) return;
  const points = terrainSelection.map(worldToCanvas);
  const end = points[1] || worldToCanvas(canvasToWorld(...(hoverPoint || [0, 0])));
  context.save();
  context.fillStyle = "rgba(240,202,102,.12)";
  context.strokeStyle = "#f0ca66";
  context.setLineDash([6, 4]);
  context.fillRect(points[0][0], points[0][1], end[0] - points[0][0], end[1] - points[0][1]);
  context.strokeRect(points[0][0], points[0][1], end[0] - points[0][0], end[1] - points[0][1]);
  context.restore();
}

function worldToTerrainCell(world) {
  const topography = ensureTopography(); const bounds = terrainBounds();
  return [
    Math.round((world[0] - bounds.west) / Math.max(1e-12, bounds.east - bounds.west) * (topography.width - 1)),
    Math.round((bounds.north - world[1]) / Math.max(1e-12, bounds.north - bounds.south) * (topography.height - 1))
  ];
}

function sculptTopography(world, mode = tool.replace("terrain-", "")) {
  const topography = ensureTopography();
  const [centerColumn, centerRow] = worldToTerrainCell(world);
  const radius = Number(document.querySelector("#terrain-brush").value);
  const strength = Number(document.querySelector("#terrain-strength").value);
  const sourceValues = mode === "smooth" ? [...topography.values] : topography.values;
  for (let row = centerRow - radius; row <= centerRow + radius; row++) {
    for (let column = centerColumn - radius; column <= centerColumn + radius; column++) {
      if (row < 0 || row >= topography.height || column < 0 || column >= topography.width) continue;
      const distance = Math.hypot(column - centerColumn, row - centerRow);
      if (distance > radius) continue;
      const falloff = (1 + Math.cos(Math.PI * distance / Math.max(1, radius))) / 2;
      const index = terrainIndex(column, row, topography);
      if (mode === "raise") topography.values[index] += strength * falloff;
      if (mode === "lower") topography.values[index] -= strength * falloff;
      if (mode === "smooth") {
        let total = 0; let count = 0;
        for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
          total += sourceValues[terrainIndex(column + x, row + y, topography)]; count++;
        }
        topography.values[index] += (total / count - topography.values[index]) * falloff * .55;
      }
    }
  }
  topography.source = topography.source || "Sculpted surface";
  updateTopographyUI();
  persist();
  draw();
}

function applyTerrainSelection(direction) {
  if (terrainSelection.length < 2) {
    showToast("Select an area with two clicks first");
    return;
  }
  const topography = ensureTopography();
  const [a, b] = terrainSelection.map(worldToTerrainCell);
  const strength = Number(document.querySelector("#terrain-strength").value) * direction;
  for (let row = Math.min(a[1], b[1]); row <= Math.max(a[1], b[1]); row++) {
    for (let column = Math.min(a[0], b[0]); column <= Math.max(a[0], b[0]); column++) {
      topography.values[terrainIndex(column, row, topography)] += strength;
    }
  }
  terrainSelection = [];
  updateTopographyUI();
  updateAll(false);
  showToast(direction > 0 ? "Selection uplifted" : "Selection depressed");
}

function drawGrid(width, height) {
  const palette = canvasPalette();
  const pad = 42;
  const usableWidth = width - pad * 2;
  const usableHeight = height - pad * 2;
  context.fillStyle = palette.background;
  context.fillRect(0, 0, width, height);
  drawReferenceImage(width, height);
  drawLithosphereGrid();
  drawTomographyGrid();
  drawTopographySurface();
  drawPaleogeography();
  drawGravityOverlay();
  if (sceneLayerVisible("grid")) {
    context.strokeStyle = palette.grid;
    context.lineWidth = 1;
    const columns = Math.min(Number(state.settings.cellsX), 40);
    const rows = Math.min(Number(state.settings.cellsZ), 24);
    for (let column = 0; column <= columns; column++) {
      const x = pad + (column / columns) * usableWidth;
      context.beginPath(); context.moveTo(x, pad); context.lineTo(x, height - pad); context.stroke();
    }
    for (let row = 0; row <= rows; row++) {
      const y = pad + (row / rows) * usableHeight;
      context.beginPath(); context.moveTo(pad, y); context.lineTo(width - pad, y); context.stroke();
    }
    context.strokeStyle = palette.border;
    context.strokeRect(pad, pad, usableWidth, usableHeight);
    context.fillStyle = palette.muted;
    context.font = "10px ui-monospace";
    const spherical = state.settings.coordinateSystem === "spherical";
    const xMinLabel = spherical ? `${Number(state.settings.xMin).toFixed(1)}°` : `${state.settings.xMin / 1000} km`;
    const xmax = spherical ? `${Number(state.settings.xMax).toFixed(1)}°` : `${state.settings.xMax / 1000} km`;
    context.fillText(xMinLabel, pad, height - 18);
    context.fillText(xmax, width - pad - context.measureText(xmax).width, height - 18);
    context.fillText(spherical ? `${Number(state.settings.yMax).toFixed(1)}°` : `${state.settings.yMax / 1000} km`, 7, pad + 4);
    context.fillText(spherical ? `${Number(state.settings.yMin).toFixed(1)}°` : `${state.settings.yMin / 1000} km`, 7, height - pad);
  }
}

function tomographyCell(grid, column, row) {
  return grid.values[row * grid.nx + column];
}

function tomographyScalarValue(nativeDvs) {
  if (state.tomography?.scalarField !== "dvp") return Number(nativeDvs);
  return Number(nativeDvs) / Math.max(.1, Number(state.tomography.vpVsRatio) || 1.8);
}

function tomographyScalarLabel() {
  return state.tomography?.scalarField === "dvp" ? "dVp derived (%)" : "dVs (%)";
}

function tomographyScalarRange(grid) {
  return [tomographyScalarValue(grid.min), tomographyScalarValue(grid.max)];
}

function sampleTomography(longitude, latitude) {
  const grid = state.tomography?.grid;
  if (!grid?.values?.length || longitude < grid.west || longitude > grid.east || latitude < grid.south || latitude > grid.north) return null;
  const x = (longitude - grid.west) / (grid.east - grid.west) * (grid.nx - 1);
  const y = (grid.north - latitude) / (grid.north - grid.south) * (grid.ny - 1);
  const x0 = Math.floor(x); const x1 = Math.min(grid.nx - 1, x0 + 1);
  const y0 = Math.floor(y); const y1 = Math.min(grid.ny - 1, y0 + 1);
  const tx = x - x0; const ty = y - y0;
  const upper = tomographyCell(grid, x0, y0) * (1 - tx) + tomographyCell(grid, x1, y0) * tx;
  const lower = tomographyCell(grid, x0, y1) * (1 - tx) + tomographyCell(grid, x1, y1) * tx;
  return tomographyScalarValue(upper * (1 - ty) + lower * ty);
}

function isoCrossing(a, b, valueA, valueB, threshold) {
  const amount = Math.abs(valueB - valueA) < 1e-12 ? .5 : (threshold - valueA) / (valueB - valueA);
  return [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount];
}

function tomographyIsoSegments(project = worldToCanvas) {
  const grid = state.tomography?.grid;
  if (!grid?.values?.length || !state.tomography.showIso) return [];
  const threshold = Number(state.tomography.isoValue);
  const dx = (grid.east - grid.west) / Math.max(1, grid.nx - 1);
  const dy = (grid.north - grid.south) / Math.max(1, grid.ny - 1);
  const segments = [];
  for (let row = 0; row < grid.ny - 1; row++) {
    const north = grid.north - row * dy; const south = north - dy;
    for (let column = 0; column < grid.nx - 1; column++) {
      const west = grid.west + column * dx; const east = west + dx;
      const corners = [[west, north], [east, north], [east, south], [west, south]];
      const values = [
        tomographyScalarValue(tomographyCell(grid, column, row)),
        tomographyScalarValue(tomographyCell(grid, column + 1, row)),
        tomographyScalarValue(tomographyCell(grid, column + 1, row + 1)),
        tomographyScalarValue(tomographyCell(grid, column, row + 1))
      ];
      const crossings = [];
      [[0, 1], [1, 2], [2, 3], [3, 0]].forEach(([a, b]) => {
        if ((values[a] < threshold && values[b] >= threshold) || (values[b] < threshold && values[a] >= threshold)) {
          crossings.push(isoCrossing(corners[a], corners[b], values[a], values[b], threshold));
        }
      });
      if (crossings.length === 2) segments.push(crossings.map(point => project(point, grid.depth * 1000)));
      else if (crossings.length === 4) {
        segments.push(crossings.slice(0, 2).map(point => project(point, grid.depth * 1000)));
        segments.push(crossings.slice(2, 4).map(point => project(point, grid.depth * 1000)));
      }
    }
  }
  return segments;
}

function drawTomographyIso(project = worldToCanvas) {
  const segments = tomographyIsoSegments(project);
  if (!segments.length) return;
  context.save();
  context.strokeStyle = state.tomography.isoMode === "below" ? "#50e3ff" : "#fff36a";
  context.shadowColor = "#071014";
  context.shadowBlur = 3;
  context.lineWidth = 2;
  segments.forEach(([a, b]) => {
    context.beginPath(); context.moveTo(...a); context.lineTo(...b); context.stroke();
  });
  context.restore();
}

function drawTomographyGrid() {
  const grid = state.tomography?.grid;
  if (!sceneLayerVisible("tomography") || state.tomography?.visible === false || !grid?.values?.length) return;
  const opacity = Number(state.tomography.opacity ?? ensureColorMaps().tomography.opacity) / 100;
  const dx = (grid.east - grid.west) / Math.max(1, grid.nx - 1);
  const dy = (grid.north - grid.south) / Math.max(1, grid.ny - 1);
  context.save();
  context.globalAlpha = opacity;
  for (let row = 0; row < grid.ny - 1; row++) {
    const north = grid.north - row * dy;
    const south = north - dy;
    for (let column = 0; column < grid.nx - 1; column++) {
      const west = grid.west + column * dx;
      const east = west + dx;
      const a = worldToCanvas([west, north]);
      const b = worldToCanvas([east, south]);
      const [minimum, maximum] = tomographyScalarRange(grid);
      context.fillStyle = `rgb(${scalarRgb("tomography", tomographyScalarValue(tomographyCell(grid, column, row)), minimum, maximum).join(",")})`;
      context.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]) + .7, Math.abs(b[1] - a[1]) + .7);
    }
  }
  context.restore();
  drawTomographyIso();
}

function drawTomographyLegend(width, height) {
  const grid = state.tomography?.grid;
  if (!sceneLayerVisible("legend") || !sceneLayerVisible("tomography") || !grid?.values?.length || viewMode === "section") return;
  const map = ensureColorMaps().tomography;
  const legendWidth = Math.min(180, width - 40);
  const x = 20; const y = 44;
  const gradient = context.createLinearGradient(x, 0, x + legendWidth, 0);
  colorMapStops("tomography").forEach((color, index, colors) => gradient.addColorStop(index / Math.max(1, colors.length - 1), color));
  context.save();
  context.fillStyle = "rgba(5,10,13,.76)"; context.fillRect(x - 10, y - 24, legendWidth + 20, 48);
  context.fillStyle = "#edf3f0"; context.font = "700 8px ui-monospace";
  context.fillText(`${grid.model.replace("model_", "").toUpperCase()} · ${grid.depth} KM · ${tomographyScalarLabel()}`, x, y - 11);
  context.fillStyle = gradient; context.fillRect(x, y, legendWidth, 9);
  context.strokeStyle = "#96a7ad"; context.strokeRect(x, y, legendWidth, 9);
  context.font = "9px ui-monospace"; context.fillStyle = "#edf3f0";
  context.fillText(Number(map.min).toFixed(2), x, y + 20);
  const maxLabel = Number(map.max).toFixed(2);
  context.fillText(maxLabel, x + legendWidth - context.measureText(maxLabel).width, y + 20);
  context.restore();
}

function drawLithosphereGrid() {
  const grid = state.lithosphere?.grid;
  if (!sceneLayerVisible("lithosphere") || state.lithosphere?.visible === false || !grid?.values?.length) return;
  const opacity = Number(state.lithosphere.opacity ?? 72) / 100;
  const dx = (grid.east - grid.west) / Math.max(1, grid.nx - 1);
  const dy = (grid.north - grid.south) / Math.max(1, grid.ny - 1);
  context.save();
  context.globalAlpha = opacity;
  for (let row = 0; row < grid.ny - 1; row++) {
    const north = grid.north - row * dy;
    const south = north - dy;
    for (let column = 0; column < grid.nx - 1; column++) {
      const value = grid.values[row * grid.nx + column];
      if (!Number.isFinite(value)) continue;
      const west = grid.west + column * dx;
      const east = west + dx;
      const a = worldToCanvas([west, north]);
      const b = worldToCanvas([east, south]);
      context.fillStyle = `rgb(${scalarRgb("lithosphere", value, grid.min, grid.max).join(",")})`;
      context.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]) + .7, Math.abs(b[1] - a[1]) + .7);
    }
  }
  context.restore();
}

function drawLithosphereLegend(width) {
  const grid = state.lithosphere?.grid;
  if (!sceneLayerVisible("legend") || !sceneLayerVisible("lithosphere") || !grid?.values?.length || viewMode === "section") return;
  const legendWidth = Math.min(180, width - 40);
  const x = 20; const y = state.tomography?.grid?.values?.length ? 104 : 44;
  const gradient = context.createLinearGradient(x, 0, x + legendWidth, 0);
  colorMapStops("lithosphere").forEach((color, index, colors) => gradient.addColorStop(index / Math.max(1, colors.length - 1), color));
  context.save();
  context.fillStyle = "rgba(5,10,13,.76)"; context.fillRect(x - 10, y - 24, legendWidth + 20, 48);
  context.fillStyle = "#edf3f0"; context.font = "700 8px ui-monospace";
  context.fillText(`${String(grid.model || "LOCAL").toUpperCase()} · ${String(grid.field).replaceAll("_", " ")}`, x, y - 11);
  context.fillStyle = gradient; context.fillRect(x, y, legendWidth, 9);
  context.strokeStyle = "#96a7ad"; context.strokeRect(x, y, legendWidth, 9);
  context.font = "9px ui-monospace"; context.fillStyle = "#edf3f0";
  context.fillText(Number(grid.min).toPrecision(4), x, y + 20);
  const maxLabel = Number(grid.max).toPrecision(4);
  context.fillText(maxLabel, x + legendWidth - context.measureText(maxLabel).width, y + 20);
  context.restore();
}

function drawReferenceImage() {
  if (!sceneLayerVisible("referenceMap")) return;
  if (!referenceImage?.complete || !state.background) return;
  const background = state.background;
  const topLeft = worldToCanvas([Number(background.west), Number(background.north)]);
  const bottomRight = worldToCanvas([Number(background.east), Number(background.south)]);
  const baseWidth = Math.abs(bottomRight[0] - topLeft[0]);
  const baseHeight = Math.abs(bottomRight[1] - topLeft[1]);
  const scale = Number(background.scale ?? 100) / 100;
  const imageWidth = Math.max(1, referenceImage.naturalWidth || referenceImage.width);
  const imageHeight = Math.max(1, referenceImage.naturalHeight || referenceImage.height);
  const fitMode = background.fitMode || "contain";
  const fitScale = fitMode === "cover"
    ? Math.max(baseWidth / imageWidth, baseHeight / imageHeight)
    : Math.min(baseWidth / imageWidth, baseHeight / imageHeight);
  const width = fitMode === "stretch" ? baseWidth * scale
    : fitMode === "native" ? imageWidth * scale : imageWidth * fitScale * scale;
  const height = fitMode === "stretch" ? baseHeight * scale
    : fitMode === "native" ? imageHeight * scale : imageHeight * fitScale * scale;
  const centerX = (topLeft[0] + bottomRight[0]) / 2 + baseWidth * Number(background.offsetX || 0) / 100;
  const centerY = (topLeft[1] + bottomRight[1]) / 2 + baseHeight * Number(background.offsetY || 0) / 100;
  context.save();
  if (fitMode === "cover") {
    context.beginPath();
    context.rect(Math.min(topLeft[0], bottomRight[0]), Math.min(topLeft[1], bottomRight[1]), baseWidth, baseHeight);
    context.clip();
  }
  context.globalAlpha = Number(background.opacity ?? 45) / 100;
  context.translate(centerX, centerY);
  context.rotate(Number(background.rotation || 0) * Math.PI / 180);
  context.drawImage(referenceImage, -width / 2, -height / 2, width, height);
  context.restore();
}

function traceFeature(feature) {
  const points = feature.points.map(worldToCanvas);
  const geometry = FEATURE_TYPES[feature.model].geometry;
  context.beginPath();
  if (geometry === "point") {
    const [x, y] = points[0];
    const plume = plumePlanGeometry(feature);
    context.ellipse(x, y, plume.radiusX, plume.radiusY, 0, 0, Math.PI * 2);
  } else {
    context.moveTo(...points[0]);
    if (feature.smooth && points.length > 2) {
      for (let index = 1; index < points.length - 1; index++) {
        const midpoint = [(points[index][0] + points[index + 1][0]) / 2, (points[index][1] + points[index + 1][1]) / 2];
        context.quadraticCurveTo(points[index][0], points[index][1], midpoint[0], midpoint[1]);
      }
      const end = points.at(-1);
      context.lineTo(end[0], end[1]);
    } else {
      points.slice(1).forEach(point => context.lineTo(...point));
    }
    if (geometry === "area") context.closePath();
  }
  return points;
}

function plumePlanGeometry(feature) {
  const centerWorld = feature.points[0];
  const center = worldToCanvas(centerWorld);
  const fallback = state.settings.coordinateSystem === "spherical" ? 2 : 70000;
  const radius = Math.max(state.settings.coordinateSystem === "spherical" ? .05 : 1000, Number(feature.semiMajorAxis) || fallback);
  const eccentricity = Math.max(0, Math.min(.98, Number(feature.eccentricity) || 0));
  const minorRatio = Math.sqrt(1 - eccentricity * eccentricity);
  const horizontal = worldToCanvas([centerWorld[0] + radius, centerWorld[1]]);
  const vertical = worldToCanvas([centerWorld[0], centerWorld[1] + radius * minorRatio]);
  return {
    center,
    radiusX: Math.max(8, Math.abs(horizontal[0] - center[0])),
    radiusY: Math.max(8, Math.abs(vertical[1] - center[1])),
    minorRatio
  };
}

function hitPlumeContour(feature, point) {
  if (feature?.model !== "plume") return false;
  const { center, radiusX, radiusY } = plumePlanGeometry(feature);
  const normalized = Math.hypot((point[0] - center[0]) / radiusX, (point[1] - center[1]) / radiusY);
  const tolerance = Math.min(.45, Math.max(.12, 10 / Math.max(8, Math.min(radiusX, radiusY))));
  return Math.abs(normalized - 1) <= tolerance;
}

function featureThickness(feature) {
  if (!feature || feature.model === "plume") return null;
  if (feature.model === "subducting plate" || feature.model === "fault") return Number(feature.thickness);
  return Math.max(0, Number(feature.maxDepth) - Number(feature.minDepth));
}

function thicknessHandleGeometry(feature) {
  const points = feature.points.map(worldToCanvas);
  const right = Math.max(...points.map(point => point[0]));
  const centerY = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  return {
    x: Math.min(canvas.clientWidth - 25, right + 24),
    y: Math.max(65, Math.min(canvas.clientHeight - 65, centerY))
  };
}

function hitThicknessHandle(feature, point) {
  if (featureThickness(feature) == null) return false;
  const handle = thicknessHandleGeometry(feature);
  return Math.hypot(point[0] - handle.x, point[1] - handle.y) <= 13;
}

function layerBoundaryGeometry(feature) {
  if (!feature?.layers || feature.layers.length < 2) return [];
  const thickness = featureThickness(feature);
  if (!(thickness > 0)) return [];
  const thicknessHandle = thicknessHandleGeometry(feature);
  const x = thicknessHandle.x + 90 < canvas.clientWidth ? thicknessHandle.x + 76 : thicknessHandle.x - 76;
  const top = Math.max(55, thicknessHandle.y - 38);
  const bottom = Math.min(canvas.clientHeight - 55, thicknessHandle.y + 38);
  const startDepth = feature.model === "subducting plate" || feature.model === "fault" ? 0 : Number(feature.minDepth);
  return feature.layers.slice(0, -1).map((layer, index) => {
    const boundary = Number(layer.maxDepth);
    const fraction = Math.max(0, Math.min(1, (boundary - startDepth) / thickness));
    return { index, x, y: top + fraction * (bottom - top), top, bottom, startDepth, thickness, boundary };
  });
}

function hitLayerBoundaryHandle(feature, point) {
  return layerBoundaryGeometry(feature).find(handle => Math.hypot(point[0] - handle.x, point[1] - handle.y) <= 11) || null;
}

function drawConnections() {
  if (!sceneLayerVisible("connections")) return;
  context.save();
  context.strokeStyle = "#54b9a7";
  context.lineWidth = 2;
  context.setLineDash([6, 5]);
  state.connections.forEach(([sourceId, targetId]) => {
    const source = state.features.find(feature => feature.id === sourceId);
    const target = state.features.find(feature => feature.id === targetId);
    if (!featureVisible(source) || !featureVisible(target)) return;
    const a = worldToCanvas(source.points[source.points.length - 1]);
    const b = worldToCanvas(target.points[0]);
    context.beginPath(); context.moveTo(...a); context.lineTo(...b); context.stroke();
  });
  context.restore();
}

function activeSectionPath() {
  if (Array.isArray(state.sectionPath) && state.sectionPath.length >= 2) return state.sectionPath;
  if (Array.isArray(state.settings.section) && state.settings.section.length >= 2) return state.settings.section;
  return [[state.settings.xMin, state.settings.yMin], [state.settings.xMax, state.settings.yMin]];
}

function sectionSegmentLength(a, b) {
  if (state.settings.coordinateSystem === "spherical") {
    const [dx, dy] = gravityDeltaMeters(b[0] - a[0], b[1] - a[1]);
    return Math.hypot(dx, dy);
  }
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function sectionPathMetrics(path = activeSectionPath()) {
  const lengths = path.slice(1).map((point, index) => sectionSegmentLength(path[index], point));
  const cumulative = [0];
  lengths.forEach(length => cumulative.push(cumulative.at(-1) + length));
  return { lengths, cumulative, total: Math.max(1, cumulative.at(-1) || 0) };
}

function projectPointToSectionPath(point, path = activeSectionPath()) {
  const metrics = sectionPathMetrics(path);
  let best = { distance: Infinity, along: 0 };
  path.slice(1).forEach((b, index) => {
    const a = path[index];
    const dx = b[0] - a[0]; const dy = b[1] - a[1];
    const lengthSquared = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared));
    const projected = [a[0] + t * dx, a[1] + t * dy];
    const distance = Math.hypot(point[0] - projected[0], point[1] - projected[1]);
    if (distance < best.distance) best = {
      distance,
      along: metrics.cumulative[index] + t * metrics.lengths[index]
    };
  });
  return { ...best, fraction: best.along / metrics.total };
}

function pointAlongSectionPath(distance, path = activeSectionPath(), metrics = sectionPathMetrics(path)) {
  const target = Math.max(0, Math.min(metrics.total, distance));
  let index = metrics.lengths.findIndex((length, segment) => target <= metrics.cumulative[segment] + length);
  if (index < 0) index = metrics.lengths.length - 1;
  const length = Math.max(1e-12, metrics.lengths[index]);
  const t = (target - metrics.cumulative[index]) / length;
  return [
    path[index][0] + (path[index + 1][0] - path[index][0]) * t,
    path[index][1] + (path[index + 1][1] - path[index][1]) * t
  ];
}

function drawSectionPath(path, draft = false) {
  if (path.length < 1) return;
  const points = path.map(worldToCanvas);
  context.save();
  context.strokeStyle = "#f0ca66";
  context.fillStyle = "#f0ca66";
  context.lineWidth = 2;
  context.setLineDash(draft ? [4, 4] : [8, 5]);
  context.beginPath(); context.moveTo(...points[0]); points.slice(1).forEach(point => context.lineTo(...point)); context.stroke();
  context.setLineDash([]);
  points.forEach((point, index) => {
    context.beginPath(); context.arc(...point, draft ? 5 : 4, 0, Math.PI * 2); context.fill();
    if (points.length > 2) {
      context.font = "600 8px ui-monospace";
      context.fillText(`${index + 1}`, point[0] + 7, point[1] - 5);
    }
  });
  context.font = "600 10px Inter, sans-serif";
  context.fillText(draft ? "SECTION PATH · ENTER TO FINISH" : "SECTION", points.at(-1)[0] + 8, points.at(-1)[1] - 7);
  context.restore();
}

function drawSection() {
  if (state.sectionPath?.length >= 2 || state.settings.section?.length >= 2) drawSectionPath(activeSectionPath());
  if (sectionDraft.length) drawSectionPath(sectionDraft, true);
}

function syncSectionActions() {
  const actions = document.querySelector("#section-actions");
  if (!actions) return;
  actions.classList.toggle("hidden", tool !== "section");
  document.querySelector("#section-point-count").textContent = `${sectionDraft.length} point${sectionDraft.length === 1 ? "" : "s"}`;
  document.querySelector("#finish-section-path").disabled = sectionDraft.length < 2;
  document.querySelector("#undo-section-point").disabled = !sectionDraft.length;
}

function finishSectionPath() {
  if (sectionDraft.length < 2) {
    showToast("Add at least two section points");
    return;
  }
  state.sectionPath = sectionDraft.map(point => [...point]);
  state.settings.section = [[...sectionDraft[0]], [...sectionDraft.at(-1)]];
  sectionDraft = [];
  tool = "select";
  document.querySelectorAll("[data-tool]").forEach(item => item.classList.toggle("active", item.dataset.tool === "select"));
  syncSectionActions();
  updateAll();
  showToast("Curved section saved · GWB export uses its first and last points");
}

function cancelSectionPath() {
  sectionDraft = [];
  tool = "select";
  document.querySelectorAll("[data-tool]").forEach(item => item.classList.toggle("active", item.dataset.tool === "select"));
  syncSectionActions();
  draw();
}

function drawDraftGeometry() {
  if (!drawPoints.length) return;
  const points = drawPoints.map(worldToCanvas);
  const smooth = document.querySelector("#smooth-geometry")?.checked;
  context.save();
  context.strokeStyle = "#f0ca66";
  context.fillStyle = "#f0ca66";
  context.lineWidth = 2;
  context.setLineDash([6, 4]);
  context.beginPath(); context.moveTo(...points[0]);
  if (smooth && points.length > 2) {
    for (let index = 1; index < points.length - 1; index++) {
      const midpoint = [(points[index][0] + points[index + 1][0]) / 2, (points[index][1] + points[index + 1][1]) / 2];
      context.quadraticCurveTo(points[index][0], points[index][1], midpoint[0], midpoint[1]);
    }
    context.lineTo(...points.at(-1));
  } else {
    points.slice(1).forEach(point => context.lineTo(...point));
  }
  context.stroke();
  context.setLineDash([]);
  points.forEach(point => { context.beginPath(); context.arc(...point, 4, 0, Math.PI * 2); context.fill(); });
  context.restore();
}

function featureIsSelected(id) {
  return selectedIds.has(id) || (!selectedIds.size && id === selectedId);
}

function drawMarqueeSelection() {
  if (!marqueeSelection) return;
  const x = Math.min(marqueeSelection.start[0], marqueeSelection.current[0]);
  const y = Math.min(marqueeSelection.start[1], marqueeSelection.current[1]);
  const width = Math.abs(marqueeSelection.current[0] - marqueeSelection.start[0]);
  const height = Math.abs(marqueeSelection.current[1] - marqueeSelection.start[1]);
  context.save();
  context.fillStyle = "rgba(84,185,167,.12)";
  context.strokeStyle = "#54b9a7";
  context.lineWidth = 1.5;
  context.setLineDash([6, 4]);
  context.fillRect(x, y, width, height);
  context.strokeRect(x, y, width, height);
  context.restore();
}

function drawPlanSlabProjection(feature) {
  if (!sceneLayerVisible("slabs") || !state.appearance.slabProjection || feature.model !== "subducting plate" || feature.points.length < 2) return;
  const meta = FEATURE_TYPES[feature.model];
  const angle = Math.max(1, Number(feature.angle)) * Math.PI / 180;
  const fullDrop = Math.max(1, Math.abs(Number(feature.segmentLength) * Math.sin(angle)));
  const drop = Math.min(Number(feature.maxDepth), fullDrop);
  const run = Math.abs(Number(feature.segmentLength) * Math.cos(angle)) * Math.min(1, drop / fullDrop);
  const spherical = state.settings.coordinateSystem === "spherical";
  const direction = slabDirection(feature, spherical);
  const centerLatitude = feature.points.reduce((sum, point) => sum + Number(point[1]) / feature.points.length, 0);
  const longitudeScale = Math.max(.15, Math.cos(centerLatitude * Math.PI / 180));
  const shift = spherical
    ? [direction[0] * run / (111320 * longitudeScale), direction[1] * run / 111320]
    : [direction[0] * run, direction[1] * run];
  const trench = feature.points.map(worldToCanvas);
  const deep = feature.points.map(point => worldToCanvas([point[0] + shift[0], point[1] + shift[1]]));
  const trenchCenter = trench.reduce((sum, point) => [sum[0] + point[0] / trench.length, sum[1] + point[1] / trench.length], [0, 0]);
  const deepCenter = deep.reduce((sum, point) => [sum[0] + point[0] / deep.length, sum[1] + point[1] / deep.length], [0, 0]);
  const gradient = context.createLinearGradient(...trenchCenter, ...deepCenter);
  const color = state.appearance.renderMode === "temperature" ? temperatureColor(featureTemperature(feature)) : meta.color;
  const projectionColor = alpha => state.appearance.renderMode === "temperature"
    ? temperatureColor(featureTemperature(feature), alpha)
    : `${meta.color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
  gradient.addColorStop(0, projectionColor(.16));
  gradient.addColorStop(.55, projectionColor(.3));
  gradient.addColorStop(1, projectionColor(.08));
  context.save();
  context.fillStyle = renderOptions.featureContoursOnly ? "rgba(0,0,0,0)" : gradient;
  context.strokeStyle = state.appearance.renderMode === "temperature" ? temperatureColor(featureTemperature(feature), .8) : `${meta.color}aa`;
  context.lineWidth = featureIsSelected(feature.id) ? 2 : 1.25;
  context.beginPath();
  context.moveTo(...trench[0]);
  trench.slice(1).forEach(point => context.lineTo(...point));
  [...deep].reverse().forEach(point => context.lineTo(...point));
  context.closePath();
  context.fill();
  context.stroke();
  [0.25, 0.5, 0.75, 1].forEach((fraction, index) => {
    const contour = trench.map((point, pointIndex) => [
      point[0] + (deep[pointIndex][0] - point[0]) * fraction,
      point[1] + (deep[pointIndex][1] - point[1]) * fraction
    ]);
    context.strokeStyle = index === 3 ? color : `${state.appearance.theme === "light" ? "rgba(34,54,62,.38)" : "rgba(225,238,234,.38)"}`;
    context.setLineDash(index === 3 ? [] : [4, 4]);
    context.beginPath(); context.moveTo(...contour[0]); contour.slice(1).forEach(point => context.lineTo(...point)); context.stroke();
    const labelPoint = contour.at(-1);
    context.fillStyle = canvasPalette().text;
    context.font = "700 8px ui-monospace";
    if (sceneLayerVisible("labels")) {
      context.fillText(`${Math.round(drop * fraction / 1000)} km`, labelPoint[0] + 5, labelPoint[1] - 4);
    }
  });
  context.setLineDash([]);
  const arrowAngle = Math.atan2(deepCenter[1] - trenchCenter[1], deepCenter[0] - trenchCenter[0]);
  context.strokeStyle = color; context.fillStyle = color; context.lineWidth = 2;
  context.beginPath(); context.moveTo(...trenchCenter); context.lineTo(...deepCenter); context.stroke();
  context.beginPath();
  context.moveTo(...deepCenter);
  context.lineTo(deepCenter[0] - 11 * Math.cos(arrowAngle - .42), deepCenter[1] - 11 * Math.sin(arrowAngle - .42));
  context.lineTo(deepCenter[0] - 11 * Math.cos(arrowAngle + .42), deepCenter[1] - 11 * Math.sin(arrowAngle + .42));
  context.closePath(); context.fill();
  context.restore();
}

function drawFeature(feature) {
  const meta = FEATURE_TYPES[feature.model];
  const selected = featureIsSelected(feature.id);
  context.save();
  drawPlanSlabProjection(feature);
  const points = traceFeature(feature);
  context.fillStyle = featureFill(feature, points, .28);
  context.strokeStyle = state.appearance.renderMode === "temperature" ? temperatureColor(featureTemperature(feature)) : meta.color;
  context.lineWidth = renderOptions.featureContoursOnly ? 2 : selected ? 3 : 2;
  context.fill();
  context.stroke();
  if (!renderOptions.featureContoursOnly && state.appearance.renderMode === "temperature" && state.appearance.temperatureContours && FEATURE_TYPES[feature.model].geometry === "area") {
    context.save();
    traceFeature(feature);
    context.clip();
    const ys = points.map(point => point[1]);
    context.strokeStyle = "rgba(255,255,255,.35)";
    context.lineWidth = 1;
    context.setLineDash([3, 4]);
    for (let y = Math.min(...ys) + 12; y < Math.max(...ys); y += 15) {
      context.beginPath(); context.moveTo(Math.min(...points.map(point => point[0])), y); context.lineTo(Math.max(...points.map(point => point[0])), y); context.stroke();
    }
    context.restore();
  }
  if (sceneLayerVisible("slabs") && (feature.model === "subducting plate" || feature.model === "fault")) {
    const start = points[Math.floor(points.length / 2)];
    const dip = worldToCanvas(feature.dipPoint);
    context.setLineDash([5, 4]);
    context.beginPath(); context.moveTo(...start); context.lineTo(...dip); context.stroke();
    context.setLineDash([]);
    const direction = Math.atan2(dip[1] - start[1], dip[0] - start[0]);
    context.fillStyle = meta.color;
    context.beginPath();
    context.moveTo(dip[0], dip[1]);
    context.lineTo(dip[0] - 12 * Math.cos(direction - .45), dip[1] - 12 * Math.sin(direction - .45));
    context.lineTo(dip[0] - 12 * Math.cos(direction + .45), dip[1] - 12 * Math.sin(direction + .45));
    context.closePath(); context.fill();
    context.beginPath(); context.arc(dip[0], dip[1], 6, 0, Math.PI * 2); context.stroke();
    context.fillStyle = state.appearance.renderMode === "temperature" ? canvasPalette().text : "#f3b2a7";
    context.font = "700 10px Inter, sans-serif";
    if (sceneLayerVisible("labels")) context.fillText(`${feature.angle}° dip · ${(feature.thickness / 1000).toFixed(0)} km`, dip[0] + 10, dip[1] - 8);
  }
  if (!renderOptions.suppressFeatureHandles && (selected || tool === "connect")) {
    points.forEach(([x, y], index) => {
      context.fillStyle = "#0b1115";
      context.beginPath(); context.arc(x, y, selected && index === selectedPointIndex ? 7 : 5, 0, Math.PI * 2); context.fill();
      context.lineWidth = selected && index === selectedPointIndex ? 3 : 2; context.stroke();
    });
  }
  if (!renderOptions.suppressFeatureHandles && !renderOptions.featureVertexHandlesOnly && selected && feature.model === "plume") {
    const plume = plumePlanGeometry(feature);
    context.save();
    context.strokeStyle = state.appearance.renderMode === "temperature" ? temperatureColor(featureTemperature(feature)) : meta.color;
    context.fillStyle = canvasPalette().background;
    context.lineWidth = 1.5;
    context.setLineDash([4, 4]);
    context.beginPath();
    context.ellipse(plume.center[0], plume.center[1], plume.radiusX, plume.radiusY, 0, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    [
      [plume.center[0] - plume.radiusX, plume.center[1]],
      [plume.center[0] + plume.radiusX, plume.center[1]],
      [plume.center[0], plume.center[1] - plume.radiusY],
      [plume.center[0], plume.center[1] + plume.radiusY]
    ].forEach(handle => {
      context.beginPath();
      context.arc(handle[0], handle[1], 5, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    });
    context.restore();
  }
  if (!renderOptions.suppressFeatureHandles && !renderOptions.featureVertexHandlesOnly && selected && feature.id === selectedId && feature.model !== "plume") {
    const handle = thicknessHandleGeometry(feature);
    const thickness = featureThickness(feature);
    context.save();
    context.strokeStyle = state.appearance.renderMode === "temperature" ? temperatureColor(featureTemperature(feature)) : meta.color;
    context.fillStyle = canvasPalette().background;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(handle.x, handle.y - 15);
    context.lineTo(handle.x, handle.y + 15);
    context.moveTo(handle.x - 5, handle.y - 10);
    context.lineTo(handle.x, handle.y - 15);
    context.lineTo(handle.x + 5, handle.y - 10);
    context.moveTo(handle.x - 5, handle.y + 10);
    context.lineTo(handle.x, handle.y + 15);
    context.lineTo(handle.x + 5, handle.y + 10);
    context.stroke();
    context.beginPath();
    context.arc(handle.x, handle.y, 6, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = canvasPalette().text;
    context.font = "700 9px Inter, sans-serif";
    context.fillText(`${Math.round(thickness / 1000)} km thick`, handle.x + 10, handle.y + 3);
    context.restore();
    const boundaries = layerBoundaryGeometry(feature);
    if (boundaries.length) {
      context.save();
      const x = boundaries[0].x;
      context.strokeStyle = state.appearance.renderMode === "temperature" ? temperatureColor(featureTemperature(feature)) : meta.color;
      context.fillStyle = canvasPalette().background;
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(x, boundaries[0].top);
      context.lineTo(x, boundaries[0].bottom);
      context.stroke();
      boundaries.forEach(boundary => {
        context.beginPath();
        context.moveTo(x - 8, boundary.y);
        context.lineTo(x + 8, boundary.y);
        context.stroke();
        context.beginPath();
        context.arc(x, boundary.y, 5, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.fillStyle = canvasPalette().text;
        context.font = "700 8px Inter, sans-serif";
        context.fillText(`L${boundary.index + 1}/${boundary.index + 2} · ${((boundary.boundary - boundary.startDepth) / 1000).toFixed(0)} km`, x + 11, boundary.y + 3);
        context.fillStyle = canvasPalette().background;
      });
      context.restore();
    }
  }
  if (sceneLayerVisible("labels")) {
    const anchor = points[0];
    context.fillStyle = canvasPalette().text;
    context.font = canvas.clientWidth < 520 ? "600 9px Inter, sans-serif" : "600 11px Inter, sans-serif";
    const stagger = canvas.clientWidth < 520 ? (state.features.indexOf(feature) % 3) * 11 : 0;
    context.fillText(viewportFeatureLabel(feature), anchor[0] + 9, anchor[1] - 9 + stagger);
  }
  context.restore();
}

function project3D([x, y], depth = 0) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const { xMin, xMax, yMin, yMax, zMin, zMax } = state.settings;
  const nx = ((x - xMin) / Math.max(1, xMax - xMin) - 0.5) * 1.15;
  const ny = ((y - yMin) / Math.max(1, yMax - yMin) - 0.5) * 1.15;
  const nd = (depth - zMin) / Math.max(1, zMax - zMin);
  const yaw = Number(renderCamera.orbitYaw ?? -25) * Math.PI / 180;
  const pitch = Number(renderCamera.orbitPitch ?? 28) * Math.PI / 180;
  const horizontal = nx * Math.cos(yaw) - ny * Math.sin(yaw);
  const distance = nx * Math.sin(yaw) + ny * Math.cos(yaw);
  return [
    width * 0.5 + horizontal * width * 0.62,
    height * 0.24 + distance * height * 0.44 * Math.sin(pitch) + nd * height * 0.64 * Math.cos(pitch)
  ];
}

function slabDirection(feature, spherical = false) {
  const center = feature.points.reduce((sum, point) => [
    sum[0] + point[0] / feature.points.length,
    sum[1] + point[1] / feature.points.length
  ], [0, 0]);
  let dx = Number(feature.dipPoint?.[0] ?? center[0] + 1) - center[0];
  let dy = Number(feature.dipPoint?.[1] ?? center[1]) - center[1];
  if (spherical) dx *= Math.cos(center[1] * Math.PI / 180);
  const length = Math.hypot(dx, dy) || 1;
  return [dx / length, dy / length];
}

function drawSlabVolume(feature, project, spherical = false) {
  const meta = FEATURE_TYPES[feature.model];
  const angle = Number(feature.angle) * Math.PI / 180;
  const length = Number(feature.segmentLength);
  const drop = Math.min(Number(feature.maxDepth), Math.abs(length * Math.sin(angle)));
  const run = Math.abs(length * Math.cos(angle));
  const surfaceRun = spherical ? run / 111320 * 4 : run;
  const direction = slabDirection(feature, spherical);
  const shifted = feature.points.map(point => [
    point[0] + direction[0] * surfaceRun,
    point[1] + direction[1] * surfaceRun
  ]);
  const trench = feature.points.map(point => project(point, Number(feature.minDepth)));
  const deepTop = shifted.map(point => project(point, drop));
  const deepBottom = shifted.map(point => project(point, drop + Number(feature.thickness)));
  const trenchBottom = feature.points.map(point => project(point, Number(feature.minDepth) + Number(feature.thickness)));
  context.save();
  context.fillStyle = featureFill(feature, [...trench, ...deepTop], .48);
  context.strokeStyle = state.appearance.renderMode === "temperature" ? temperatureColor(featureTemperature(feature)) : meta.color;
  context.lineWidth = featureIsSelected(feature.id) ? 2.5 : 1.5;
  for (let index = 0; index < trench.length - 1; index++) {
    context.beginPath();
    context.moveTo(...trench[index]);
    context.lineTo(...trench[index + 1]);
    context.lineTo(...deepTop[index + 1]);
    context.lineTo(...deepTop[index]);
    context.closePath(); context.fill(); context.stroke();
    context.save();
    context.fillStyle = featureFill(feature, [...deepTop, ...deepBottom], .22);
    context.beginPath();
    context.moveTo(...deepTop[index]);
    context.lineTo(...deepTop[index + 1]);
    context.lineTo(...deepBottom[index + 1]);
    context.lineTo(...deepBottom[index]);
    context.closePath(); context.fill(); context.stroke();
    context.restore();
  }
  [0, trench.length - 1].forEach(index => {
    context.beginPath(); context.moveTo(...trench[index]); context.lineTo(...deepTop[index]); context.lineTo(...deepBottom[index]); context.lineTo(...trenchBottom[index]); context.closePath();
    context.fillStyle = featureFill(feature, [trench[index], deepTop[index], deepBottom[index], trenchBottom[index]], .3); context.fill(); context.stroke();
  });
  (feature.layers || []).map((layer, index) => ({ layer, index })).slice(0, -1)
    .filter(item => featureSublayerVisible(feature, item.index))
    .forEach(({ layer, index: layerIndex }) => {
    const boundaryDepth = Number(layer.maxDepth);
    const upper = feature.points.map(point => project(point, Number(feature.minDepth) + boundaryDepth));
    const lower = shifted.map(point => project(point, drop + boundaryDepth));
    context.save();
    context.strokeStyle = state.appearance.renderMode === "temperature"
      ? temperatureColor(feature.layers[layerIndex]?.temperature ?? feature.temperature)
      : `hsl(${172 + layerIndex * 31} 55% 67%)`;
    context.setLineDash([5, 3]);
    for (let index = 0; index < upper.length; index++) {
      context.beginPath(); context.moveTo(...upper[index]); context.lineTo(...lower[index]); context.stroke();
    }
    context.restore();
    });
  if (sceneLayerVisible("labels")) {
    context.fillStyle = canvasPalette().text;
    context.font = "700 10px Inter, sans-serif";
    context.fillText(viewportFeatureLabel(feature, ` · ${feature.angle}°`), trench[0][0] + 7, trench[0][1] - 8);
  }
  context.restore();
}

function globeProject([longitude, latitude], depth = 0) {
  const width = canvas.clientWidth; const height = canvas.clientHeight;
  const radiusPixels = Math.min(width, height) * .37;
  const centerX = width * .5; const centerY = height * .49;
  const lon0 = ((Number(state.settings.xMin) + Number(state.settings.xMax)) / 2 + Number(renderCamera.orbitYaw ?? -25) + 25) * Math.PI / 180;
  const baseLatitude = (Number(state.settings.yMin) + Number(state.settings.yMax)) / 2;
  const lat0 = Math.max(-80, Math.min(80, baseLatitude + Number(renderCamera.orbitPitch ?? 28) - 28)) * Math.PI / 180;
  const lon = Number(longitude) * Math.PI / 180; const lat = Number(latitude) * Math.PI / 180;
  const delta = lon - lon0;
  const visualDepthRange = Math.max(1, Number(state.settings.zMax) - Number(state.settings.zMin));
  const radial = Math.max(.18, 1 - Number(depth) / visualDepthRange * .34);
  const x = radial * Math.cos(lat) * Math.sin(delta);
  const y = radial * (Math.cos(lat0) * Math.sin(lat) - Math.sin(lat0) * Math.cos(lat) * Math.cos(delta));
  return [centerX + x * radiusPixels, centerY - y * radiusPixels];
}

function drawLithosphereGlobe() {
  const grid = state.lithosphere?.grid;
  if (!sceneLayerVisible("lithosphere") || state.lithosphere?.visible === false || !grid?.values?.length) return;
  const columnStep = Math.max(1, Math.ceil(grid.nx / 60));
  const rowStep = Math.max(1, Math.ceil(grid.ny / 45));
  const dx = (grid.east - grid.west) / Math.max(1, grid.nx - 1);
  const dy = (grid.north - grid.south) / Math.max(1, grid.ny - 1);
  context.save();
  context.globalAlpha = Number(state.lithosphere.opacity ?? 72) / 100;
  for (let row = 0; row < grid.ny - 1; row += rowStep) {
    const nextRow = Math.min(grid.ny - 1, row + rowStep);
    const north = grid.north - row * dy;
    const south = grid.north - nextRow * dy;
    for (let column = 0; column < grid.nx - 1; column += columnStep) {
      const value = grid.values[row * grid.nx + column];
      if (!Number.isFinite(value)) continue;
      const nextColumn = Math.min(grid.nx - 1, column + columnStep);
      const west = grid.west + column * dx;
      const east = grid.west + nextColumn * dx;
      const points = [
        globeProject([west, north]), globeProject([east, north]),
        globeProject([east, south]), globeProject([west, south])
      ];
      context.fillStyle = `rgb(${scalarRgb("lithosphere", value, grid.min, grid.max).join(",")})`;
      context.beginPath(); context.moveTo(...points[0]); points.slice(1).forEach(point => context.lineTo(...point)); context.closePath(); context.fill();
    }
  }
  context.restore();
}

function drawTomographyGlobe() {
  const grid = state.tomography?.grid;
  if (!sceneLayerVisible("tomography") || state.tomography?.visible === false || !grid?.values?.length) return;
  const columnStep = Math.max(1, Math.ceil(grid.nx / 60));
  const rowStep = Math.max(1, Math.ceil(grid.ny / 45));
  const dx = (grid.east - grid.west) / Math.max(1, grid.nx - 1);
  const dy = (grid.north - grid.south) / Math.max(1, grid.ny - 1);
  const [minimum, maximum] = tomographyScalarRange(grid);
  context.save();
  context.globalAlpha = Number(state.tomography.opacity ?? 76) / 100;
  for (let row = 0; row < grid.ny - 1; row += rowStep) {
    const nextRow = Math.min(grid.ny - 1, row + rowStep);
    const north = grid.north - row * dy;
    const south = grid.north - nextRow * dy;
    for (let column = 0; column < grid.nx - 1; column += columnStep) {
      const nextColumn = Math.min(grid.nx - 1, column + columnStep);
      const west = grid.west + column * dx;
      const east = grid.west + nextColumn * dx;
      const points = [
        globeProject([west, north], grid.depth * 1000),
        globeProject([east, north], grid.depth * 1000),
        globeProject([east, south], grid.depth * 1000),
        globeProject([west, south], grid.depth * 1000)
      ];
      context.fillStyle = `rgb(${scalarRgb("tomography", tomographyScalarValue(tomographyCell(grid, column, row)), minimum, maximum).join(",")})`;
      context.beginPath(); context.moveTo(...points[0]); points.slice(1).forEach(point => context.lineTo(...point)); context.closePath(); context.fill();
    }
  }
  context.restore();
  drawTomographyIso(globeProject);
}

function drawSpherical3DView(width, height) {
  const palette = canvasPalette();
  const planetaryBody = state.settings.planetaryPresetActive
    ? planetaryBodyById(state.settings.planetaryBody)
    : null;
  const planetaryVisual = PLANETARY_VISUALS[planetaryBody?.id] || PLANETARY_VISUALS.earth;
  context.fillStyle = palette.deep; context.fillRect(0, 0, width, height);
  const radiusPixels = Math.min(width, height) * .37;
  const centerX = width * .5; const centerY = height * .49;
  const glow = context.createRadialGradient(centerX - radiusPixels * .3, centerY - radiusPixels * .35, radiusPixels * .05, centerX, centerY, radiusPixels);
  glow.addColorStop(0, planetaryBody ? planetaryVisual[0] : state.appearance.theme === "light" ? "#ffffff" : "#1d3840");
  glow.addColorStop(.64, planetaryBody ? planetaryVisual[1] : state.appearance.theme === "light" ? "#e8f0f1" : "#132a32");
  glow.addColorStop(1, planetaryBody ? planetaryVisual[2] : state.appearance.theme === "light" ? "#d8e2e5" : "#0b171c");
  context.fillStyle = glow; context.strokeStyle = palette.border; context.lineWidth = 1.5;
  context.beginPath(); context.arc(centerX, centerY, radiusPixels, 0, Math.PI * 2); context.fill(); context.stroke();
  context.save(); context.beginPath(); context.arc(centerX, centerY, radiusPixels, 0, Math.PI * 2); context.clip();
  if (sceneLayerVisible("grid")) {
    context.strokeStyle = "#1d343b"; context.lineWidth = 1;
    for (let latitude = -60; latitude <= 60; latitude += 30) {
      context.beginPath();
      for (let longitude = Number(state.settings.xMin) - 60; longitude <= Number(state.settings.xMax) + 60; longitude += 3) {
        const point = globeProject([longitude, latitude]);
        longitude === Number(state.settings.xMin) - 60 ? context.moveTo(...point) : context.lineTo(...point);
      }
      context.stroke();
    }
    for (let longitude = Math.ceil(Number(state.settings.xMin) / 30) * 30 - 60; longitude <= Number(state.settings.xMax) + 60; longitude += 30) {
      context.beginPath();
      for (let latitude = -85; latitude <= 85; latitude += 3) {
        const point = globeProject([longitude, latitude]);
        latitude === -85 ? context.moveTo(...point) : context.lineTo(...point);
      }
      context.stroke();
    }
  }
  drawLithosphereGlobe();
  drawTomographyGlobe();
  for (const feature of state.features.filter(featureVisible)) {
    const meta = FEATURE_TYPES[feature.model];
    if (sceneLayerVisible("slabs") && (feature.model === "subducting plate" || feature.model === "fault")) {
      drawSlabVolume(feature, globeProject, true);
      continue;
    }
    const points = feature.points.map(point => globeProject(point, Number(feature.minDepth)));
    context.save();
    context.strokeStyle = state.appearance.renderMode === "temperature" ? temperatureColor(featureTemperature(feature)) : meta.color;
    context.fillStyle = featureFill(feature, points, .34);
    context.lineWidth = renderOptions.featureContoursOnly ? 2 : featureIsSelected(feature.id) ? 3 : 2;
    context.beginPath(); context.moveTo(...points[0]); points.slice(1).forEach(point => context.lineTo(...point));
    if (meta.geometry === "area") context.closePath();
    context.fill(); context.stroke(); context.restore();
  }
  context.restore();
  if (planetaryBody) {
    const badgeWidth = Math.min(250, width - 36);
    const badgeX = Math.max(18, width - badgeWidth - 18);
    const badgeY = Math.max(18, height - 94);
    context.save();
    context.fillStyle = state.appearance.theme === "light" ? "rgba(255,255,255,.9)" : "rgba(5,12,16,.84)";
    context.strokeStyle = palette.border;
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(badgeX, badgeY, badgeWidth, 58, 9);
    context.fill(); context.stroke();
    context.fillStyle = palette.text;
    context.font = "700 11px Inter, sans-serif";
    context.fillText(`${planetaryBody.symbol} ${planetaryBody.name.toUpperCase()} · ACTIVE PRESET`, badgeX + 12, badgeY + 21);
    context.fillStyle = palette.muted;
    context.font = "9px ui-monospace";
    context.fillText(`R ${(planetaryBody.radius / 1000).toLocaleString()} km · g ${planetaryBody.gravity} m/s²`, badgeX + 12, badgeY + 39);
    context.fillText("Schematic body preview · datasets not yet loaded", badgeX + 12, badgeY + 52);
    context.restore();
  }
  context.fillStyle = palette.muted; context.font = "10px ui-monospace";
  context.fillText("SPHERICAL PREVIEW · longitude / latitude · depth exaggerated toward globe center", 18, height - 18);
}

function drawTopography3D() {
  if (!sceneLayerVisible("topography") || state.settings.topographyMode !== "terrain") return;
  const topography = state.topography;
  if (!topography?.values?.length || topography.values.length !== topography.width * topography.height) return;
  const bounds = terrainBounds();
  const minimum = Math.min(...topography.values); const maximum = Math.max(...topography.values);
  const exaggeration = 12;
  context.save();
  context.globalAlpha = Number(topography.opacity ?? 70) / 100;
  for (let row = 0; row < topography.height - 1; row++) {
    for (let column = 0; column < topography.width - 1; column++) {
      const coordinate = (col, line) => [
        bounds.west + col / (topography.width - 1) * (bounds.east - bounds.west),
        bounds.north - line / (topography.height - 1) * (bounds.north - bounds.south)
      ];
      const corners = [[column, row], [column + 1, row], [column + 1, row + 1], [column, row + 1]];
      const projected = corners.map(([col, line]) => project3D(
        coordinate(col, line),
        -topography.values[terrainIndex(col, line, topography)] * exaggeration
      ));
      const elevation = corners.reduce((sum, [col, line]) => sum + topography.values[terrainIndex(col, line, topography)] / 4, 0);
      context.fillStyle = elevationColor(elevation, minimum, maximum, 1);
      context.strokeStyle = state.appearance.theme === "light" ? "rgba(55,75,82,.16)" : "rgba(225,238,234,.12)";
      context.lineWidth = .5;
      context.beginPath(); context.moveTo(...projected[0]); projected.slice(1).forEach(point => context.lineTo(...point)); context.closePath();
      context.fill(); context.stroke();
    }
  }
  context.restore();
}

function draw3DView(width, height) {
  if (state.settings.coordinateSystem === "spherical") {
    drawSpherical3DView(width, height);
    return;
  }
  const palette = canvasPalette();
  context.fillStyle = palette.deep;
  context.fillRect(0, 0, width, height);
  const { xMin, xMax, yMin, yMax } = state.settings;
  const plane = [[xMin, yMin], [xMax, yMin], [xMax, yMax], [xMin, yMax]].map(point => project3D(point, 0));
  context.fillStyle = palette.plane;
  context.strokeStyle = palette.border;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(...plane[0]);
  plane.slice(1).forEach(point => context.lineTo(...point));
  context.closePath(); context.fill(); context.stroke();
  if (sceneLayerVisible("grid")) {
    for (let i = 0; i <= 10; i++) {
      const x = xMin + (i / 10) * (xMax - xMin);
      const a = project3D([x, yMin], 0); const b = project3D([x, yMax], 0);
      context.strokeStyle = palette.grid; context.beginPath(); context.moveTo(...a); context.lineTo(...b); context.stroke();
    }
    for (let i = 0; i <= 8; i++) {
      const y = yMin + (i / 8) * (yMax - yMin);
      const a = project3D([xMin, y], 0); const b = project3D([xMax, y], 0);
      context.strokeStyle = palette.grid; context.beginPath(); context.moveTo(...a); context.lineTo(...b); context.stroke();
    }
  }
  drawTopography3D();
  drawGravity3DOverlay();

  for (const feature of state.features.filter(featureVisible)) {
    const meta = FEATURE_TYPES[feature.model];
    const top = feature.points.map(point => project3D(point, feature.minDepth));
    const bottom = feature.points.map(point => project3D(point, feature.maxDepth));
    context.save();
    context.strokeStyle = state.appearance.renderMode === "temperature" ? temperatureColor(featureTemperature(feature)) : meta.color;
    context.fillStyle = featureFill(feature, [...top, ...bottom], .26);
    context.lineWidth = renderOptions.featureContoursOnly ? 2 : featureIsSelected(feature.id) ? 3 : 2;
    if (meta.geometry === "area" && top.length > 2) {
      context.beginPath(); context.moveTo(...top[0]); top.slice(1).forEach(point => context.lineTo(...point)); context.closePath(); context.fill(); context.stroke();
      context.beginPath(); context.moveTo(...bottom[0]); bottom.slice(1).forEach(point => context.lineTo(...point)); context.closePath(); context.stroke();
      top.forEach((point, index) => { context.beginPath(); context.moveTo(...point); context.lineTo(...bottom[index]); context.stroke(); });
      if (!renderOptions.featureContoursOnly) (feature.layers || []).map((layer, index) => ({ layer, index })).slice(0, -1)
        .filter(item => featureSublayerVisible(feature, item.index))
        .forEach(({ layer, index: layerIndex }) => {
        const boundary = feature.points.map(point => project3D(point, Number(layer.maxDepth)));
        context.save();
        context.strokeStyle = state.appearance.renderMode === "temperature"
          ? temperatureColor(feature.layers[layerIndex]?.temperature ?? feature.temperature)
          : `hsl(${172 + layerIndex * 31} 48% 60%)`;
        context.lineWidth = 1;
        context.setLineDash([4, 3]);
        context.beginPath(); context.moveTo(...boundary[0]); boundary.slice(1).forEach(point => context.lineTo(...point)); context.closePath(); context.stroke();
        context.restore();
        });
    } else if (sceneLayerVisible("slabs") && (feature.model === "subducting plate" || feature.model === "fault")) {
      context.restore();
      if (sceneLayerVisible("slabs")) drawSlabVolume(feature, project3D);
      continue;
    } else {
      const start = top[0]; const end = bottom[0];
      context.lineWidth = renderOptions.featureContoursOnly ? 2 : feature.model === "plume" ? 18 : 4;
      context.globalAlpha = renderOptions.featureContoursOnly ? 1 : .38;
      context.beginPath(); context.moveTo(...start); context.lineTo(...end); context.stroke();
      context.globalAlpha = 1; context.lineWidth = 2; context.beginPath(); context.moveTo(...start); context.lineTo(...end); context.stroke();
    }
    context.globalAlpha = 1;
    context.fillStyle = palette.text;
    context.font = "600 10px Inter, sans-serif";
    if (sceneLayerVisible("labels")) {
      context.fillText(viewportFeatureLabel(feature), top[0][0] + 7, top[0][1] - 7);
    }
    context.restore();
  }
  context.fillStyle = palette.muted;
  context.font = "10px ui-monospace";
  context.fillText("Interactive volume preview · depth increases downward · topography vertically exaggerated ×12", 18, height - 18);
}

function distanceToSection(point, section) {
  return projectPointToSectionPath(point, section).fraction;
}

function sampleGravityResult(point, result) {
  const xFraction = (point[0] - Number(state.settings.xMin)) / Math.max(1e-12, Number(state.settings.xMax) - Number(state.settings.xMin));
  const yFraction = (Number(state.settings.yMax) - point[1]) / Math.max(1e-12, Number(state.settings.yMax) - Number(state.settings.yMin));
  const column = Math.max(0, Math.min(result.nx - 1, Math.floor(xFraction * result.nx)));
  const row = Math.max(0, Math.min(result.ny - 1, Math.floor(yFraction * result.ny)));
  return result.values[row * result.nx + column];
}

function drawGravitySectionProfile(width, pad, plotWidth) {
  const gravity = ensureGravity();
  if (!gravity.enabled || !sceneLayerVisible("gravity")) return;
  const result = computeGravityPreview();
  const section = activeSectionPath();
  const metrics = sectionPathMetrics(section);
  const samples = Array.from({ length: 121 }, (_, index) => {
    const fraction = index / 120;
    return { fraction, value: sampleGravityResult(pointAlongSectionPath(fraction * metrics.total, section, metrics), result) };
  }).filter(sample => Number.isFinite(sample.value));
  if (samples.length < 2) return;
  const min = Math.min(...samples.map(sample => sample.value));
  const max = Math.max(...samples.map(sample => sample.value));
  const range = Math.max(1e-9, max - min);
  const bandTop = 34;
  const bandHeight = Math.max(48, Math.min(76, pad.top - bandTop - 14));
  context.save();
  context.fillStyle = state.appearance.theme === "light" ? "rgba(255,255,255,.82)" : "rgba(5,12,16,.82)";
  context.fillRect(pad.left, bandTop, plotWidth, bandHeight);
  context.strokeStyle = state.appearance.theme === "light" ? "#6a53b8" : "#b8a6ff";
  context.lineWidth = 2;
  context.beginPath();
  samples.forEach((sample, index) => {
    const x = pad.left + sample.fraction * plotWidth;
    const y = bandTop + bandHeight - 8 - ((sample.value - min) / range) * (bandHeight - 22);
    if (index) context.lineTo(x, y); else context.moveTo(x, y);
  });
  context.stroke();
  context.fillStyle = state.appearance.theme === "light" ? "#342858" : "#d8d0ff";
  context.font = "600 8px ui-monospace";
  context.fillText(`${gravityFieldLabel(gravity.field).toUpperCase()} · ${min.toFixed(2)} to ${max.toFixed(2)} ${result.unit}`, pad.left + 7, bandTop + 11);
  context.restore();
}

function sectionTopographyElevation(point) {
  const topography = state.topography;
  if (!sceneLayerVisible("topography") || state.settings.topographyMode !== "terrain"
    || !topography?.values?.length || topography.values.length !== topography.width * topography.height) return null;
  const bounds = terrainBounds();
  const inside = point[0] >= bounds.west && point[0] <= bounds.east
    && point[1] >= bounds.south && point[1] <= bounds.north;
  return inside ? sampleTopographyValue(point, topography) : null;
}

function sectionTopographySamples(section, metrics, count = 181) {
  const topography = state.topography;
  if (!sceneLayerVisible("topography") || state.settings.topographyMode !== "terrain"
    || !topography?.values?.length || topography.values.length !== topography.width * topography.height) return [];
  return Array.from({ length: count }, (_, index) => {
    const fraction = index / Math.max(1, count - 1);
    const point = pointAlongSectionPath(fraction * metrics.total, section, metrics);
    return { fraction, elevation: sectionTopographyElevation(point) };
  });
}

function drawSectionTopographyProfile(section, metrics, pad, plotWidth) {
  const samples = sectionTopographySamples(section, metrics);
  const valid = samples.filter(sample => Number.isFinite(sample.elevation));
  if (valid.length < 2) return;
  const minimum = Math.min(...valid.map(sample => sample.elevation));
  const maximum = Math.max(...valid.map(sample => sample.elevation));
  const elevationLimit = Math.max(1, Math.abs(minimum), Math.abs(maximum));
  const reliefPixels = Math.min(30, Math.max(18, pad.top - 29));
  const pixelsPerMeter = reliefPixels / elevationLimit;
  const seaY = pad.top;
  const groups = [];
  let group = [];
  samples.forEach(sample => {
    if (Number.isFinite(sample.elevation)) group.push(sample);
    else if (group.length) {
      groups.push(group);
      group = [];
    }
  });
  if (group.length) groups.push(group);

  context.save();
  context.strokeStyle = state.appearance.theme === "light" ? "rgba(48,83,92,.58)" : "rgba(174,210,213,.52)";
  context.setLineDash([4, 4]);
  context.beginPath(); context.moveTo(pad.left, seaY); context.lineTo(pad.left + plotWidth, seaY); context.stroke();
  context.setLineDash([]);
  context.globalAlpha = Math.max(.28, Number(state.topography.opacity ?? 70) / 100);
  groups.filter(points => points.length > 1).forEach(points => {
    const firstX = pad.left + points[0].fraction * plotWidth;
    const lastX = pad.left + points.at(-1).fraction * plotWidth;
    context.fillStyle = state.appearance.theme === "light" ? "rgba(104,151,112,.42)" : "rgba(79,143,103,.46)";
    context.beginPath();
    context.moveTo(firstX, seaY);
    points.forEach(sample => {
      const x = pad.left + sample.fraction * plotWidth;
      const y = seaY - sample.elevation * pixelsPerMeter;
      context.lineTo(x, y);
    });
    context.lineTo(lastX, seaY);
    context.closePath();
    context.fill();
    context.strokeStyle = state.appearance.theme === "light" ? "#397c59" : "#7bd49a";
    context.lineWidth = 2;
    context.beginPath();
    points.forEach((sample, index) => {
      const x = pad.left + sample.fraction * plotWidth;
      const y = seaY - sample.elevation * pixelsPerMeter;
      if (index) context.lineTo(x, y); else context.moveTo(x, y);
    });
    context.stroke();
  });
  context.globalAlpha = 1;
  context.fillStyle = state.appearance.theme === "light" ? "#315c48" : "#9bd9b0";
  context.font = "600 8px ui-monospace";
  context.fillText(`TOPOGRAPHY · ${Math.round(minimum)} to ${Math.round(maximum)} m · adaptive vertical scale`, pad.left + 5, 12);
  context.restore();
}

function drawSectionProfile(width, height) {
  const palette = canvasPalette();
  context.fillStyle = palette.deep; context.fillRect(0, 0, width, height);
  const showGravityProfile = ensureGravity().enabled && sceneLayerVisible("gravity");
  const pad = { left: 58, right: 24, top: showGravityProfile ? 128 : 48, bottom: 44 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const visibleFeatures = state.features.filter(featureVisible);
  const maxDepth = Math.max(state.settings.zMax - state.settings.zMin, ...visibleFeatures.map(feature => feature.maxDepth || 0), 1);
  if (sceneLayerVisible("grid")) {
    context.strokeStyle = "#31434b"; context.strokeRect(pad.left, pad.top, plotWidth, plotHeight);
    context.font = "9px ui-monospace"; context.fillStyle = "#71858d";
    for (let i = 0; i <= 5; i++) {
      const y = pad.top + (i / 5) * plotHeight;
      context.strokeStyle = "#1b2b32"; context.beginPath(); context.moveTo(pad.left, y); context.lineTo(width - pad.right, y); context.stroke();
      context.fillText(`${Math.round((i / 5) * maxDepth / 1000)} km`, 8, y + 3);
    }
  }
  const section = activeSectionPath();
  const sectionMetrics = sectionPathMetrics(section);
  const sectionLength = sectionMetrics.total;
  drawSectionTopographyProfile(section, sectionMetrics, pad, plotWidth);
  for (const feature of visibleFeatures) {
    if ((feature.model === "subducting plate" || feature.model === "fault") && !sceneLayerVisible("slabs")) continue;
    const meta = FEATURE_TYPES[feature.model];
    const center = feature.points.reduce((sum, point) => [sum[0] + point[0] / feature.points.length, sum[1] + point[1] / feature.points.length], [0, 0]);
    const t = distanceToSection(center, section);
    const x = pad.left + t * plotWidth;
    const top = pad.top + (feature.minDepth / maxDepth) * plotHeight;
    const bottom = pad.top + (Math.min(feature.maxDepth, maxDepth) / maxDepth) * plotHeight;
    context.fillStyle = state.appearance.renderMode === "temperature" ? temperatureColor(featureTemperature(feature), .42) : `${meta.color}45`;
    context.strokeStyle = state.appearance.renderMode === "temperature" ? temperatureColor(featureTemperature(feature)) : meta.color;
    context.lineWidth = renderOptions.featureContoursOnly ? 2 : featureIsSelected(feature.id) ? 3 : 2;
    if (feature.model === "subducting plate" || feature.model === "fault") {
      const segments = feature.raw?.segments?.length ? feature.raw.segments : [{
        length: feature.segmentLength,
        thickness: [feature.thickness],
        angle: [feature.angle]
      }];
      let currentX = x;
      let currentY = top;
      segments.forEach((segment, segmentIndex) => {
        const angle = Number(segment.angle?.[0] ?? feature.angle);
        const length = Number(segment.length ?? feature.segmentLength);
        const thickness = Number(segment.thickness?.[0] ?? feature.thickness);
        const run = (length * Math.cos(angle * Math.PI / 180) / Math.max(sectionLength, 1)) * plotWidth;
        const drop = (length * Math.sin(angle * Math.PI / 180) / maxDepth) * plotHeight;
        const nextX = Math.min(width - pad.right, currentX + run);
        const nextY = Math.min(pad.top + plotHeight, currentY + drop);
        const bandWidth = Math.max(7, (thickness / maxDepth) * plotHeight);
        if (!renderOptions.featureContoursOnly) {
          context.save();
          context.globalAlpha = .18;
          context.lineWidth = bandWidth;
          context.beginPath(); context.moveTo(currentX, currentY); context.lineTo(nextX, nextY); context.stroke();
          context.restore();
        }
        const segmentLayers = feature.layers || [];
        if (!renderOptions.featureContoursOnly && segmentLayers.length > 1) {
          const dx = nextX - currentX; const dy = nextY - currentY;
          const lengthPixels = Math.max(1, Math.hypot(dx, dy));
          const normal = [-dy / lengthPixels, dx / lengthPixels];
          segmentLayers.map((layer, index) => ({ layer, index })).slice(0, -1)
            .filter(item => featureSublayerVisible(feature, item.index))
            .forEach(({ layer, index: layerIndex }) => {
            const offset = -bandWidth / 2 + (Number(layer.maxDepth) / Math.max(1, thickness)) * bandWidth;
            context.save();
            context.strokeStyle = `hsl(${172 + layerIndex * 31} 48% 62%)`;
            context.lineWidth = 1;
            context.setLineDash([4, 3]);
            context.beginPath();
            context.moveTo(currentX + normal[0] * offset, currentY + normal[1] * offset);
            context.lineTo(nextX + normal[0] * offset, nextY + normal[1] * offset);
            context.stroke();
            context.restore();
            });
        }
        context.lineWidth = renderOptions.featureContoursOnly ? 2 : featureIsSelected(feature.id) ? 3 : 2;
        context.beginPath(); context.moveTo(currentX, currentY); context.lineTo(nextX, nextY); context.stroke();
        context.fillStyle = meta.color; context.font = "700 9px Inter, sans-serif";
        context.fillText(`S${segmentIndex + 1} · ${angle}°`, (currentX + nextX) / 2 + 4, (currentY + nextY) / 2 - 5);
        currentX = nextX; currentY = nextY;
      });
    } else {
      const halfWidth = meta.geometry === "point" ? 10 : 30;
      if (!renderOptions.featureContoursOnly && feature.layers?.length) {
        feature.layers.forEach((layer, layerIndex) => {
          if (!featureSublayerVisible(feature, layerIndex)) return;
          const layerTop = pad.top + (Number(layer.minDepth) / maxDepth) * plotHeight;
          const layerBottom = pad.top + (Math.min(Number(layer.maxDepth), maxDepth) / maxDepth) * plotHeight;
          context.fillStyle = state.appearance.renderMode === "temperature"
            ? temperatureColor(layer.temperature, .72)
            : `hsla(${172 + layerIndex * 31}, 48%, 52%, .32)`;
          context.fillRect(x - halfWidth, layerTop, halfWidth * 2, Math.max(2, layerBottom - layerTop));
        });
      } else if (!renderOptions.featureContoursOnly) {
        context.fillRect(x - halfWidth, top, halfWidth * 2, Math.max(5, bottom - top));
      }
      context.strokeStyle = meta.color;
      context.strokeRect(x - halfWidth, top, halfWidth * 2, Math.max(5, bottom - top));
    }
    if (sceneLayerVisible("labels")) {
      context.fillStyle = palette.text; context.font = "600 9px Inter, sans-serif";
      const stagger = canvas.clientWidth < 520 ? (state.features.indexOf(feature) % 3) * 11 : 0;
      context.fillText(viewportFeatureLabel(feature), x + 5, Math.max(14, top - 5) + stagger);
    }
  }
  context.fillStyle = "#8ea1a8"; context.font = "10px ui-monospace";
  context.fillText(`SECTION · ${section.length} vertices · ${(sectionLength / 1000).toFixed(0)} km`, pad.left, height - 16);
  drawGravitySectionProfile(width, pad, plotWidth);
  if (hoverPoint && hoverPoint[0] >= pad.left && hoverPoint[0] <= width - pad.right && hoverPoint[1] >= pad.top && hoverPoint[1] <= height - pad.bottom) {
    const distance = ((hoverPoint[0] - pad.left) / plotWidth) * sectionLength;
    const depth = ((hoverPoint[1] - pad.top) / plotHeight) * maxDepth;
    context.save();
    context.strokeStyle = "#f0ca66"; context.setLineDash([4, 4]); context.lineWidth = 1;
    context.beginPath(); context.moveTo(hoverPoint[0], pad.top); context.lineTo(hoverPoint[0], height - pad.bottom); context.stroke();
    context.beginPath(); context.moveTo(pad.left, hoverPoint[1]); context.lineTo(width - pad.right, hoverPoint[1]); context.stroke();
    context.setLineDash([]);
    const surfacePoint = pointAlongSectionPath(distance, section, sectionMetrics);
    const surfaceElevation = sectionTopographyElevation(surfacePoint);
    const label = `${(distance / 1000).toFixed(0)} km along · ${(depth / 1000).toFixed(1)} km depth${Number.isFinite(surfaceElevation) ? ` · surface ${Math.round(surfaceElevation)} m` : ""}`;
    context.font = "10px ui-monospace";
    const labelWidth = context.measureText(label).width + 14;
    const labelX = Math.min(width - labelWidth - 8, hoverPoint[0] + 10);
    const labelY = Math.max(24, hoverPoint[1] - 12);
    context.fillStyle = "#0a1216"; context.fillRect(labelX, labelY - 14, labelWidth, 20);
    context.strokeStyle = "#6d633f"; context.strokeRect(labelX, labelY - 14, labelWidth, 20);
    context.fillStyle = "#f0ca66"; context.fillText(label, labelX + 7, labelY);
    context.restore();
  }
}

function drawOne() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  context.clearRect(0, 0, width, height);
  context.fillStyle = canvasPalette().background;
  context.fillRect(0, 0, width, height);
  context.save();
  applyViewTransform();
  if (viewMode === "three-d") {
    draw3DView(width, height);
  } else if (viewMode === "section") {
    drawSectionProfile(width, height);
  } else {
    drawGrid(width, height);
    drawSection();
    drawConnections();
    state.features.filter(featureVisible).forEach(drawFeature);
    drawDraftGeometry();
    drawTerrainSelection();
    drawMarqueeSelection();
  }
  context.restore();
  drawTopographyLegend(width, height);
  drawTemperatureLegend(width, height);
  drawTomographyLegend(width, height);
  drawLithosphereLegend(width);
  drawGravityLegend(width);
}

function renderViewport(name, targetCanvas, targetContext) {
  if (!targetCanvas.clientWidth || !targetCanvas.clientHeight) return;
  canvas = targetCanvas;
  context = targetContext;
  viewMode = viewportModes[name];
  renderCamera = viewportCameras[name];
  drawOne();
}

function draw() {
  renderViewport("primary", primaryCanvas, primaryContext);
  if (state.ui.splitView) renderViewport("secondary", secondaryCanvas, secondaryContext);
  canvas = activeViewport === "primary" ? primaryCanvas : secondaryCanvas;
  context = activeViewport === "primary" ? primaryContext : secondaryContext;
  viewMode = viewportModes[activeViewport];
  renderCamera = viewportCameras[activeViewport];
}

function resizeStandaloneCanvas(target) {
  if (!target) return null;
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const scale = window.devicePixelRatio || 1;
  target.width = Math.floor(rect.width * scale);
  target.height = Math.floor(rect.height * scale);
  const targetContext = target.getContext("2d");
  targetContext.setTransform(scale, 0, 0, scale, 0, 0);
  return targetContext;
}

function renderStandaloneCanvas(target, mode, options = {}) {
  const targetContext = resizeStandaloneCanvas(target);
  if (!targetContext) return;
  const previous = { canvas, context, viewMode, renderCamera, renderOptions };
  canvas = target;
  context = targetContext;
  viewMode = mode;
  renderCamera = viewportCameras.primary;
  renderOptions = {
    featureContoursOnly: false,
    suppressFeatureHandles: false,
    featureVertexHandlesOnly: false,
    suppressGravityLegend: false,
    ...options
  };
  drawOne();
  ({ canvas, context, viewMode, renderCamera, renderOptions } = previous);
}

function renderGravityWorkspace() {
  const dialog = document.querySelector("#gravity-workspace");
  if (!dialog?.open) return;
  const editingContours = Boolean(state.ui.gravityWorkspaceContourEditing);
  const workspaceOptions = {
    featureContoursOnly: Boolean(state.ui.gravityWorkspaceContoursOnly),
    suppressFeatureHandles: Boolean(state.ui.gravityWorkspaceContoursOnly) && !editingContours,
    featureVertexHandlesOnly: editingContours
  };
  renderStandaloneCanvas(gravityMapCanvas, "plan", workspaceOptions);
  renderStandaloneCanvas(gravity3DCanvas, "three-d", workspaceOptions);
  renderStandaloneCanvas(gravitySectionCanvas, "section", { ...workspaceOptions, suppressGravityLegend: true });
}

function syncWorkspaceDock() {
  const dock = document.querySelector("#workspace-dock");
  const minimized = Boolean(state.ui?.gravityWorkspaceMinimized);
  dock.classList.toggle("hidden", !minimized);
  dock.setAttribute("aria-hidden", String(!minimized));
}

function syncGravityWorkspaceControls() {
  const contourButton = document.querySelector("#toggle-gravity-feature-contours");
  if (!contourButton) return;
  const contours = Boolean(state.ui.gravityWorkspaceContoursOnly);
  contourButton.classList.toggle("active", contours);
  contourButton.setAttribute("aria-pressed", String(contours));
  contourButton.textContent = contours ? "◎ Contours only · On" : "◎ Contours only";
  const sectionButton = document.querySelector("#gravity-draw-section");
  const sectionPicking = Boolean(state.ui.gravityWorkspaceSectionPicking);
  sectionButton.classList.toggle("active", sectionPicking);
  sectionButton.setAttribute("aria-pressed", String(sectionPicking));
  sectionButton.textContent = sectionPicking
    ? `✓ Finish section · ${sectionDraft.length} point${sectionDraft.length === 1 ? "" : "s"}`
    : "⌁ Draw section";
  const editButton = document.querySelector("#gravity-edit-contours");
  const editing = Boolean(state.ui.gravityWorkspaceContourEditing);
  editButton.classList.toggle("active", editing);
  editButton.setAttribute("aria-pressed", String(editing));
  editButton.textContent = editing ? "◇ Edit contours · On" : "◇ Edit contours";
  const gravity = ensureGravity();
  document.querySelector("#gravity-workspace-field").value = gravity.field;
  const fieldLabel = gravityFieldLabel(gravity.field);
  document.querySelector("#gravity-map-pane-title").textContent = sectionPicking
    ? `Click map to trace section · ${sectionDraft.length} point${sectionDraft.length === 1 ? "" : "s"}`
    : editing ? `Drag feature vertices · ${fieldLabel}` : `Map · ${fieldLabel}`;
  document.querySelector("#gravity-section-pane-title").textContent =
    `Section · ${fieldLabel} profile above density structure`;
  gravityMapCanvas.style.cursor = sectionPicking || editing ? "crosshair" : "move";
}

function openGravityWorkspace({ recompute = false } = {}) {
  const gravity = ensureGravity();
  gravity.enabled = true;
  state.sceneLayers.gravity = true;
  state.sceneLayers.legend = true;
  if (recompute) {
    gravity.signature = null;
    computeGravityPreview(true);
  }
  state.ui.gravityWorkspaceMinimized = false;
  const layout = state.ui.gravityWorkspaceLayout || "triple";
  document.querySelector("#gravity-workspace-layout").value = layout;
  document.querySelector("#gravity-workspace-grid").dataset.layout = layout;
  syncGravityWorkspaceControls();
  syncGravityUI();
  syncWorkspaceDock();
  persist();
  const dialog = document.querySelector("#gravity-workspace");
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(renderGravityWorkspace);
}

function minimizeGravityWorkspace() {
  const dialog = document.querySelector("#gravity-workspace");
  state.ui.gravityWorkspaceMinimized = true;
  state.ui.gravityWorkspaceLayout = document.querySelector("#gravity-workspace-grid").dataset.layout || "triple";
  if (dialog.open) dialog.close();
  syncWorkspaceDock();
  persist();
  showToast("Gravity workspace minimized · results preserved");
}

function gravityWorkspaceMapPoint(target, event) {
  const previous = { canvas, context, viewMode, renderCamera };
  canvas = target;
  context = target.getContext("2d");
  viewMode = "plan";
  renderCamera = viewportCameras.primary;
  const rect = target.getBoundingClientRect();
  const canvasPoint = screenPointToCanvas(event.clientX - rect.left, event.clientY - rect.top);
  const worldPoint = canvasToWorld(...canvasPoint);
  ({ canvas, context, viewMode, renderCamera } = previous);
  return { canvasPoint, worldPoint };
}

function gravityWorkspaceFeatureHit(target, event) {
  const previous = { canvas, context, viewMode, renderCamera };
  canvas = target;
  context = target.getContext("2d");
  viewMode = "plan";
  renderCamera = viewportCameras.primary;
  const rect = target.getBoundingClientRect();
  const point = screenPointToCanvas(event.clientX - rect.left, event.clientY - rect.top);
  let nearest = null;
  state.features.filter(featureVisible).forEach(feature => {
    feature.points.forEach((worldPoint, vertexIndex) => {
      const projected = worldToCanvas(worldPoint);
      const distance = Math.hypot(projected[0] - point[0], projected[1] - point[1]);
      if (!nearest || distance < nearest.distance) nearest = { feature, vertexIndex, distance };
    });
  });
  const feature = hitFeature(point);
  ({ canvas, context, viewMode, renderCamera } = previous);
  return { nearest: nearest?.distance <= 15 ? nearest : null, feature };
}

function bindGravityWorkspaceCanvas(target, mode) {
  target.addEventListener("wheel", event => {
    event.preventDefault();
    viewportCameras.primary.zoom = Math.max(.2, Math.min(8, viewportCameras.primary.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1)));
    renderGravityWorkspace();
  }, { passive: false });
  target.addEventListener("pointerdown", event => {
    if (mode === "plan" && event.button === 0 && !event.shiftKey && state.ui.gravityWorkspaceSectionPicking) {
      event.preventDefault();
      const { worldPoint } = gravityWorkspaceMapPoint(target, event);
      const precision = state.settings.coordinateSystem === "spherical" ? 1e5 : 1;
      sectionDraft.push(worldPoint.map(value => Math.round(value * precision) / precision));
      if (sectionDraft.length >= 2) state.sectionPath = sectionDraft.map(point => [...point]);
      syncGravityWorkspaceControls();
      persist();
      draw();
      renderGravityWorkspace();
      return;
    }
    if (mode === "plan" && event.button === 0 && !event.shiftKey && state.ui.gravityWorkspaceContourEditing) {
      event.preventDefault();
      const { nearest, feature } = gravityWorkspaceFeatureHit(target, event);
      const targetFeature = nearest?.feature || feature;
      if (targetFeature) {
        selectedId = targetFeature.id;
        selectedIds = new Set([targetFeature.id]);
        renderInspector();
        renderNavigator();
      }
      if (nearest) {
        commitHistory();
        gravityWorkspaceGeometryDrag = {
          target,
          pointerId: event.pointerId,
          featureId: nearest.feature.id,
          vertexIndex: nearest.vertexIndex,
          lastCompute: 0
        };
        target.setPointerCapture(event.pointerId);
        target.style.cursor = "crosshair";
      }
      renderGravityWorkspace();
      return;
    }
    gravityWorkspaceDrag = { target, mode, x: event.clientX, y: event.clientY };
    target.setPointerCapture(event.pointerId);
    target.style.cursor = "grabbing";
  });
  target.addEventListener("pointermove", event => {
    if (gravityWorkspaceGeometryDrag?.target === target) {
      const feature = state.features.find(item => item.id === gravityWorkspaceGeometryDrag.featureId);
      if (!feature) return;
      const { worldPoint } = gravityWorkspaceMapPoint(target, event);
      feature.points[gravityWorkspaceGeometryDrag.vertexIndex] = worldPoint;
      feature.geometryEdited = true;
      const gravity = ensureGravity();
      gravity.signature = null;
      const now = performance.now();
      if (now - gravityWorkspaceGeometryDrag.lastCompute > 80) {
        gravityWorkspaceGeometryDrag.lastCompute = now;
        computeGravityPreview(true);
      }
      draw();
      renderGravityWorkspace();
      return;
    }
    if (!gravityWorkspaceDrag || gravityWorkspaceDrag.target !== target) return;
    const dx = event.clientX - gravityWorkspaceDrag.x;
    const dy = event.clientY - gravityWorkspaceDrag.y;
    gravityWorkspaceDrag.x = event.clientX; gravityWorkspaceDrag.y = event.clientY;
    if (mode === "three-d" && !event.shiftKey) {
      viewportCameras.primary.orbitYaw += dx * .45;
      viewportCameras.primary.orbitPitch = Math.max(-80, Math.min(80, viewportCameras.primary.orbitPitch + dy * .35));
    } else {
      viewportCameras.primary.panX += dx;
      viewportCameras.primary.panY += dy;
    }
    renderGravityWorkspace();
  });
  const finish = () => {
    if (gravityWorkspaceGeometryDrag?.target === target) {
      gravityWorkspaceGeometryDrag = null;
      computeGravityPreview(true);
      updateAll();
      syncGravityUI();
      target.style.cursor = "crosshair";
      showToast("Feature contour updated · gravity recomputed");
      return;
    }
    gravityWorkspaceDrag = null;
    target.style.cursor = mode === "three-d" ? "grab"
      : state.ui.gravityWorkspaceSectionPicking || state.ui.gravityWorkspaceContourEditing ? "crosshair" : "move";
  };
  target.addEventListener("pointerup", finish);
  target.addEventListener("pointercancel", finish);
  target.style.cursor = mode === "three-d" ? "grab"
    : state.ui.gravityWorkspaceSectionPicking || state.ui.gravityWorkspaceContourEditing ? "crosshair" : "move";
}

function hitFeature(point) {
  const [x, y] = point;
  for (let index = state.features.length - 1; index >= 0; index--) {
    const feature = state.features[index];
    if (!featureVisible(feature)) continue;
    const projected = feature.points.map(worldToCanvas);
    const center = projected.reduce((sum, p) => [sum[0] + p[0] / projected.length, sum[1] + p[1] / projected.length], [0, 0]);
    const radius = FEATURE_TYPES[feature.model].geometry === "point" ? 55 : Math.max(28, ...projected.map(p => Math.hypot(p[0] - center[0], p[1] - center[1])));
    if (Math.hypot(x - center[0], y - center[1]) <= radius) return feature;
  }
  return null;
}

function updateSelectionCount() {
  const count = document.querySelector("#feature-count");
  if (!count) return;
  count.textContent = `${state.features.length} feature${state.features.length === 1 ? "" : "s"}${selectedIds.size > 1 ? ` · ${selectedIds.size} selected` : ""}`;
}

function revealSelectedFeatureProperties() {
  if (!selectedId) return;
  if (state.ui.inspectorCollapsed) {
    state.ui.inspectorCollapsed = false;
    applyWorkspaceUI();
  }
  const propertiesButton = document.querySelector('[data-tab="properties"]');
  if (!propertiesButton.classList.contains("active")) propertiesButton.click();
  requestAnimationFrame(() => {
    const inspector = document.querySelector(".inspector");
    const featurePanel = document.querySelector("#feature-inspector");
    if (!inspector || !featurePanel) return;
    const top = featurePanel.getBoundingClientRect().top - inspector.getBoundingClientRect().top + inspector.scrollTop - 12;
    inspector.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  });
}

function selectFeature(id, additive = false, preserveGroup = false) {
  if (!id) {
    selectedId = null;
    selectedIds.clear();
    selectedPointIndex = null;
  } else if (additive) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    selectedId = selectedIds.has(id) ? id : selectedIds.values().next().value || null;
    selectedPointIndex = null;
  } else if (preserveGroup && selectedIds.has(id)) {
    selectedId = id;
    selectedPointIndex = null;
  } else {
    if (selectedId !== id) selectedPointIndex = null;
    selectedId = id;
    selectedIds = new Set([id]);
  }
  renderInspector();
  renderNavigator();
  updateSelectionCount();
  draw();
  revealSelectedFeatureProperties();
}

function finishMarqueeSelection() {
  if (!marqueeSelection) return;
  const left = Math.min(marqueeSelection.start[0], marqueeSelection.current[0]);
  const right = Math.max(marqueeSelection.start[0], marqueeSelection.current[0]);
  const top = Math.min(marqueeSelection.start[1], marqueeSelection.current[1]);
  const bottom = Math.max(marqueeSelection.start[1], marqueeSelection.current[1]);
  const moved = right - left > 4 || bottom - top > 4;
  const matches = moved ? state.features.filter(featureVisible).filter(feature => {
    const points = feature.points.map(worldToCanvas);
    const xs = points.map(point => point[0]); const ys = points.map(point => point[1]);
    const featureLeft = Math.min(...xs); const featureRight = Math.max(...xs);
    const featureTop = Math.min(...ys); const featureBottom = Math.max(...ys);
    return featureRight >= left && featureLeft <= right && featureBottom >= top && featureTop <= bottom;
  }).map(feature => feature.id) : [];
  if (!marqueeSelection.additive) selectedIds.clear();
  matches.forEach(id => selectedIds.add(id));
  selectedId = matches.at(-1) || selectedIds.values().next().value || null;
  selectedPointIndex = null;
  marqueeSelection = null;
  renderInspector();
  renderNavigator();
  updateSelectionCount();
  draw();
  revealSelectedFeatureProperties();
  if (matches.length) showToast(`${selectedIds.size} features selected · drag any selected feature to move the group`);
}

function duplicateSelectedFeature() {
  const source = state.features.find(feature => feature.id === selectedId);
  if (!source) return showToast("Select a feature to duplicate");
  const duplicate = structuredClone(source);
  const offsetX = (state.settings.xMax - state.settings.xMin) * .035;
  const offsetY = (state.settings.yMax - state.settings.yMin) * .035;
  duplicate.id = `feature-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  duplicate.name = `${source.name} copy`;
  duplicate.points = duplicate.points.map(([x, y]) => [x + offsetX, y + offsetY]);
  if (duplicate.dipPoint) duplicate.dipPoint = [duplicate.dipPoint[0] + offsetX, duplicate.dipPoint[1] + offsetY];
  state.features.push(duplicate);
  selectedId = duplicate.id;
  selectedIds = new Set([duplicate.id]);
  selectedPointIndex = null;
  updateAll();
  showToast(`${source.name} duplicated`);
}

function deleteSelectedFeature() {
  const feature = state.features.find(item => item.id === selectedId);
  if (!feature) return showToast("Select a feature to delete");
  const removing = selectedIds.size ? new Set(selectedIds) : new Set([feature.id]);
  state.features = state.features.filter(item => !removing.has(item.id));
  state.connections = state.connections.filter(pair => !pair.some(id => removing.has(id)));
  selectedId = state.features.at(-1)?.id || null;
  selectedIds = selectedId ? new Set([selectedId]) : new Set();
  selectedPointIndex = null;
  updateAll();
  showToast(`${removing.size} feature${removing.size === 1 ? "" : "s"} deleted · Undo is available`);
}

function configureNewFeatureCoordinates(feature, center) {
  const geometry = FEATURE_TYPES[feature.model].geometry;
  const shape = geometry === "area" ? state.ui.areaPlacementShape
    : geometry === "line" ? state.ui.linePlacementShape : "point";
  feature.points = createPlacementPoints(
    geometry, center[0], center[1], shape,
    state.settings.coordinateSystem === "spherical"
  );
  feature.placementShape = shape;
  feature.smooth = shape === "ellipse" || shape === "curved";
  const spherical = state.settings.coordinateSystem === "spherical";
  if (geometry === "point" && spherical) {
    feature.semiMajorAxis = 2;
  }
  if (feature.dipPoint && spherical) feature.dipPoint = [center[0], Math.min(90, center[1] + 5)];
}

function placementShapeLabel(geometry) {
  const shape = geometry === "area" ? state.ui.areaPlacementShape
    : geometry === "line" ? state.ui.linePlacementShape : "point";
  return shape.replace("rectangle", "rectangle").replace("segmented", "segmented");
}

function updatePlacementShapeUI() {
  const area = document.querySelector("#area-placement-shape");
  const line = document.querySelector("#line-placement-shape");
  area.value = state.ui.areaPlacementShape || "rectangle";
  line.value = state.ui.linePlacementShape || "straight";
  document.querySelector("#placement-shape-preview").innerHTML = `
    <span class="placement-area-preview ${area.value}" title="${area.selectedOptions[0].text}"></span>
    <span class="placement-line-preview ${line.value}" title="${line.selectedOptions[0].text}"></span>`;
}

function bindPlacementShapePicker() {
  updatePlacementShapeUI();
  [
    ["area-placement-shape", "areaPlacementShape"],
    ["line-placement-shape", "linePlacementShape"]
  ].forEach(([id, key]) => document.querySelector(`#${id}`).addEventListener("change", event => {
    state.ui[key] = event.target.value;
    updatePlacementShapeUI();
    renderPalette();
    persist();
    showToast(`${event.target.selectedOptions[0].text} selected for new ${key.startsWith("area") ? "area features" : "line features"}`);
  }));
}

function nextFeaturePlacement() {
  const positions = [
    [.30, .32], [.53, .31], [.72, .44], [.35, .62],
    [.59, .64], [.48, .47], [.76, .67], [.24, .49]
  ];
  const [x, y] = positions[state.features.length % positions.length];
  const cycle = Math.floor(state.features.length / positions.length);
  return [
    canvas.clientWidth * x + (cycle % 3 - 1) * 18,
    canvas.clientHeight * y + (cycle % 2 ? 14 : 0)
  ];
}

function addFeature(model, screenX, screenY) {
  const world = canvasToWorld(...screenPointToCanvas(screenX, screenY));
  const feature = createFeature(model, world[0], world[1], state.features.length);
  configureNewFeatureCoordinates(feature, world);
  state.features.push(feature);
  activateTemperaturePreview();
  selectFeature(feature.id);
  updateAll();
  const shape = placementShapeLabel(FEATURE_TYPES[model].geometry);
  showToast(`${FEATURE_TYPES[model].label} added · ${shape} · ${feature.points.length} vertices`);
}

function renderPalette() {
  const palette = document.querySelector("#feature-palette");
  palette.innerHTML = Object.entries(FEATURE_TYPES).map(([model, meta]) => `
    <div class="feature-card" draggable="true" role="button" tabindex="0" aria-label="Add ${meta.label}" data-model="${model}" style="--feature:${meta.color}">
      <span class="feature-icon">${meta.icon}</span>
      <div><strong>${meta.label}</strong><small>${meta.geometry} · ${placementShapeLabel(meta.geometry)}</small></div>
      <span class="drag-dots">•••</span>
    </div>`).join("");
  palette.querySelectorAll(".feature-card").forEach(card => {
    card.addEventListener("dragstart", event => event.dataTransfer.setData("text/gwb-feature", card.dataset.model));
    card.addEventListener("click", () => addFeature(card.dataset.model, ...nextFeaturePlacement()));
    card.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      addFeature(card.dataset.model, ...nextFeaturePlacement());
    });
  });
}

function renderNavigator() {
  const navigator = document.querySelector("#model-navigator");
  document.querySelector("#navigator-count").textContent = `${state.features.length} item${state.features.length === 1 ? "" : "s"}`;
  if (!state.features.length) {
    navigator.innerHTML = `<div class="navigator-empty">Added and imported features appear here.</div>`;
    return;
  }
  navigator.innerHTML = state.features.map(feature => {
    const meta = FEATURE_TYPES[feature.model];
    return `<div class="navigator-item ${featureIsSelected(feature.id) ? "selected" : ""}" draggable="true" data-feature-id="${feature.id}" style="--feature:${meta.color}">
      <span class="navigator-swatch"></span><span>${feature.name}</span><span class="navigator-vertices">${feature.points.length}v</span><span class="navigator-drag">••</span>
    </div>`;
  }).join("");
  navigator.querySelectorAll(".navigator-item").forEach(item => {
    item.addEventListener("click", event => selectFeature(item.dataset.featureId, event.metaKey || event.ctrlKey));
    item.addEventListener("dragstart", event => event.dataTransfer.setData("text/gwb-navigator-id", item.dataset.featureId));
    item.addEventListener("dragover", event => event.preventDefault());
    item.addEventListener("drop", event => {
      event.preventDefault();
      const sourceId = event.dataTransfer.getData("text/gwb-navigator-id");
      const sourceIndex = state.features.findIndex(feature => feature.id === sourceId);
      const targetIndex = state.features.findIndex(feature => feature.id === item.dataset.featureId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
      const [moved] = state.features.splice(sourceIndex, 1);
      state.features.splice(targetIndex, 0, moved);
      updateAll();
    });
  });
}

function renderLayersPanel() {
  state.sceneLayers = { ...DEFAULT_SCENE_LAYERS, ...(state.sceneLayers || {}) };
  state.layerGroups = Array.isArray(state.layerGroups) ? state.layerGroups : [];
  const validGroups = new Set(state.layerGroups.map(group => group.id));
  state.features.forEach(feature => {
    if (feature.layerGroup && !validGroups.has(feature.layerGroup)) feature.layerGroup = null;
  });
  document.querySelectorAll("[data-scene-layer]").forEach(input => {
    input.checked = sceneLayerVisible(input.dataset.sceneLayer);
  });
  const visibleCount = state.features.filter(feature => featureVisible(feature)).length;
  document.querySelector("#visible-layer-count").textContent = `${visibleCount} of ${state.features.length} visible`;
  const list = document.querySelector("#feature-layer-list");
  if (!state.features.length) {
    list.innerHTML = `<div class="navigator-empty">Add features to control them independently.</div>`;
    return;
  }
  const featureItem = feature => {
    const meta = FEATURE_TYPES[feature.model];
    const individuallyVisible = feature.visible !== false;
    const visible = featureVisible(feature);
    const sublayers = (feature.layers || []).map((layer, index) => `
      <label class="feature-sublayer">
        <input type="checkbox" data-layer-feature="${feature.id}" data-sublayer-index="${index}" ${featureSublayerVisible(feature, index) ? "checked" : ""}>
        <span>${escapeHtml(layer.name || `Layer ${index + 1}`)}</span>
      </label>`).join("");
    return `<div class="feature-layer-item" style="--feature:${meta.color}">
      <button class="feature-layer-main ${visible ? "" : "is-hidden"}" data-toggle-feature-layer="${feature.id}" aria-pressed="${visible}">
        <span class="visibility-eye">${individuallyVisible ? "◉" : "○"}</span>
        <span class="navigator-swatch"></span>
        <strong>${escapeHtml(feature.name)}</strong>
        <small>${escapeHtml(meta.label)}</small>
      </button>
      <label class="feature-group-picker"><span>Group</span><select data-feature-group="${feature.id}">
        <option value="">Ungrouped</option>
        ${state.layerGroups.map(group => `<option value="${group.id}" ${feature.layerGroup === group.id ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("")}
      </select></label>
      ${sublayers ? `<div class="feature-sublayers">${sublayers}</div>` : ""}
    </div>`;
  };
  const groupBlocks = state.layerGroups.map(group => {
    const features = state.features.filter(feature => feature.layerGroup === group.id);
    const visible = group.visible !== false;
    return `<section class="feature-layer-group ${visible ? "" : "is-hidden"}">
      <div class="feature-layer-group-header">
        <button data-toggle-layer-group="${group.id}" class="group-visibility ghost" title="Show or hide this group">${visible ? "◉" : "○"}</button>
        <input data-layer-group-name="${group.id}" value="${escapeHtml(group.name)}" aria-label="Layer group name">
        <small>${features.length}</small>
        <button data-add-selection-group="${group.id}" class="ghost" title="Move selected features into this group">＋</button>
        <button data-remove-layer-group="${group.id}" class="ghost" title="Remove group without deleting features">×</button>
      </div>
      <div class="feature-layer-group-items">${features.length ? features.map(featureItem).join("") : `<div class="group-empty">Empty group · select features and press ＋</div>`}</div>
    </section>`;
  }).join("");
  const ungrouped = state.features.filter(feature => !feature.layerGroup);
  list.innerHTML = `${groupBlocks}${ungrouped.length ? `<section class="ungrouped-features"><small>UNGROUPED</small>${ungrouped.map(featureItem).join("")}</section>` : ""}`;
  list.querySelectorAll("[data-toggle-feature-layer]").forEach(button => button.addEventListener("click", () => {
    const feature = state.features.find(item => item.id === button.dataset.toggleFeatureLayer);
    if (!feature) return;
    feature.visible = feature.visible === false;
    renderLayersPanel(); persist(); draw();
  }));
  list.querySelectorAll("[data-feature-group]").forEach(select => select.addEventListener("change", () => {
    const feature = state.features.find(item => item.id === select.dataset.featureGroup);
    if (!feature) return;
    feature.layerGroup = select.value || null;
    renderLayersPanel(); persist(); draw();
  }));
  list.querySelectorAll("[data-toggle-layer-group]").forEach(button => button.addEventListener("click", () => {
    const group = state.layerGroups.find(item => item.id === button.dataset.toggleLayerGroup);
    if (!group) return;
    group.visible = group.visible === false;
    renderLayersPanel(); persist(); draw();
  }));
  list.querySelectorAll("[data-layer-group-name]").forEach(input => input.addEventListener("change", () => {
    const group = state.layerGroups.find(item => item.id === input.dataset.layerGroupName);
    if (!group) return;
    group.name = input.value.trim() || "Layer group";
    renderLayersPanel(); persist();
  }));
  list.querySelectorAll("[data-add-selection-group]").forEach(button => button.addEventListener("click", () => {
    const ids = selectedIds.size ? selectedIds : selectedId ? new Set([selectedId]) : new Set();
    if (!ids.size) return showToast("Select one or more features first");
    state.features.forEach(feature => {
      if (ids.has(feature.id)) feature.layerGroup = button.dataset.addSelectionGroup;
    });
    renderLayersPanel(); persist(); draw();
    showToast(`${ids.size} feature${ids.size === 1 ? "" : "s"} moved to group`);
  }));
  list.querySelectorAll("[data-remove-layer-group]").forEach(button => button.addEventListener("click", () => {
    const id = button.dataset.removeLayerGroup;
    state.features.forEach(feature => {
      if (feature.layerGroup === id) feature.layerGroup = null;
    });
    state.layerGroups = state.layerGroups.filter(group => group.id !== id);
    renderLayersPanel(); persist(); draw();
    showToast("Layer group removed · features kept");
  }));
  list.querySelectorAll("[data-sublayer-index]").forEach(input => input.addEventListener("change", () => {
    const feature = state.features.find(item => item.id === input.dataset.layerFeature);
    if (!feature) return;
    const index = Number(input.dataset.sublayerIndex);
    const hidden = new Set(feature.hiddenSublayers || []);
    if (input.checked) hidden.delete(index); else hidden.add(index);
    feature.hiddenSublayers = [...hidden].sort((a, b) => a - b);
    persist(); draw();
  }));
}

function inputField(label, key, value, options = {}) {
  const type = options.type || "number";
  const step = options.step ? `step="${options.step}"` : "";
  return `<label>${label}<input data-feature-key="${key}" type="${type}" value="${value}" ${step}></label>`;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function layerRange(feature) {
  return feature.model === "subducting plate" || feature.model === "fault"
    ? [0, Number(feature.thickness)]
    : [Number(feature.minDepth), Number(feature.maxDepth)];
}

function layerEditor(feature) {
  const layers = feature.layers || [];
  const [rangeTop, rangeBottom] = layerRange(feature);
  const preset = geologicalLayerPreset(feature);
  const depthMeaning = feature.model === "subducting plate"
    ? "distance below the slab top"
    : feature.model === "fault" ? "distance from the fault center" : "depth below the surface";
  return `
    <div class="field-group layer-editor">
      <div class="layer-title">
        <div><h3>Internal layers</h3><p>${depthMeaning} · ${(rangeTop / 1000).toFixed(0)}–${(rangeBottom / 1000).toFixed(0)} km</p></div>
        <span>${layers.length || 1} layer${(layers.length || 1) === 1 ? "" : "s"}</span>
      </div>
      <div class="layer-create">
        <label>Number of layers<input id="layer-count" type="number" min="1" max="12" value="${Math.max(2, layers.length || preset.length || 3)}"></label>
        <button id="split-layers" class="primary">Split equally</button>
      </div>
      ${preset.length ? `<button id="apply-layer-preset" class="wide preset-button">Apply ${feature.model === "continental plate" ? "continental lithosphere" : "oceanic lithosphere"} preset</button>` : ""}
      <div class="layer-scale" aria-hidden="true">
        ${(layers.length ? layers : [{ minDepth: rangeTop, maxDepth: rangeBottom }]).map((layer, index) => {
          const span = Math.max(1, rangeBottom - rangeTop);
          const fraction = Math.max(.08, (Number(layer.maxDepth) - Number(layer.minDepth)) / span);
          return `<i style="--layer-index:${index};flex:${fraction}"></i>`;
        }).join("")}
      </div>
      <div id="layer-list" class="layer-list">
        ${layers.map((layer, index) => `
          <div class="layer-row" data-layer-index="${index}">
            <div class="layer-row-title"><strong><i style="--layer-index:${index}"></i>Layer ${index + 1}</strong><button data-remove-layer="${index}" class="ghost" title="Remove layer">×</button></div>
            <label>Symbolic name<input data-layer-key="name" data-layer-index="${index}" type="text" value="${escapeHtml(layer.name || `Layer ${index + 1}`)}"></label>
            <div class="form-grid">
              <label>Top (km)<input data-layer-key="minDepth" data-layer-index="${index}" type="number" step="1" value="${Number(layer.minDepth) / 1000}"></label>
              <label>Bottom (km)<input data-layer-key="maxDepth" data-layer-index="${index}" type="number" step="1" value="${Number(layer.maxDepth) / 1000}"></label>
              <label>Composition<input data-layer-key="composition" data-layer-index="${index}" type="number" min="0" step="1" value="${Number(layer.composition)}"></label>
              <label>Temperature (K)<input data-layer-key="temperature" data-layer-index="${index}" type="number" step="10" value="${Number(layer.temperature)}"></label>
              <label>Density (kg/m³)<input data-layer-key="density" data-layer-index="${index}" type="number" min="0" step="10" value="${Number(layer.density || feature.referenceDensity || 3300)}"></label>
            </div>
          </div>`).join("")}
      </div>
      <div class="layer-actions">
        <button id="add-layer" class="ghost">Add depth interval</button>
        ${layers.length ? `<button id="clear-layers" class="ghost">Remove split</button>` : ""}
      </div>
      <p class="layer-note">${layers.length ? "Layer values override the single composition and thermal fields above." : "Split equally, or add intervals and type exact top and bottom depths."}</p>
    </div>`;
}

function syncCompositionCount() {
  const highest = Math.max(0, ...state.features.flatMap(feature => [
    Number(feature.composition) || 0,
    ...(feature.layers || []).map(layer => Number(layer.composition) || 0)
  ]));
  state.settings.compositions = Math.max(Number(state.settings.compositions) || 1, highest + 1);
}

function bindLayerEditor(panel, feature) {
  panel.querySelector("#apply-layer-preset")?.addEventListener("click", () => {
    feature.layers = geologicalLayerPreset(feature);
    feature.maxDepth = Math.max(...feature.layers.map(layer => Number(layer.maxDepth)));
    feature.densityEnabled = true;
    feature.densityEdited = true;
    feature.layersEdited = true;
    feature.layerMode = "preset";
    syncCompositionCount();
    updateAll();
    showToast(`${feature.name} geological preset applied`);
  });
  panel.querySelector("#split-layers")?.addEventListener("click", () => {
    const count = Math.max(1, Math.min(12, Number(panel.querySelector("#layer-count").value) || 1));
    const [top, bottom] = layerRange(feature);
    const thickness = Math.max(1, bottom - top);
    feature.layers = Array.from({ length: count }, (_, index) => ({
      name: `Layer ${index + 1}`,
      minDepth: top + thickness * index / count,
      maxDepth: top + thickness * (index + 1) / count,
      composition: Number(feature.composition) + index,
      temperature: Number(feature.temperature),
      density: Number(feature.referenceDensity || 3300)
    }));
    feature.layersEdited = true;
    feature.layerMode = "count";
    syncCompositionCount();
    updateAll();
    showToast(`${feature.name} split into ${count} layers`);
  });
  panel.querySelector("#add-layer")?.addEventListener("click", () => {
    const [top, bottom] = layerRange(feature);
    const previous = feature.layers?.at(-1);
    const minDepth = previous ? Number(previous.maxDepth) : top;
    feature.layers = [...(feature.layers || []), {
      name: `Layer ${(feature.layers?.length || 0) + 1}`,
      minDepth,
      maxDepth: Math.max(minDepth + 1000, previous ? minDepth + 50000 : bottom),
      composition: Number(feature.composition) + (feature.layers?.length || 0),
      temperature: Number(feature.temperature),
      density: Number(feature.referenceDensity || 3300)
    }];
    feature.layersEdited = true;
    if (key === "density") {
      feature.densityEnabled = true;
      feature.densityEdited = true;
    }
    feature.layerMode = "depths";
    syncCompositionCount();
    updateAll();
  });
  panel.querySelector("#clear-layers")?.addEventListener("click", () => {
    feature.layers = [];
    feature.layersEdited = true;
    updateAll();
    showToast("Layer split removed");
  });
  panel.querySelectorAll("[data-remove-layer]").forEach(button => button.addEventListener("click", () => {
    feature.layers.splice(Number(button.dataset.removeLayer), 1);
    feature.layersEdited = true;
    updateAll();
  }));
  panel.querySelectorAll("[data-layer-key]").forEach(input => input.addEventListener("input", () => {
    const layer = feature.layers[Number(input.dataset.layerIndex)];
    const key = input.dataset.layerKey;
    layer[key] = key === "name" ? input.value
      : (key === "minDepth" || key === "maxDepth") ? Number(input.value) * 1000
        : Number(input.value);
    feature.layersEdited = true;
    feature.layerMode = "depths";
    syncCompositionCount();
    updateAll(false);
  }));
}

function renderInspector() {
  const panel = document.querySelector("#feature-inspector");
  const feature = state.features.find(item => item.id === selectedId);
  if (!feature) {
    panel.innerHTML = `<div class="inspector-placeholder"><span>◇</span><strong>No feature selected</strong><p>Select a feature on the canvas to edit its geometry, temperature and composition.</p></div>`;
    return;
  }
  const meta = FEATURE_TYPES[feature.model];
  const massConserving = feature.model === "subducting plate" ? `<option value="mass conserving" ${feature.temperatureModel === "mass conserving" ? "selected" : ""}>Mass conserving</option>` : "";
  const subductionFields = feature.model === "subducting plate" || feature.model === "fault" ? `
    <div class="field-group"><h3>${feature.model === "fault" ? "Fault" : "Slab"} geometry</h3><div class="form-grid">
      ${inputField("Segment length (km)", "segmentLength:km", feature.segmentLength / 1000)}
      ${inputField("Thickness (km)", "thickness:km", feature.thickness / 1000)}
      ${inputField("Dip angle (°)", "angle", feature.angle)}
      ${feature.model === "subducting plate" ? inputField("Subduction velocity (m/yr)", "subductingVelocity", feature.subductingVelocity, { step: "0.01" }) : ""}
    </div></div>` : "";
  const plumeFields = feature.model === "plume" ? `
    <div class="field-group"><h3>Plume geometry</h3><div class="form-grid">
      ${inputField("Tip depth (km)", "crossSectionDepth:km", feature.crossSectionDepth / 1000)}
      ${inputField("Radius (km)", "semiMajorAxis:km", feature.semiMajorAxis / 1000)}
      ${inputField("Eccentricity", "eccentricity", feature.eccentricity, { step: "0.05" })}
    </div></div>` : "";
  const densityFields = `
    <div class="field-group density-editor"><h3>Density model <span class="framework-badge">GWB framework</span></h3>
      <label class="checkbox-row"><input data-feature-key="densityEnabled" type="checkbox" ${feature.densityEnabled ? "checked" : ""}> Enable uniform composition density</label>
      <div class="form-grid ${feature.densityEnabled ? "" : "density-fields-muted"}">
        ${inputField("Reference density (kg/m³)", "referenceDensity", feature.referenceDensity || 3300, { step: "10" })}
        <label>Operation<select data-feature-key="densityOperation">
          ${["replace", "replace defined only", "add", "subtract"].map(operation => `<option value="${operation}" ${feature.densityOperation === operation ? "selected" : ""}>${operation}</option>`).join("")}
        </select></label>
      </div>
      <p class="layer-note">Density is attached to composition ${Number(feature.composition)}. Internal layers can define a density for each composition.</p>
    </div>`;
  const multiSelection = selectedIds.size > 1
    ? `<div class="multi-selection-note"><strong>${selectedIds.size} features selected</strong><span>Editing applies to ${escapeHtml(feature.name)}. Drag any selected feature to move the complete group.</span></div>`
    : "";
  panel.innerHTML = `
    <div class="selected-title" style="--feature:${meta.color}">
      <span class="feature-icon">${meta.icon}</span>
      <div><strong>${feature.name}</strong><small>${meta.label} · ${feature.points.length} ${feature.points.length === 1 ? "vertex" : "vertices"}</small></div>
      <div class="selected-actions">
        <button class="duplicate-feature ghost" title="Duplicate feature (Ctrl/Cmd+D)">Duplicate</button>
        <button class="delete-feature" title="Delete selected feature(s) (Delete/Backspace)">Delete</button>
      </div>
    </div>
    ${multiSelection}
    <div class="field-group"><h3>Identity & extent</h3>
      <div class="form-grid">
        ${inputField("Name", "name", feature.name, { type: "text" })}
        ${inputField("Composition index", "composition", feature.composition)}
        ${inputField("Min depth (km)", "minDepth:km", feature.minDepth / 1000)}
        ${inputField("Max depth (km)", "maxDepth:km", feature.maxDepth / 1000)}
      </div>
    </div>
    ${subductionFields}${plumeFields}
    <div class="field-group"><h3>Thermal model</h3>
      <div class="form-grid">
        <label>Model<select data-feature-key="temperatureModel">
          <option value="uniform" ${feature.temperatureModel === "uniform" ? "selected" : ""}>Uniform</option>
          <option value="linear" ${feature.temperatureModel === "linear" ? "selected" : ""}>Linear</option>
          ${massConserving}
        </select></label>
        ${inputField("Temperature (K)", "temperature", feature.temperature)}
      </div>
    </div>
    ${densityFields}
    ${layerEditor(feature)}
    <details class="advanced-editor">
      <summary>Advanced feature parameters <span>Lossless JSON</span></summary>
      <div class="advanced-editor-content">
        <textarea id="advanced-feature-json" spellcheck="false">${escapeHtml(JSON.stringify(featureToWorldBuilder(feature), null, 2))}</textarea>
        <div id="advanced-json-message" class="validation-message"></div>
        <button id="apply-advanced-json" class="wide ghost">Apply advanced JSON</button>
      </div>
    </details>`;
  panel.querySelectorAll("[data-feature-key]").forEach(input => input.addEventListener("input", onFeatureInput));
  bindLayerEditor(panel, feature);
  panel.querySelector(".duplicate-feature").addEventListener("click", duplicateSelectedFeature);
  panel.querySelector(".delete-feature").addEventListener("click", deleteSelectedFeature);
  panel.querySelector("#apply-advanced-json").addEventListener("click", () => {
    const message = panel.querySelector("#advanced-json-message");
    try {
      const parsed = JSON.parse(panel.querySelector("#advanced-feature-json").value);
      if (!FEATURE_TYPES[parsed.model]) throw new Error("Unsupported or missing feature model.");
      const index = state.features.findIndex(item => item.id === feature.id);
      const imported = importFeature(parsed, index);
      imported.id = feature.id;
      state.features[index] = imported;
      updateAll();
      showToast("Advanced parameters applied");
    } catch (error) {
      message.textContent = error.message;
    }
  });
}

function onFeatureInput(event) {
  const feature = state.features.find(item => item.id === selectedId);
  const [key, unit] = event.target.dataset.featureKey.split(":");
  let value = event.target.type === "checkbox" ? event.target.checked
    : event.target.type === "text" || event.target.tagName === "SELECT" ? event.target.value : Number(event.target.value);
  if (unit === "km") value *= 1000;
  feature[key] = value;
  if (key === "temperatureModel" || key === "temperature" || key === "spreadingVelocity" || key === "subductingVelocity") feature.thermalEdited = true;
  if (key === "composition") feature.compositionEdited = true;
  if (key === "densityEnabled" || key === "referenceDensity" || key === "densityOperation") feature.densityEdited = true;
  if (key === "segmentLength" || key === "thickness" || key === "angle") feature.segmentEdited = true;
  if (key === "crossSectionDepth" || key === "semiMajorAxis" || key === "eccentricity") feature.plumeGeometryEdited = true;
  updateAll(false);
  if (key === "temperatureModel" || key === "densityEnabled") renderInspector();
}

function updateGridSummary() {
  const summary = document.querySelector("#grid-summary");
  if (!summary) return;
  const grid = state.settings.coordinateSystem === "spherical" ? "Spherical chunk" : "Cartesian";
  const dimension = Number(state.settings.dimension) === 3 ? "3D" : "2D";
  const cells = Number(state.settings.dimension) === 3
    ? `${state.settings.cellsX}×${state.settings.cellsY}×${state.settings.cellsZ}`
    : `${state.settings.cellsX}×${state.settings.cellsZ}`;
  summary.textContent = `${grid} · ${dimension} · ${cells}`;
}

function syncSettingsForm() {
  const spherical = state.settings.coordinateSystem === "spherical";
  const fields = {
    "grid-type": ["gridType", 1], dimension: ["dimension", 1],
    "x-min": ["xMin", spherical ? 1 : 1000], "x-max": ["xMax", spherical ? 1 : 1000],
    "y-min": ["yMin", spherical ? 1 : 1000], "y-max": ["yMax", spherical ? 1 : 1000],
    "z-min": ["zMin", 1000], "z-max": ["zMax", 1000],
    "cells-x": ["cellsX", 1], "cells-y": ["cellsY", 1], "cells-z": ["cellsZ", 1]
  };
  Object.entries(fields).forEach(([id, [key, scale]]) => {
    const input = document.querySelector(`#${id}`);
    input.value = Number(state.settings[key]) / scale;
    input.oninput = () => {
      const value = input.tagName === "SELECT" ? input.value : Number(input.value) * scale;
      state.settings[key] = key === "dimension" ? Number(value) : value;
      if (key === "gridType") {
        state.settings.coordinateSystem = value === "chunk" ? "spherical" : "cartesian";
        if (!state.features.length) {
          if (value === "chunk") Object.assign(state.settings, { xMin: -20, xMax: 20, yMin: -15, yMax: 15 });
          else Object.assign(state.settings, { xMin: 0, xMax: 1000000, yMin: 0, yMax: 600000 });
        }
        syncSettingsForm();
        showToast(value === "chunk" ? "Longitude/latitude mode enabled" : "Cartesian surface coordinates enabled");
      }
      updateAll(false);
    };
  });
  document.querySelectorAll(".y-field").forEach(field => field.classList.remove("hidden"));
  const labels = spherical
    ? { "x-min-label": "Longitude min (°)", "x-max-label": "Longitude max (°)", "y-min-label": "Latitude min (°)", "y-max-label": "Latitude max (°)", "z-min-label": "Minimum depth (km)", "z-max-label": "Maximum depth (km)" }
    : { "x-min-label": "Surface X min (km)", "x-max-label": "Surface X max (km)", "y-min-label": "Surface Y min (km)", "y-max-label": "Surface Y max (km)", "z-min-label": "Minimum depth (km)", "z-max-label": "Maximum depth (km)" };
  Object.entries(labels).forEach(([id, text]) => { document.querySelector(`#${id}`).textContent = text; });
  document.querySelector("#coordinate-readout").textContent = spherical ? "lon 0.00° · lat 0.00°" : "x 0 km · y 0 km";
  updateGridSummary();
  syncGeographicBoundsUI();
  if (state.background) syncMapEditor();
}

function fitDomainToFeatures() {
  const points = state.features.flatMap(feature => feature.points || []);
  if (!points.length) return;
  const xs = points.map(point => point[0]);
  const zs = points.map(point => point[1]);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minZ = Math.min(...zs); const maxZ = Math.max(...zs);
  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  state.settings.xMin = minX - spanX * .12;
  state.settings.xMax = maxX + spanX * .12;
  state.settings.yMin = minZ - spanZ * .12;
  state.settings.yMax = maxZ + spanZ * .12;
}

function loadWorld(world, grid = "") {
  const appearance = { ...DEFAULT_APPEARANCE, ...(state.appearance || {}) };
  const topography = { ...DEFAULT_TOPOGRAPHY, ...(state.topography || {}) };
  const paleogeography = { ...DEFAULT_PALEOGEOGRAPHY, ...(state.paleogeography || {}) };
  const sceneLayers = { ...DEFAULT_SCENE_LAYERS, ...(state.sceneLayers || {}) };
  const gravity = { ...DEFAULT_GRAVITY, ...(state.gravity || {}), result: null, signature: null };
  const tomography = { ...DEFAULT_TOMOGRAPHY, ...(state.tomography || {}) };
  const lithosphere = { ...DEFAULT_LITHOSPHERE, ...(state.lithosphere || {}) };
  const provenance = {
    tomographyModelIds: Array.isArray(state.provenance?.tomographyModelIds) ? [...state.provenance.tomographyModelIds] : [],
    lithosphereModelIds: Array.isArray(state.provenance?.lithosphereModelIds) ? [...state.provenance.lithosphereModelIds] : []
  };
  const exportOptions = { ...DEFAULT_EXPORT_OPTIONS, ...(state.exportOptions || {}) };
  const colorMaps = structuredClone(ensureColorMaps());
  const ui = { ...DEFAULT_UI, ...(state.ui || {}) };
  state = importWorldBuilder(world);
  state.appearance = appearance;
  state.topography = topography;
  state.paleogeography = paleogeography;
  state.sceneLayers = sceneLayers;
  state.gravity = gravity;
  state.tomography = tomography;
  state.lithosphere = lithosphere;
  state.provenance = provenance;
  state.exportOptions = exportOptions;
  state.colorMaps = colorMaps;
  state.colorMapVersion = COLOR_MAP_VERSION;
  state.layerGroups = [];
  state.ui = ui;
  state.sectionPath = state.settings.section?.map(point => [...point]) || [];
  referenceImage = null;
  if (grid) state.settings = applyGridConfig(state.settings, grid);
  else fitDomainToFeatures();
  selectedId = state.features[0]?.id || null;
  selectedIds = selectedId ? new Set([selectedId]) : new Set();
  syncSettingsForm();
  syncGravityUI();
  updateAll();
}

function renderExamples() {
  const grid = document.querySelector("#example-grid");
  const query = exampleQuery.trim().toLowerCase();
  const filtered = examples.filter(example => {
    const matchesCategory = exampleCategory === "all" || example.category === exampleCategory;
    const haystack = `${example.title} ${example.category} ${example.source} ${example.models.join(" ")}`.toLowerCase();
    return matchesCategory && (!query || haystack.includes(query));
  });
  document.querySelector("#example-summary").textContent = `${filtered.length} of ${examples.length} models · tutorials, cookbooks, and tested reference files`;
  grid.innerHTML = filtered.slice(0, 180).map(example => `
    <article class="example-card" data-example-id="${example.id}">
      <span class="category">${example.category}</span>
      <strong>${escapeHtml(example.title)}</strong>
      <p>${example.coordinateSystem} · ${example.featureCount} feature${example.featureCount === 1 ? "" : "s"}</p>
      <div class="example-tags">${example.models.slice(0, 4).map(model => `<span>${escapeHtml(model)}</span>`).join("")}</div>
    </article>`).join("");
  grid.querySelectorAll(".example-card").forEach(card => card.addEventListener("click", () => {
    const example = examples.find(item => item.id === card.dataset.exampleId);
    if (!example) return;
    loadWorld(example.world, example.grid);
    document.querySelector("#examples-dialog").close();
    showToast(`${example.title} loaded`);
  }));
}

async function loadExampleCatalog() {
  try {
    const response = await fetchWithProgress("./examples/catalog.json", {}, "Loading GWB example library");
    examples = await response.json();
    const categories = [...new Set(examples.map(example => example.category))];
    document.querySelector("#example-category").innerHTML = `<option value="all">All collections</option>${categories.map(category => `<option value="${category}">${category}</option>`).join("")}`;
    renderExamples();
  } catch {
    document.querySelector("#example-summary").textContent = "The example library could not be loaded.";
  }
}

function selectedTomographyReferences() {
  const ids = new Set(state.provenance?.tomographyModelIds || []);
  state.features.forEach(feature => {
    if (feature.tomographySource?.model) ids.add(feature.tomographySource.model);
  });
  if (state.tomography?.grid?.model) ids.add(state.tomography.grid.model);
  return [...ids].map(tomographyModelById).filter(Boolean);
}

function selectedLithosphereReferences() {
  const ids = new Set(state.provenance?.lithosphereModelIds || []);
  if (state.lithosphere?.grid?.sourceModelId) ids.add(state.lithosphere.grid.sourceModelId);
  return [...ids].map(lithosphereModelById).filter(Boolean);
}

function selectedPlanetaryReference() {
  const body = planetaryBodyById(state.settings.planetaryBody);
  if (!body) return [];
  return [{
    name: `${body.name} planetary constants and data catalog`,
    citation: `${body.name} body preset · constants compiled from NASA/NSSDCA and dataset links from NASA PDS/USGS Astrogeology`,
    citationUrl: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/",
    sourceUrl: body.data[0]?.[1]
  }];
}

function buildWbText() {
  const world = buildWorldBuilder(state.settings, featuresWithTopography(), state.rawWorld);
  const notes = [
    `${state.settings.coordinateSystem === "spherical" ? "Spherical chunk" : "Cartesian"} model with ${state.features.length} feature${state.features.length === 1 ? "" : "s"}.`
  ];
  const planetaryBody = planetaryBodyById(state.settings.planetaryBody);
  if (planetaryBody) {
    notes.push(`${planetaryBody.name} preset: radius ${(planetaryBody.radius / 1000).toFixed(1)} km and uniform gravity ${planetaryBody.gravity} m/s². Thermal values are editable modelling assumptions.`);
  }
  if (state.tomography?.grid) {
    notes.push(`Tomography overlay: ${state.tomography.grid.model} at ${state.tomography.grid.depth} km (${state.tomography.scalarField}).`);
  } else if (state.tomography?.sourceMode === "image-fallback") {
    notes.push("A rendered tomography depth slice was used as visual drawing context; its raster is not embedded in this .wb file.");
  }
  if (state.features.some(feature => feature.tomographySource)) {
    notes.push("One or more feature geometries were interpreted from a tomography iso-region; inspect each feature before simulation.");
  }
  if (state.lithosphere?.grid) {
    notes.push(`Lithosphere overlay: ${state.lithosphere.grid.model}, field ${state.lithosphere.grid.field}; the preview grid is drawing context and is not embedded in this .wb file.`);
  }
  return serializeWorldBuilder(world, {
    notes,
    references: [...selectedTomographyReferences(), ...selectedLithosphereReferences(), ...selectedPlanetaryReference()]
  }, {
    includeComments: state.exportOptions?.comments !== false,
    includeReferences: state.exportOptions?.references !== false
  });
}

function renderOutput() {
  const errors = validateProject(state.settings, state.features);
  const summary = document.querySelector("#validation-summary");
  summary.className = `validation ${errors.length ? "bad" : "good"}`;
  summary.textContent = errors.length ? errors.join(" ") : "Valid project";
  document.querySelector("#wb-export-options").classList.toggle("hidden", outputKind !== "wb");
  const commentsInput = document.querySelector("#export-comments");
  const referencesInput = document.querySelector("#export-references");
  commentsInput.checked = state.exportOptions?.comments !== false;
  referencesInput.checked = state.exportOptions?.references !== false;
  referencesInput.disabled = !commentsInput.checked;
  document.querySelector("#output-code").textContent = outputKind === "wb" ? buildWbText() : buildGrid(state.settings);
}

function updateAll(rerenderInspector = true) {
  commitHistory();
  persist();
  if (rerenderInspector) renderInspector();
  renderNavigator();
  renderLayersPanel();
  renderOutput();
  const hasDrawingContext = Object.values(state.paleogeography?.layers || {})
    .some(collection => collection?.features?.length)
    || Boolean(state.topography?.imageSrc)
    || state.topography?.values?.length === state.topography?.width * state.topography?.height
    || Boolean(state.settings.planetaryPresetActive);
  document.querySelector("#empty-state").classList.toggle("hidden", state.features.length > 0 || hasDrawingContext);
  updateSelectionCount();
  const coordinateScale = state.settings.coordinateSystem === "spherical" ? 1 : 1000;
  const dx = (state.settings.xMax - state.settings.xMin) / state.settings.cellsX / coordinateScale;
  const dy = (state.settings.yMax - state.settings.yMin) / Math.max(1, state.settings.cellsY) / coordinateScale;
  const dz = (state.settings.zMax - state.settings.zMin) / state.settings.cellsZ / 1000;
  document.querySelector("#cell-size").textContent = state.settings.coordinateSystem === "spherical"
    ? `${dx.toFixed(2)}° lon × ${dy.toFixed(2)}° lat · ${dz.toFixed(1)} km depth`
    : `${dx.toFixed(1)} × ${dy.toFixed(1)} km surface · ${dz.toFixed(1)} km depth`;
  updateGridSummary();
  draw();
  if (document.querySelector("#gravity-workspace")?.open) requestAnimationFrame(renderGravityWorkspace);
}

function download(name, content, type) {
  const activity = startActivity(`Preparing ${name}`);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
  requestAnimationFrame(() => finishActivity(activity, `${name} download started`, "success"));
}

function downloadBlob(name, blob) {
  const activity = startActivity(`Preparing ${name}`);
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  requestAnimationFrame(() => finishActivity(activity, `${name} download started`, "success"));
}

function formatBytes(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

function startActivity(label, total = 0) {
  const token = ++activitySequence;
  clearTimeout(activityHideTimer);
  const panel = document.querySelector("#activity-progress");
  panel.classList.remove("hidden", "success", "error");
  panel.classList.toggle("indeterminate", !(total > 0));
  document.querySelector("#activity-progress-label").textContent = label;
  document.querySelector("#activity-progress-percent").textContent = total > 0 ? "0%" : "";
  document.querySelector("#activity-progress-fill").style.width = total > 0 ? "0%" : "";
  return token;
}

function updateActivity(token, loaded, total = 0, label = "") {
  if (token !== activitySequence) return;
  const panel = document.querySelector("#activity-progress");
  if (label) document.querySelector("#activity-progress-label").textContent = label;
  if (total > 0) {
    const percent = Math.min(100, Math.round(loaded / total * 100));
    panel.classList.remove("indeterminate");
    document.querySelector("#activity-progress-percent").textContent = `${percent}% · ${formatBytes(loaded)} / ${formatBytes(total)}`;
    document.querySelector("#activity-progress-fill").style.width = `${percent}%`;
  } else {
    panel.classList.add("indeterminate");
    document.querySelector("#activity-progress-percent").textContent = loaded ? formatBytes(loaded) : "";
  }
}

function finishActivity(token, label, kind = "success") {
  if (token !== activitySequence) return;
  const panel = document.querySelector("#activity-progress");
  panel.classList.remove("indeterminate");
  panel.classList.add(kind);
  document.querySelector("#activity-progress-label").textContent = label;
  document.querySelector("#activity-progress-percent").textContent = kind === "success" ? "Done" : "Failed";
  document.querySelector("#activity-progress-fill").style.width = "100%";
  activityHideTimer = setTimeout(() => panel.classList.add("hidden"), kind === "success" ? 1100 : 2600);
}

async function fetchWithProgress(input, init = {}, label = "Loading data") {
  const activity = startActivity(label);
  try {
    const response = await fetch(input, init);
    if (!response.body) {
      finishActivity(activity, response.ok ? `${label} complete` : `${label} failed`, response.ok ? "success" : "error");
      return response;
    }
    const total = Number(response.headers.get("content-length")) || 0;
    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      updateActivity(activity, loaded, total, label);
    }
    finishActivity(activity, response.ok ? `${label} complete` : `${label} failed`, response.ok ? "success" : "error");
    return new Response(new Blob(chunks), {
      status: response.status, statusText: response.statusText, headers: response.headers
    });
  } catch (error) {
    finishActivity(activity, error.name === "AbortError" ? `${label} cancelled` : `${label} failed`, "error");
    throw error;
  }
}

function readFileWithProgress(file, label = `Opening ${file.name}`) {
  const activity = startActivity(label, file.size);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = event => updateActivity(activity, event.loaded, event.lengthComputable ? event.total : file.size, label);
    reader.onload = () => {
      finishActivity(activity, `${file.name} opened`, "success");
      resolve(String(reader.result));
    };
    reader.onerror = () => {
      finishActivity(activity, `${file.name} could not be opened`, "error");
      reject(reader.error || new Error("File reading failed."));
    };
    reader.readAsText(file);
  });
}

function screenshotName(prefix) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${stamp}.png`;
}

function composeCanvasLayout(entries, container) {
  const scale = window.devicePixelRatio || 1;
  const containerRect = container.getBoundingClientRect();
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(containerRect.width * scale));
  output.height = Math.max(1, Math.round(containerRect.height * scale));
  const outputContext = output.getContext("2d");
  outputContext.fillStyle = state.appearance.theme === "light" ? "#eef2f3" : "#0c1217";
  outputContext.fillRect(0, 0, output.width, output.height);
  entries.forEach(({ source, label }) => {
    const rect = source.getBoundingClientRect();
    if (!rect.width || !rect.height || getComputedStyle(source.parentElement).display === "none") return;
    const x = Math.round((rect.left - containerRect.left) * scale);
    const y = Math.round((rect.top - containerRect.top) * scale);
    const width = Math.round(rect.width * scale);
    const height = Math.round(rect.height * scale);
    outputContext.drawImage(source, x, y, width, height);
    if (label) {
      outputContext.fillStyle = state.appearance.theme === "light" ? "rgba(255,255,255,.86)" : "rgba(8,16,20,.86)";
      outputContext.fillRect(x + 12 * scale, y + 12 * scale, Math.max(90, label.length * 7) * scale, 24 * scale);
      outputContext.fillStyle = state.appearance.theme === "light" ? "#172126" : "#edf3f0";
      outputContext.font = `600 ${11 * scale}px Inter, sans-serif`;
      outputContext.fillText(label, x + 20 * scale, y + 28 * scale);
    }
  });
  return output;
}

function canvasToPngBlob(target) {
  return new Promise((resolve, reject) => {
    try {
      target.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG encoding failed")), "image/png");
    } catch (error) {
      reject(error);
    }
  });
}

async function exportModelScreenshot() {
  try {
    draw();
    const entries = [{ source: primaryCanvas, label: state.ui.splitView ? `A · ${viewportModes.primary}` : "" }];
    if (state.ui.splitView) entries.push({ source: secondaryCanvas, label: `B · ${viewportModes.secondary}` });
    const image = composeCanvasLayout(entries, document.querySelector(".viewport-grid"));
    downloadBlob(screenshotName("gwb-model-view"), await canvasToPngBlob(image));
    showToast("Model-view PNG saved");
  } catch {
    showToast("Screenshot blocked by an external image without export permission");
  }
}

async function exportGravityScreenshot() {
  try {
    renderGravityWorkspace();
    const grid = document.querySelector("#gravity-workspace-grid");
    const entries = [
      { source: gravityMapCanvas, label: "Gravity map" },
      { source: gravity3DCanvas, label: "3D density model + anomaly" },
      { source: gravitySectionCanvas, label: "Section profile" }
    ];
    const image = composeCanvasLayout(entries, grid);
    downloadBlob(screenshotName(`gwb-gravity-${grid.dataset.layout}`), await canvasToPngBlob(image));
    showToast("Gravity-workspace PNG saved");
  } catch {
    showToast("Gravity screenshot could not be encoded");
  }
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1600);
}

function researchCategoryLabel(category) {
  return ({ interface: "Implemented", manual: "Manual", example: "Example" })[category] || category;
}

function openResearchAction(action) {
  const targets = {
    shape: "#toggle-shape-editor",
    tomography: "#toggle-tomography",
    gravity: "#toggle-gravity",
    topography: '[data-palette-tab="topography"]',
    section: '[data-tool="section"]',
    exports: '[data-tab="output"]'
  };
  if (action === "paleogeography") {
    document.querySelector('[data-palette-tab="topography"]').click();
    document.querySelector("#paleogeography-details")?.setAttribute("open", "");
  } else if (targets[action]) {
    document.querySelector(targets[action])?.click();
  }
  showToast("Opened the matching Visual Builder function");
}

function renderResearchResults(payload) {
  const container = document.querySelector("#research-results");
  const summary = document.querySelector("#research-summary");
  const results = payload.results || [];
  summary.textContent = payload.query
    ? `${results.length} relevant result${results.length === 1 ? "" : "s"} for “${payload.query}”.`
    : "Browse implemented functions, or search the manual and bundled examples.";
  summary.className = `tomography-status ${results.length ? "success" : ""}`.trim();
  container.innerHTML = results.length ? results.map(result => `
    <article class="research-result">
      <strong>${escapeHtml(result.title)}</strong>
      <span class="research-badge">${escapeHtml(researchCategoryLabel(result.category))}</span>
      <p>${escapeHtml(result.snippet || "")}</p>
      ${result.path ? `<code title="${escapeHtml(result.path)}">${escapeHtml(result.path)}</code>` : ""}
      ${result.action ? `<button class="ghost" data-research-action="${escapeHtml(result.action)}">Open function</button>` : ""}
    </article>`).join("") : `<div class="navigator-empty">No local match. Try fewer words, another scope, or use the Manual and GitHub links below.</div>`;
  container.querySelectorAll("[data-research-action]").forEach(button => button.addEventListener("click", () => openResearchAction(button.dataset.researchAction)));
  document.querySelector("#research-manual-link").href = payload.links?.manual || "https://gwb.readthedocs.io/";
  document.querySelector("#research-github-link").href = payload.links?.github || "https://github.com/GeodynamicWorldBuilder/WorldBuilder/";
}

async function runResearchSearch() {
  const query = document.querySelector("#research-query").value.trim();
  const scope = document.querySelector("#research-scope").value;
  const summary = document.querySelector("#research-summary");
  summary.textContent = "Searching the local GWB knowledge index…";
  summary.className = "tomography-status loading";
  try {
    const response = await fetchWithProgress(
      `/api/research/search?${new URLSearchParams({ q: query, scope })}`, {}, "Searching GWB documentation"
    );
    if (!response.ok) throw new Error(await response.text());
    renderResearchResults(await response.json());
  } catch (error) {
    summary.textContent = `Research search failed: ${error.message}`;
    summary.className = "tomography-status error";
  }
}

function tomographyValues() {
  return {
    model: document.querySelector("#tomography-model").value,
    depth: Number(document.querySelector("#tomography-depth").value),
    range: Number(document.querySelector("#tomography-range").value),
    nx: Number(document.querySelector("#tomography-nx").value),
    ny: Number(document.querySelector("#tomography-ny").value),
    west: Number(document.querySelector("#tomography-west").value),
    east: Number(document.querySelector("#tomography-east").value),
    south: Number(document.querySelector("#tomography-south").value),
    north: Number(document.querySelector("#tomography-north").value)
  };
}

function validateTomography(values) {
  if (![values.depth, values.range, values.nx, values.ny, values.west, values.east, values.south, values.north].every(Number.isFinite)) {
    return "Enter numeric depth, range and bounds.";
  }
  if (values.depth < 0 || values.depth > 2890) return "Depth must be between 0 and 2890 km.";
  if (values.range <= 0 || values.west < -180 || values.east > 180 || values.south < -90 || values.north > 90) {
    return "The color range or geographic bounds are outside their valid range.";
  }
  if (values.west >= values.east || values.south >= values.north) return "West/south bounds must be smaller than east/north bounds.";
  if (values.nx < 16 || values.nx > 181 || values.ny < 12 || values.ny > 121) return "Grid samples exceed the supported 16–181 by 12–121 range.";
  return "";
}

function setTomographyStatus(message, kind = "") {
  const status = document.querySelector("#tomography-status");
  status.textContent = message;
  status.className = `tomography-status ${kind}`.trim();
}

function addTomographyReference(modelId) {
  if (!tomographyModelById(modelId)) return;
  state.provenance ||= { tomographyModelIds: [] };
  state.provenance.tomographyModelIds ||= [];
  if (!state.provenance.tomographyModelIds.includes(modelId)) {
    state.provenance.tomographyModelIds.push(modelId);
  }
}

function toggleTomographyReference(modelId) {
  state.provenance ||= { tomographyModelIds: [] };
  const ids = new Set(state.provenance.tomographyModelIds || []);
  if (ids.has(modelId)) ids.delete(modelId);
  else ids.add(modelId);
  state.provenance.tomographyModelIds = [...ids];
  persist();
  renderTomographyCatalog();
  renderOutput();
}

function renderTomographyCatalog() {
  const list = document.querySelector("#tomography-catalog-list");
  if (!list) return;
  const query = document.querySelector("#tomography-catalog-search")?.value || "";
  const provider = document.querySelector("#tomography-catalog-provider")?.value || "all";
  const models = searchTomographyModels(query, provider);
  const references = new Set(state.provenance?.tomographyModelIds || []);
  document.querySelector("#tomography-catalog-count").textContent = `${models.length}/${TOMOGRAPHY_CATALOG.length}`;
  list.innerHTML = models.length ? models.map(model => `
    <article class="tomography-model-card ${references.has(model.id) ? "selected-reference" : ""}" data-model-id="${model.id}">
      <header>
        <div><strong>${escapeHtml(model.name)}</strong><small>${escapeHtml(model.provider)}</small></div>
        <span class="catalog-status ${model.availability}">${escapeHtml(model.availabilityLabel)}</span>
      </header>
      <p>${escapeHtml(model.summary)}</p>
      <div class="catalog-meta">${escapeHtml(model.coverage)} · ${escapeHtml(model.fields.join(", "))}</div>
      <div class="catalog-meta">${escapeHtml(model.formats.join(" · "))}</div>
      <div class="catalog-actions">
        ${model.availability === "download"
          ? `<button data-catalog-reference="${model.id}" class="${references.has(model.id) ? "active" : ""}">${references.has(model.id) ? "Referenced ✓" : "Use reference"}</button>`
          : `<button data-catalog-select="${model.id}">Select model</button>`}
        <a href="${model.sourceUrl}" target="_blank" rel="noreferrer">Data ↗</a>
        <a href="${model.citationUrl}" target="_blank" rel="noreferrer">Paper ↗</a>
      </div>
    </article>`).join("") : `<p class="shape-help">No tomography models match this search.</p>`;

  list.querySelectorAll("[data-catalog-reference]").forEach(button => button.addEventListener("click", () => {
    toggleTomographyReference(button.dataset.catalogReference);
    showToast("Tomography reference updated");
  }));
  list.querySelectorAll("[data-catalog-select]").forEach(button => button.addEventListener("click", () => {
    const model = tomographyModelById(button.dataset.catalogSelect);
    const select = document.querySelector("#tomography-model");
    if (!model || ![...select.options].some(option => option.value === model.id)) return;
    select.value = model.id;
    addTomographyReference(model.id);
    setTomographyStatus(
      model.availability === "numerical"
        ? `${model.name} selected · sampleable numerical values are available.`
        : `${model.name} selected · the current connection provides an attributed rendered depth slice.`,
      "success"
    );
    persist();
    renderTomographyCatalog();
    renderOutput();
  }));
}

function setLithosphereStatus(message, kind = "") {
  const status = document.querySelector("#lithosphere-status");
  status.textContent = message;
  status.className = `tomography-status ${kind}`.trim();
}

function selectLithosphereReference(modelId) {
  const model = lithosphereModelById(modelId);
  if (!model) return;
  state.provenance ||= { tomographyModelIds: [], lithosphereModelIds: [] };
  state.provenance.lithosphereModelIds ||= [];
  if (!state.provenance.lithosphereModelIds.includes(modelId)) state.provenance.lithosphereModelIds.push(modelId);
  state.lithosphere = { ...DEFAULT_LITHOSPHERE, ...(state.lithosphere || {}), selectedModelId: modelId };
  setLithosphereStatus(`${model.name} selected · download its original data, then open a geographic CSV/TXT surface below.`, "success");
  persist();
  renderLithosphereCatalog();
  renderOutput();
}

function renderLithosphereCatalog() {
  const list = document.querySelector("#lithosphere-catalog-list");
  if (!list) return;
  const query = document.querySelector("#lithosphere-catalog-search")?.value || "";
  const provider = document.querySelector("#lithosphere-catalog-provider")?.value || "all";
  const models = searchLithosphereModels(query, provider);
  const references = new Set(state.provenance?.lithosphereModelIds || []);
  document.querySelector("#lithosphere-catalog-count").textContent = `${models.length}/${LITHOSPHERE_CATALOG.length}`;
  list.innerHTML = models.length ? models.map(model => `
    <article class="tomography-model-card ${references.has(model.id) ? "selected-reference" : ""}" data-lithosphere-model-id="${model.id}">
      <header>
        <div><strong>${escapeHtml(model.name)}</strong><small>${escapeHtml(model.provider)}</small></div>
        <span class="catalog-status ${model.availability}">${escapeHtml(model.availabilityLabel)}</span>
      </header>
      <p>${escapeHtml(model.summary)}</p>
      <div class="catalog-meta">${escapeHtml(model.coverage)}</div>
      <div class="catalog-meta">${escapeHtml(model.fields.join(", "))}</div>
      <div class="catalog-meta">${escapeHtml(model.formats.join(" · "))}</div>
      <div class="catalog-actions">
        <button data-lithosphere-select="${model.id}" class="${references.has(model.id) ? "active" : ""}">${references.has(model.id) ? "Source selected ✓" : "Use source"}</button>
        <a href="${model.downloadUrl || model.sourceUrl}" target="_blank" rel="noreferrer">Data ↗</a>
        <a href="${model.citationUrl}" target="_blank" rel="noreferrer">Paper ↗</a>
      </div>
    </article>`).join("") : `<p class="shape-help">No lithosphere models match this search.</p>`;
  list.querySelectorAll("[data-lithosphere-select]").forEach(button => button.addEventListener("click", () => {
    selectLithosphereReference(button.dataset.lithosphereSelect);
  }));
}

function syncLithosphereUI() {
  state.lithosphere = { ...DEFAULT_LITHOSPHERE, ...(state.lithosphere || {}) };
  document.querySelector("#lithosphere-opacity").value = state.lithosphere.opacity;
  document.querySelector("#clear-lithosphere").disabled = !state.lithosphere.grid;
  renderLithosphereCatalog();
}

function renderPlanetaryCatalog() {
  const list = document.querySelector("#planetary-catalog-list");
  if (!list) return;
  const query = document.querySelector("#planetary-catalog-search")?.value || "";
  const family = document.querySelector("#planetary-catalog-family")?.value || "all";
  const bodies = searchPlanetaryBodies(query, family);
  document.querySelector("#planetary-catalog-count").textContent = `${bodies.length}/${PLANETARY_BODY_CATALOG.length}`;
  list.innerHTML = bodies.length ? bodies.map(body => `
    <article class="tomography-model-card planetary-card ${state.settings.planetaryBody === body.id ? "selected-reference" : ""}">
      <header>
        <div><strong><span class="planet-symbol">${body.symbol}</span>${escapeHtml(body.name)}</strong><small>${escapeHtml(body.family)}</small></div>
        <span class="catalog-status ${state.settings.planetaryBody === body.id ? "numerical" : "download"}">${state.settings.planetaryBody === body.id ? "Active body" : "Preset"}</span>
      </header>
      <p>${escapeHtml(body.summary)}</p>
      <div class="planetary-constants">
        <span><small>Radius</small><strong>${(body.radius / 1000).toLocaleString()} km</strong></span>
        <span><small>Gravity</small><strong>${body.gravity} m/s²</strong></span>
        <span><small>Surface</small><strong>${body.surfaceTemperature} K</strong></span>
        <span><small>Model depth</small><strong>${body.modelDepth / 1000} km</strong></span>
      </div>
      <div class="catalog-meta">${escapeHtml(body.fields.join(" · "))}</div>
      <div class="catalog-actions">
        <button data-planet-apply="${body.id}" class="${state.settings.planetaryBody === body.id ? "active" : ""}">${state.settings.planetaryBody === body.id ? "Applied ✓" : "Use body preset"}</button>
        ${body.data.map(([label, url]) => `<a href="${url}" target="_blank" rel="noreferrer">${escapeHtml(label)} ↗</a>`).join("")}
      </div>
    </article>`).join("") : `<p class="shape-help">No planetary bodies match this search.</p>`;
  list.querySelectorAll("[data-planet-apply]").forEach(button => button.addEventListener("click", () => applyPlanetaryBody(button.dataset.planetApply)));
}

function applyPlanetaryBody(bodyId) {
  const body = planetaryBodyById(bodyId);
  if (!body) return;
  Object.assign(state.settings, {
    planetaryBody: body.id,
    planetaryPresetActive: true,
    coordinateSystem: "spherical",
    gridType: "chunk",
    dimension: 3,
    radius: body.radius,
    gravityMagnitude: body.gravity,
    surfaceTemperature: body.surfaceTemperature,
    mantleTemperature: body.mantleTemperature,
    backgroundDensity: body.backgroundDensity,
    zMin: 0,
    zMax: Math.min(body.modelDepth, body.radius * .9),
    xMin: -180,
    xMax: 180,
    yMin: -90,
    yMax: 90,
    cellsX: Math.max(72, Number(state.settings.cellsX) || 72),
    cellsY: Math.max(36, Number(state.settings.cellsY) || 36)
  });
  if (body.id !== "earth") {
    state.sceneLayers = {
      ...DEFAULT_SCENE_LAYERS,
      ...(state.sceneLayers || {}),
      topography: false,
      paleogeography: false,
      referenceMap: false,
      tomography: false,
      lithosphere: false,
      gravity: false
    };
    state.tomography = { ...DEFAULT_TOMOGRAPHY, ...(state.tomography || {}), visible: false };
    state.lithosphere = { ...DEFAULT_LITHOSPHERE, ...(state.lithosphere || {}), visible: false };
    state.paleogeography = { ...DEFAULT_PALEOGEOGRAPHY, ...(state.paleogeography || {}), visible: false };
  }
  viewportModes[activeViewport] = "three-d";
  viewMode = "three-d";
  Object.assign(viewportCameras[activeViewport], {
    zoom: 1, rotation: 0, panX: 0, panY: 0, orbitYaw: -25, orbitPitch: 28
  });
  if (activeViewport === "secondary") {
    state.ui.secondaryView = "three-d";
    state.ui.secondaryCamera = { ...viewportCameras.secondary };
  } else {
    Object.assign(state.appearance, {
      viewZoom: 1, viewRotation: 0, viewPanX: 0, viewPanY: 0, orbitYaw: -25, orbitPitch: 28
    });
  }
  state.gravity = { ...DEFAULT_GRAVITY, ...(state.gravity || {}), referenceDensity: body.backgroundDensity, result: null, signature: null };
  syncSettingsForm();
  updateTopographyUI();
  syncGravityUI();
  document.querySelectorAll("[data-view]").forEach(item => item.classList.toggle("active", item.dataset.view === "three-d"));
  updateViewportLabels();
  updateCameraUI();
  updateAll(false);
  renderPlanetaryCatalog();
  showToast(`${body.name} spherical preset applied${body.id === "earth" ? "" : " · Earth overlays hidden"}`);
}

function installLithosphereTable(table, sourceName) {
  lithosphereTable = table;
  if (state.settings.coordinateSystem !== "spherical") {
    const longitudes = table.rows.map(row => row[table.longitudeIndex]);
    const latitudes = table.rows.map(row => row[table.latitudeIndex]);
    const tableBounds = {
      west: Math.min(...longitudes), east: Math.max(...longitudes),
      south: Math.min(...latitudes), north: Math.max(...latitudes)
    };
    const configured = geographicSourceBounds();
    const overlaps = configured.west < tableBounds.east && configured.east > tableBounds.west
      && configured.south < tableBounds.north && configured.north > tableBounds.south;
    if (!overlaps) {
      Object.assign(state.settings, {
        geographicSourceWest: tableBounds.west,
        geographicSourceEast: tableBounds.east,
        geographicSourceSouth: tableBounds.south,
        geographicSourceNorth: tableBounds.north
      });
      syncGeographicBoundsUI();
    }
  }
  state.lithosphere = { ...DEFAULT_LITHOSPHERE, ...(state.lithosphere || {}), sourceName };
  const field = document.querySelector("#lithosphere-field");
  field.innerHTML = table.fields.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name.replaceAll("_", " "))}</option>`).join("");
  field.disabled = false;
  document.querySelector("#apply-lithosphere-field").disabled = false;
  document.querySelector("#lithosphere-file-name").textContent = `${sourceName} · ${table.rows.length.toLocaleString()} samples`;
  setLithosphereStatus(`${table.fields.length} numerical field${table.fields.length === 1 ? "" : "s"} found. Choose one to preview.`, "success");
  applyLithosphereField();
}

function applyLithosphereField() {
  if (!lithosphereTable) return showToast("Open a geographic table first");
  try {
    const field = document.querySelector("#lithosphere-field").value;
    const geographicGrid = regularLithosphereGrid(lithosphereTable, field);
    const grid = state.settings.coordinateSystem === "spherical"
      ? geographicGrid
      : remapGeographicGridToCartesian(geographicGrid, geographicSourceBounds(), cartesianModelBounds());
    const selectedModel = lithosphereModelById(state.lithosphere?.selectedModelId);
    state.lithosphere = {
      ...DEFAULT_LITHOSPHERE, ...(state.lithosphere || {}), grid: {
        ...grid,
        model: selectedModel?.name || state.lithosphere?.sourceName || "Local lithosphere table",
        sourceModelId: selectedModel?.id || null
      }
    };
    ensureColorMaps().lithosphere.min = grid.min;
    ensureColorMaps().lithosphere.max = grid.max;
    document.querySelector("#clear-lithosphere").disabled = false;
    const mapping = grid.coordinateMapping ? " · geographic window mapped to Cartesian X/Y" : "";
    setLithosphereStatus(`${grid.field} loaded · ${grid.nx} × ${grid.ny} cells · range ${grid.min.toPrecision(4)} to ${grid.max.toPrecision(4)}${mapping}.`, "success");
    persist();
    updateAll(false);
  } catch (error) {
    setLithosphereStatus(error.message, "error");
  }
}

function syncTomographyUI() {
  state.tomography = { ...DEFAULT_TOMOGRAPHY, ...(state.tomography || {}) };
  const values = {
    "tomography-opacity": state.tomography.opacity,
    "tomography-scalar-field": state.tomography.scalarField,
    "tomography-vpvs-ratio": state.tomography.vpVsRatio,
    "tomography-iso-value": state.tomography.isoValue,
    "tomography-iso-mode": state.tomography.isoMode,
    "tomography-iso-thickness": state.tomography.isoThicknessKm
  };
  Object.entries(values).forEach(([id, value]) => { document.querySelector(`#${id}`).value = value; });
  document.querySelector("#tomography-show-iso").checked = Boolean(state.tomography.showIso);
  const hasGrid = Boolean(state.tomography.grid?.values?.length);
  const hasFallback = state.tomography.sourceMode === "image-fallback";
  document.querySelector("#export-tomography-csv").disabled = !hasGrid;
  document.querySelector("#clear-tomography").disabled = !hasGrid && !hasFallback;
  document.querySelector("#tomography-create-feature").disabled = !hasGrid;
  updateTomographyIsoStatus();
  renderTomographyCatalog();
}

function tomographyIsoMask() {
  const grid = state.tomography?.grid;
  if (!grid?.values?.length) return null;
  const width = grid.nx - 1; const height = grid.ny - 1;
  const mask = new Uint8Array(width * height);
  const threshold = Number(state.tomography.isoValue);
  let selected = 0;
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const value = tomographyScalarValue((
        tomographyCell(grid, column, row) + tomographyCell(grid, column + 1, row)
        + tomographyCell(grid, column, row + 1) + tomographyCell(grid, column + 1, row + 1)
      ) / 4);
      const included = state.tomography.isoMode === "below" ? value <= threshold : value >= threshold;
      mask[row * width + column] = included ? 1 : 0;
      if (included) selected++;
    }
  }
  return { mask, width, height, selected };
}

function updateTomographyIsoStatus() {
  const status = document.querySelector("#tomography-iso-status");
  if (!status) return;
  const selection = tomographyIsoMask();
  if (!selection) {
    status.textContent = "Load a numerical grid to extract anomaly geometry.";
    return;
  }
  const field = state.tomography.scalarField === "dvp" ? "derived dVp" : "native dVs";
  status.textContent = `${selection.selected.toLocaleString()} cells selected from ${field} ${state.tomography.isoMode === "below" ? "≤" : "≥"} ${Number(state.tomography.isoValue).toFixed(2)}%. Yellow/cyan lines are the editable-feature boundary preview.`;
}

function tomographyIsoOutline() {
  const grid = state.tomography?.grid;
  const selection = tomographyIsoMask();
  if (!grid || !selection?.selected) return [];
  const { mask, width, height } = selection;
  const included = (column, row) => column >= 0 && column < width && row >= 0 && row < height && mask[row * width + column];
  const edges = [];
  const add = (a, b) => edges.push({ a, b, used: false });
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      if (!included(column, row)) continue;
      if (!included(column, row - 1)) add([column, row], [column + 1, row]);
      if (!included(column + 1, row)) add([column + 1, row], [column + 1, row + 1]);
      if (!included(column, row + 1)) add([column + 1, row + 1], [column, row + 1]);
      if (!included(column - 1, row)) add([column, row + 1], [column, row]);
    }
  }
  const starts = new Map();
  edges.forEach((edge, index) => {
    const key = edge.a.join(",");
    if (!starts.has(key)) starts.set(key, []);
    starts.get(key).push(index);
  });
  const loops = [];
  edges.forEach((edge, startIndex) => {
    if (edge.used) return;
    const loop = [edge.a]; let currentIndex = startIndex;
    while (!edges[currentIndex].used) {
      const current = edges[currentIndex];
      current.used = true;
      loop.push(current.b);
      const next = (starts.get(current.b.join(",")) || []).find(index => !edges[index].used);
      if (next === undefined) break;
      currentIndex = next;
    }
    if (loop.length >= 4) loops.push(loop);
  });
  const outline = loops.sort((a, b) => b.length - a.length)[0] || [];
  const simplified = outline.filter((point, index, points) => {
    if (index === 0 || index === points.length - 1) return true;
    const previous = points[index - 1]; const next = points[index + 1];
    return (point[0] - previous[0]) * (next[1] - point[1]) !== (point[1] - previous[1]) * (next[0] - point[0]);
  });
  const capped = simplified.length > 81
    ? simplified.filter((_, index) => index % Math.ceil(simplified.length / 80) === 0)
    : simplified;
  const dx = (grid.east - grid.west) / Math.max(1, grid.nx - 1);
  const dy = (grid.north - grid.south) / Math.max(1, grid.ny - 1);
  const world = capped.map(([column, row]) => [grid.west + column * dx, grid.north - row * dy]);
  if (world.length > 1 && world[0][0] === world.at(-1)[0] && world[0][1] === world.at(-1)[1]) world.pop();
  return world;
}

function createFeatureFromTomographyIso() {
  const points = tomographyIsoOutline();
  if (points.length < 3) {
    setTomographyStatus("No closed iso-region exists at this threshold. Move the iso-value toward zero.", "error");
    return;
  }
  const center = points.reduce((sum, point) => [sum[0] + point[0] / points.length, sum[1] + point[1] / points.length], [0, 0]);
  const feature = createFeature("mantle layer", center[0], center[1], state.features.length);
  const thickness = Math.max(1, Number(state.tomography.isoThicknessKm)) * 1000;
  const centerDepth = Number(state.tomography.grid.depth) * 1000;
  feature.points = points;
  feature.minDepth = Math.max(0, centerDepth - thickness / 2);
  feature.maxDepth = centerDepth + thickness / 2;
  feature.name = `${state.tomography.scalarField === "dvp" ? "dVp derived" : "dVs"} ${state.tomography.isoMode === "below" ? "≤" : "≥"} ${Number(state.tomography.isoValue).toFixed(2)}% anomaly`;
  feature.tomographySource = {
    model: state.tomography.grid.model, depthKm: state.tomography.grid.depth,
    scalar: state.tomography.scalarField, dvsDvpRatio: Number(state.tomography.vpVsRatio),
    isoValue: Number(state.tomography.isoValue), isoMode: state.tomography.isoMode
  };
  state.features.push(feature);
  selectedId = feature.id;
  selectedIds = new Set([feature.id]);
  viewMode = "plan";
  viewportModes[activeViewport] = "plan";
  document.querySelectorAll("[data-view]").forEach(item => item.classList.toggle("active", item.dataset.view === "plan"));
  updateViewportLabels();
  updateAll();
  revealSelectedFeatureProperties();
  setTomographyStatus(`Created “${feature.name}” with ${points.length} editable vertices and ${state.tomography.isoThicknessKm} km thickness.`, "success");
  showToast("Iso-region converted to an editable GWB feature");
}

function applyTomographyBounds(values = tomographyValues()) {
  const error = validateTomography(values);
  if (error) {
    setTomographyStatus(error, "error");
    return false;
  }
  Object.assign(state.settings, {
    coordinateSystem: "spherical", gridType: "chunk", dimension: 3,
    xMin: values.west, xMax: values.east, yMin: values.south, yMax: values.north,
    zMin: 0, zMax: Math.max(Number(state.settings.zMax) || 0, values.depth * 1000)
  });
  syncSettingsForm();
  updateAll(false);
  return true;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function loadTomographySlice() {
  const values = tomographyValues();
  const error = validateTomography(values);
  if (error) {
    setTomographyStatus(error, "error");
    return;
  }
  tomographyRequest?.abort();
  tomographyRequest = new AbortController();
  setTomographyStatus("Evaluating spherical-harmonic coefficients into numerical dVs samples…", "loading");
  document.querySelector("#load-tomography").disabled = true;
  try {
    const query = new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)]));
    let response = await fetchWithProgress(
      `/api/tomography/grid?${query}`, { signal: tomographyRequest.signal }, "Loading numerical tomography grid"
    );
    if (response.ok) {
      const grid = await response.json();
      addTomographyReference(values.model);
      state.tomography = {
        ...DEFAULT_TOMOGRAPHY, ...(state.tomography || {}), grid, sourceMode: "numerical",
        opacity: Number(document.querySelector("#tomography-opacity").value)
      };
      const map = ensureColorMaps().tomography;
      const fieldRange = state.tomography.scalarField === "dvp"
        ? Math.abs(values.range) / Math.max(.1, Number(state.tomography.vpVsRatio))
        : Math.abs(values.range);
      map.min = -fieldRange;
      map.max = fieldRange;
      map.opacity = state.tomography.opacity;
      applyTomographyBounds(values);
      document.querySelector("#export-tomography-csv").disabled = false;
      document.querySelector("#clear-tomography").disabled = false;
      document.querySelector("#tomography-create-feature").disabled = false;
      updateTomographyIsoStatus();
      setTomographyStatus(
        `Numerical ${grid.nx}×${grid.ny} ${grid.unit} grid loaded at ${grid.depth} km · values ${grid.min.toFixed(3)} to ${grid.max.toFixed(3)}%.`,
        "success"
      );
      persist();
      draw();
      showToast("Numerical tomography grid loaded");
      return;
    }
    const numericMessage = (await response.text()).slice(0, 180);
    if (response.status !== 422) throw new Error(numericMessage || `Numerical request failed (${response.status})`);
    setTomographyStatus("Numerical grid is unavailable for this model; requesting its attributed SubMachine image fallback…", "loading");
    response = await fetchWithProgress(
      `/api/submachine/slice?${query}`, { signal: tomographyRequest.signal }, "Downloading SubMachine depth slice"
    );
    if (!response.ok) throw new Error((await response.text()).slice(0, 180) || `Fallback request failed (${response.status})`);
    const src = await blobToDataUrl(await response.blob());
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("SubMachine returned an unreadable image."));
      image.src = src;
    });
    referenceImage = image;
    state.background = {
      src, name: `${document.querySelector("#tomography-model").selectedOptions[0].text} · ${values.depth} km`,
      opacity: 72, scale: 100, offsetX: 0, offsetY: 0, rotation: 0, fitMode: "stretch",
      west: values.west, east: values.east, south: values.south, north: values.north,
      source: "SubMachine / ORFEUS", sourceUrl: response.headers.get("X-Submachine-Result-Url")
    };
    state.tomography = { ...DEFAULT_TOMOGRAPHY, ...(state.tomography || {}), grid: null, sourceMode: "image-fallback" };
    addTomographyReference(values.model);
    applyTomographyBounds(values);
    syncMapEditor();
    document.querySelector("#export-tomography-csv").disabled = true;
    document.querySelector("#clear-tomography").disabled = false;
    document.querySelector("#tomography-create-feature").disabled = true;
    setTomographyStatus(`Image fallback loaded at ${values.depth} km; this model does not currently expose sampleable grid values.`, "success");
    showToast("Tomography image fallback loaded");
  } catch (requestError) {
    if (requestError.name !== "AbortError") {
      setTomographyStatus(`Could not load this slice: ${requestError.message}`, "error");
    }
  } finally {
    document.querySelector("#load-tomography").disabled = false;
    tomographyRequest = null;
  }
}

function exportTomographyCsv() {
  const grid = state.tomography?.grid;
  if (!grid?.values?.length) return;
  const derivedVp = state.tomography.scalarField === "dvp";
  const rows = [derivedVp
    ? `longitude_deg,latitude_deg,depth_km,dvs_native_percent,dvp_derived_percent,dvs_dvp_ratio_${state.tomography.vpVsRatio}`
    : "longitude_deg,latitude_deg,depth_km,dvs_native_percent"];
  for (let row = 0; row < grid.ny; row++) {
    const latitude = grid.north - row / Math.max(1, grid.ny - 1) * (grid.north - grid.south);
    for (let column = 0; column < grid.nx; column++) {
      const longitude = grid.west + column / Math.max(1, grid.nx - 1) * (grid.east - grid.west);
      const dvs = tomographyCell(grid, column, row);
      rows.push(`${longitude.toFixed(6)},${latitude.toFixed(6)},${grid.depth},${dvs}${derivedVp ? `,${tomographyScalarValue(dvs)},${state.tomography.vpVsRatio}` : ""}`);
    }
  }
  downloadBlob(`tomography-${grid.model.replace("model_", "")}-${grid.depth}km.csv`, new Blob([rows.join("\n")], { type: "text/csv" }));
  showToast("Numerical tomography CSV saved");
}

function fitReferenceMapToGrid() {
  if (!state.background) return;
  Object.assign(state.background, {
    west: Number(state.settings.xMin),
    east: Number(state.settings.xMax),
    south: Number(state.settings.yMin),
    north: Number(state.settings.yMax),
    scale: 100, offsetX: 0, offsetY: 0, rotation: 0
  });
  syncMapEditor();
  updateAll(false);
}

function syncMapEditor() {
  const controls = document.querySelector("#map-controls");
  const hasImage = Boolean(state.background && referenceImage);
  controls.classList.toggle("hidden", !hasImage);
  if (!hasImage) return;
  document.querySelector("#reference-image-name").textContent = state.background.name || "Reference image";
  document.querySelector("#map-fit-mode").value = state.background.fitMode || "contain";
  const values = {
    "map-opacity": state.background.opacity ?? 45,
    "map-scale": state.background.scale ?? 100,
    "map-offset-x": state.background.offsetX ?? 0,
    "map-offset-y": state.background.offsetY ?? 0,
    "map-rotation": state.background.rotation ?? 0,
    "map-west": state.background.west,
    "map-east": state.background.east,
    "map-south": state.background.south,
    "map-north": state.background.north
  };
  Object.entries(values).forEach(([id, value]) => { document.querySelector(`#${id}`).value = value; });
  const spherical = state.settings.coordinateSystem === "spherical";
  document.querySelector("#map-west-label").childNodes[0].textContent = spherical ? "West longitude " : "Left X ";
  document.querySelector("#map-east-label").childNodes[0].textContent = spherical ? "East longitude " : "Right X ";
  document.querySelector("#map-south-label").childNodes[0].textContent = spherical ? "South latitude " : "Bottom Y ";
  document.querySelector("#map-north-label").childNodes[0].textContent = spherical ? "North latitude " : "Top Y ";
}

function syncGravityUI() {
  const gravity = ensureGravity();
  const values = {
    "gravity-enabled": gravity.enabled,
    "gravity-field": gravity.field,
    "gravity-reference-density": gravity.referenceDensity,
    "gravity-topography-density": gravity.topographyDensity,
    "gravity-samples-x": gravity.samplesX,
    "gravity-samples-y": gravity.samplesY,
    "gravity-residual-base": gravity.residualBase,
    "gravity-opacity": gravity.opacity
  };
  Object.entries(values).forEach(([id, value]) => {
    const input = document.querySelector(`#${id}`);
    if (!input) return;
    if (input.type === "checkbox") input.checked = Boolean(value); else input.value = value;
  });
  const status = document.querySelector("#gravity-status");
  const range = document.querySelector("#gravity-range");
  if (!status || !range) return;
  const observations = gravity.observations.length;
  status.textContent = gravity.field === "residual" && !observations
    ? "Residual needs observed CSV data with x, y, gravity_mGal columns."
    : `${observations} observation${observations === 1 ? "" : "s"} · live recomputation ${gravity.enabled ? "enabled" : "paused"}${gravity.result?.sourceCount ? ` · ${gravity.result.sourceCount} density voxels` : ""}`;
  if (gravity.result) {
    range.textContent = `${gravity.result.min.toFixed(2)} to ${gravity.result.max.toFixed(2)} ${gravity.result.unit || "mGal"} · ${gravity.result.nx}×${gravity.result.ny} samples`;
  } else {
    range.textContent = "No gravity field computed";
  }
  const unit = gravity.result?.unit || (["gxx", "gxy", "gxz", "gyy", "gyz", "gzz"].includes(gravity.field) ? "E" : "mGal");
  const limit = gravityScaleLimit(gravity.result);
  document.querySelector("#gravity-scale-title").textContent = gravityFieldLabel(gravity.field);
  document.querySelector("#gravity-scale-unit").textContent = unit;
  document.querySelector("#gravity-scale-min").textContent = formatGravityScaleValue(-limit, "");
  document.querySelector("#gravity-scale-zero").textContent = "0";
  document.querySelector("#gravity-scale-max").textContent = formatGravityScaleValue(limit, "");
  document.querySelector("#gravity-scale-bar").style.background =
    `linear-gradient(90deg, ${colorMapStops("gravity").join(", ")})`;
  const workspaceField = document.querySelector("#gravity-workspace-field");
  if (workspaceField) workspaceField.value = gravity.field;
}

function syncAppearanceEditor() {
  state.appearance = { ...DEFAULT_APPEARANCE, ...(state.appearance || {}) };
  document.body.dataset.theme = state.appearance.theme;
  document.querySelector("#render-mode").value = state.appearance.renderMode;
  document.querySelector("#theme-mode").value = state.appearance.theme;
  document.querySelector("#render-shading").checked = state.appearance.shading;
  document.querySelector("#render-light").value = state.appearance.light;
  document.querySelector("#auto-temperature-preview").checked = state.appearance.autoTemperaturePreview;
  document.querySelector("#temperature-contours").checked = state.appearance.temperatureContours;
  document.querySelector("#slab-projection").checked = state.appearance.slabProjection;
  document.querySelector("#temperature-min").value = state.appearance.temperatureMin;
  document.querySelector("#temperature-max").value = state.appearance.temperatureMax;
}

function colorFieldRange(field) {
  if (field === "temperature") {
    const values = state.features.flatMap(feature => [
      Number(feature.temperature),
      ...(feature.layers || []).map(layer => Number(layer.temperature))
    ]).filter(Number.isFinite);
    return values.length ? [Math.min(...values), Math.max(...values)] : [273, 1800];
  }
  if (field === "gravity") {
    const result = ensureGravity().result;
    return result ? [result.min, result.max] : [-100, 100];
  }
  if (field === "tomography") {
    const grid = state.tomography?.grid;
    return grid ? tomographyScalarRange(grid) : [-1, 1];
  }
  const values = state.topography?.values?.filter(Number.isFinite) || [];
  return values.length ? [Math.min(...values), Math.max(...values)] : [-5000, 5000];
}

function syncColorEditor() {
  const field = document.querySelector("#color-field")?.value || "temperature";
  const maps = ensureColorMaps();
  const map = maps[field];
  if (field === "temperature") {
    map.min = Number(state.appearance.temperatureMin);
    map.max = Number(state.appearance.temperatureMax);
  }
  document.querySelector("#color-preset").value = map.preset;
  document.querySelector("#color-min").value = map.min;
  document.querySelector("#color-max").value = map.max;
  document.querySelector("#color-reverse").checked = Boolean(map.reverse);
  document.querySelector("#color-steps").value = map.steps;
  document.querySelector("#color-opacity").value = map.opacity;
  document.querySelector("#color-steps-value").textContent = Number(map.steps) >= 2 ? `${map.steps} bands` : "Continuous";
  document.querySelector("#color-opacity-value").textContent = `${map.opacity}%`;
  document.querySelector("#color-range-min-label").textContent = Number(map.min).toLocaleString();
  document.querySelector("#color-range-max-label").textContent = Number(map.max).toLocaleString();
  const colors = map.colors || DEFAULT_COLOR_MAPS[field].colors;
  ["low", "mid", "high"].forEach((name, index) => {
    document.querySelector(`#color-${name}`).value = colors[index];
  });
  const stops = colorMapStops(field);
  const positions = colorMapPositions(field);
  document.querySelector("#color-gradient-preview").style.background =
    `linear-gradient(90deg, ${stops.map((color, index) => `${color} ${positions[index] * 100}%`).join(", ")})`;
}

function updateColorMapFromControls() {
  const field = document.querySelector("#color-field").value;
  const map = ensureColorMaps()[field];
  map.preset = document.querySelector("#color-preset").value;
  map.min = Number(document.querySelector("#color-min").value);
  map.max = Math.max(map.min + 1e-9, Number(document.querySelector("#color-max").value));
  map.reverse = document.querySelector("#color-reverse").checked;
  map.steps = Number(document.querySelector("#color-steps").value);
  map.opacity = Number(document.querySelector("#color-opacity").value);
  map.colors = ["low", "mid", "high"].map(name => document.querySelector(`#color-${name}`).value);
  if (field === "temperature") {
    state.appearance.temperatureMin = map.min;
    state.appearance.temperatureMax = map.max;
    syncAppearanceEditor();
  } else if (field === "gravity") {
    ensureGravity().opacity = map.opacity;
    syncGravityUI();
  } else if (field === "tomography") {
    state.tomography = { ...DEFAULT_TOMOGRAPHY, ...(state.tomography || {}), opacity: map.opacity };
    document.querySelector("#tomography-opacity").value = map.opacity;
  } else {
    ensureTopography().opacity = map.opacity;
    updateTopographyUI();
  }
  syncColorEditor();
  persist();
  draw();
  if (document.querySelector("#gravity-workspace")?.open) renderGravityWorkspace();
}

function activateTemperaturePreview() {
  state.appearance = { ...DEFAULT_APPEARANCE, ...(state.appearance || {}) };
  if (!state.appearance.autoTemperaturePreview) return;
  state.appearance.renderMode = "temperature";
  syncAppearanceEditor();
}

function updateTopographyUI() {
  const topography = state.topography;
  const mode = state.settings.topographyMode || "terrain";
  const hasValues = topography?.values?.length === topography.width * topography.height;
  const hasImage = Boolean(topography?.imageSrc);
  const source = topography?.source || (hasValues || hasImage ? "Edited surface" : "empty");
  document.querySelector("#topography-status-mini").textContent = mode === "none" ? "disabled" : mode === "isostatic" ? "isostatic" : source;
  document.querySelector("#topography-mode").value = mode;
  document.querySelector("#topography-mode-note").textContent = mode === "none"
    ? "No feature topography models will be exported."
    : mode === "isostatic"
      ? "GWB will receive composition densities and reference-column isostasy parameters."
      : "Terrain fields are converted to per-feature GWB depth surfaces.";
  document.querySelector("#isostasy-controls").classList.toggle("hidden", mode !== "isostatic");
  document.querySelector("#apply-topography-features").disabled = mode !== "terrain";
  const densityValues = {
    "background-density": state.settings.backgroundDensity,
    "gravity-magnitude": state.settings.gravityMagnitude,
    "compensation-depth": Number(state.settings.compensationDepth) / 1000,
    "integration-points": state.settings.integrationPoints,
    "reference-profile-x": state.settings.referenceProfileX,
    "reference-profile-y": state.settings.referenceProfileY
  };
  Object.entries(densityValues).forEach(([id, value]) => { document.querySelector(`#${id}`).value = value; });
  document.querySelector("#terrain-opacity").value = topography?.opacity ?? 70;
  document.querySelector("#terrain-hillshade").checked = topography?.hillshade ?? true;
  document.querySelector("#apply-topography-features").checked = topography?.exportToFeatures !== false;
  if (hasValues) {
    const minimum = Math.min(...topography.values); const maximum = Math.max(...topography.values);
    document.querySelector("#topography-range").textContent = `${Math.round(minimum)} to ${Math.round(maximum)} m · ${topography.width} × ${topography.height} samples`;
  } else {
    document.querySelector("#topography-range").textContent = hasImage ? "ETOPO rendered relief · add or import elevations to sculpt numerically" : "No elevation field";
  }
}

function ensurePaleogeography() {
  if (!state.paleogeography) state.paleogeography = { ...DEFAULT_PALEOGEOGRAPHY };
  state.paleogeography.layers ||= {};
  return state.paleogeography;
}

function selectedPaleoLayers() {
  return [
    ["coastlines", document.querySelector("#paleo-coastlines").checked],
    ["subduction", document.querySelector("#paleo-subduction").checked],
    ["boundaries", document.querySelector("#paleo-boundaries").checked]
  ].filter(([, selected]) => selected).map(([layer]) => layer);
}

function syncPaleoAgeRange(reset = false) {
  const select = document.querySelector("#paleo-model");
  const option = select.selectedOptions[0];
  const minimum = Number(option.dataset.minAge || 0);
  const maximum = Number(option.dataset.maxAge || 1000);
  const ageInput = document.querySelector("#paleo-age");
  const slider = document.querySelector("#paleo-age-slider");
  ageInput.min = slider.min = minimum;
  ageInput.max = slider.max = maximum;
  const current = reset ? Math.min(100, maximum) : Number(ageInput.value);
  const clamped = Math.max(minimum, Math.min(maximum, Number.isFinite(current) ? current : minimum));
  ageInput.value = slider.value = clamped;
}

function updatePaleoUI() {
  const paleo = ensurePaleogeography();
  document.querySelector("#paleo-model").value = paleo.model;
  document.querySelector("#paleo-age").value = paleo.age;
  syncPaleoAgeRange();
  paleo.age = Number(document.querySelector("#paleo-age").value);
  document.querySelector("#paleo-age-slider").value = paleo.age;
  document.querySelector("#paleo-anchor").value = String(paleo.anchorPlateId);
  document.querySelector("#show-paleogeography").checked = paleo.visible;
  const count = Object.values(paleo.layers).reduce((sum, collection) => sum + (collection?.features?.length || 0), 0);
  document.querySelector("#paleo-connection").textContent = count ? `${count} vectors` : "not loaded";
  document.querySelector("#paleo-connection").classList.toggle("loaded", count > 0);
}

async function fetchPaleoLayer(layer, local = false) {
  const paleo = ensurePaleogeography();
  const parameters = local
    ? new URLSearchParams({ layer })
    : new URLSearchParams({
      layer, model: paleo.model, time: String(paleo.age), anchor_plate_id: String(paleo.anchorPlateId)
    });
  const response = await fetch(`${local ? "/api/gplates/local" : "/api/gplates/reconstruction"}?${parameters}`);
  if (!response.ok) throw new Error(await response.text());
  const result = await response.json();
  if (result.type !== "FeatureCollection" || !Array.isArray(result.features)) {
    throw new Error(`${layer} did not return a GeoJSON FeatureCollection.`);
  }
  return result;
}

async function loadPaleogeography(local = false) {
  if (state.settings.coordinateSystem !== "spherical") {
    showToast("Paleogeography requires a spherical longitude/latitude grid");
    return;
  }
  const paleo = ensurePaleogeography();
  const layers = local ? ["coastlines", "subduction", "boundaries"] : selectedPaleoLayers();
  if (!layers.length) {
    showToast("Select at least one paleogeography layer");
    return;
  }
  const button = document.querySelector(local ? "#load-local-gplates" : "#load-paleogeography");
  const activity = startActivity(local ? "Loading bundled paleogeography" : "Downloading GPlates reconstruction");
  button.disabled = true;
  document.querySelector("#paleo-status").textContent = local
    ? "Reading reconstructed geometries from contrib/gplates/data…"
    : `Requesting ${paleo.model} at ${paleo.age} Ma from the GPlates Web Service…`;
  try {
    const results = await Promise.all(layers.map(layer => fetchPaleoLayer(layer, local)));
    paleo.layers = Object.fromEntries(layers.map((layer, index) => [layer, results[index]]));
    paleo.visible = true;
    if (local) {
      paleo.model = "MERDITH2021"; paleo.age = 1000; paleo.anchorPlateId = 0;
      paleo.source = "GWB contrib/gplates · Merdith 2021 · 1000 Ma";
    } else {
      paleo.source = `EarthByte GPlates Web Service · ${paleo.model} · ${paleo.age} Ma`;
    }
    const count = results.reduce((sum, collection) => sum + collection.features.length, 0);
    document.querySelector("#paleo-status").textContent =
      `${paleo.source}. ${count} geometries loaded as a drawing reference.`;
    updatePaleoUI(); updateAll(false);
    finishActivity(activity, `${count} reconstructed geometries loaded`, "success");
    showToast(`${count} reconstructed geometries loaded`);
  } catch (error) {
    document.querySelector("#paleo-status").textContent = `Reconstruction failed: ${error.message}`;
    finishActivity(activity, "Paleogeography loading failed", "error");
  } finally {
    button.disabled = false;
  }
}

function pointInRing(point, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [xi, yi] = ring[index]; const [xj, yj] = ring[previous];
    const intersects = ((yi > point[1]) !== (yj > point[1]))
      && point[0] < (xj - xi) * (point[1] - yi) / Math.max(1e-12, yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function continentRings(collection) {
  const rings = [];
  (collection?.features || []).forEach(feature => {
    if (feature.geometry?.type === "Polygon") rings.push(feature.geometry.coordinates[0]);
    if (feature.geometry?.type === "MultiPolygon") {
      feature.geometry.coordinates.forEach(polygon => rings.push(polygon[0]));
    }
  });
  return rings.filter(ring => ring?.length >= 4).map(ring => ({
    ring,
    west: Math.min(...ring.map(point => point[0])), east: Math.max(...ring.map(point => point[0])),
    south: Math.min(...ring.map(point => point[1])), north: Math.max(...ring.map(point => point[1]))
  }));
}

function buildPaleoRelief() {
  const paleo = ensurePaleogeography();
  const rings = continentRings(paleo.layers.coastlines);
  if (!rings.length) {
    showToast("Load reconstructed continents first");
    return;
  }
  const topography = ensureTopography();
  const bounds = {
    west: Number(state.settings.xMin), east: Number(state.settings.xMax),
    south: Number(state.settings.yMin), north: Number(state.settings.yMax)
  };
  topography.bounds = bounds;
  topography.values = [];
  for (let row = 0; row < topography.height; row++) {
    const latitude = bounds.north - row / Math.max(1, topography.height - 1) * (bounds.north - bounds.south);
    for (let column = 0; column < topography.width; column++) {
      const longitude = bounds.west + column / Math.max(1, topography.width - 1) * (bounds.east - bounds.west);
      const land = rings.some(item => longitude >= item.west && longitude <= item.east
        && latitude >= item.south && latitude <= item.north && pointInRing([longitude, latitude], item.ring));
      const noise = fractalNoise(column / 8, row / 8, Number(paleo.age) + 17, .52);
      topography.values.push(Math.round(land ? 550 + noise * 950 : -3900 + noise * 850));
    }
  }
  topography.source = `Editable paleo-relief proxy · ${paleo.model} · ${paleo.age} Ma`;
  topography.imageSrc = null; topographyImage = null;
  updateTopographyUI(); updateAll(false);
  document.querySelector("#paleo-status").textContent =
    "Editable relief proxy built from reconstructed land polygons. Import a published PaleoDEM for quantitative elevation.";
  showToast("Editable paleo-relief proxy created");
}

function partIntersectsDomain(points) {
  if (!points?.length) return false;
  const west = Math.min(...points.map(point => point[0])); const east = Math.max(...points.map(point => point[0]));
  const south = Math.min(...points.map(point => point[1])); const north = Math.max(...points.map(point => point[1]));
  return east >= state.settings.xMin && west <= state.settings.xMax
    && north >= state.settings.yMin && south <= state.settings.yMax;
}

function simplifiedPoints(points, limit = 70, closed = false) {
  const usable = closed && points.length > 1
    && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1] ? points.slice(0, -1) : points;
  const stride = Math.max(1, Math.ceil(usable.length / limit));
  return usable.filter((_, index) => index % stride === 0 || index === usable.length - 1)
    .map(point => [Number(point[0]), Number(point[1])]);
}

function convertPaleoFeatures() {
  const paleo = ensurePaleogeography();
  const additions = [];
  const append = (model, points, properties, closed) => {
    const simplified = simplifiedPoints(points, 70, closed);
    const minimum = FEATURE_TYPES[model].geometry === "area" ? 3 : 2;
    if (simplified.length < minimum || !partIntersectsDomain(simplified)) return;
    const center = simplified.reduce((sum, point) => [
      sum[0] + point[0] / simplified.length, sum[1] + point[1] / simplified.length
    ], [0, 0]);
    const feature = createFeature(model, center[0], center[1], state.features.length + additions.length);
    configureNewFeatureCoordinates(feature, center);
    feature.points = simplified;
    feature.geometryEdited = true;
    feature.source = paleo.source;
    feature.name = properties.name || `${FEATURE_TYPES[model].label} · ${paleo.age} Ma`;
    if (model === "continental plate") feature.layers = geologicalLayerPreset(feature);
    if (feature.dipPoint) {
      const polarity = String(properties.polarity || "").toLowerCase();
      feature.dipPoint = [center[0], Math.max(-90, Math.min(90, center[1] + (polarity === "right" ? -5 : 5)))];
    }
    additions.push(feature);
  };
  const caps = { coastlines: 18, subduction: 30, boundaries: 30 };
  [
    ["coastlines", "continental plate"],
    ["subduction", "subducting plate"],
    ["boundaries", "fault"]
  ].forEach(([layer, model]) => {
    let count = 0;
    forEachGeoPart(paleo.layers[layer], (part, properties) => {
      if (count >= caps[layer] || !partIntersectsDomain(part.points)) return;
      append(model, part.points, properties, part.closed);
      count++;
    });
  });
  if (!additions.length) {
    showToast("No loaded vectors intersect the current model bounds");
    return;
  }
  state.features.push(...additions);
  activateTemperaturePreview();
  selectedId = additions[0].id;
  selectedIds = new Set([selectedId]);
  updateAll();
  document.querySelector("#paleo-status").textContent =
    `${additions.length} simplified editable GWB features created in the current domain.`;
  showToast(`${additions.length} reconstruction vectors converted`);
}

async function importRasterTopography(file) {
  const src = await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
  });
  const image = new Image();
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = src; });
  const topography = ensureTopography();
  const sampler = document.createElement("canvas"); sampler.width = topography.width; sampler.height = topography.height;
  const samplerContext = sampler.getContext("2d"); samplerContext.drawImage(image, 0, 0, sampler.width, sampler.height);
  const pixels = samplerContext.getImageData(0, 0, sampler.width, sampler.height).data;
  const amplitude = Number(document.querySelector("#terrain-amplitude").value);
  topography.values = Array.from({ length: topography.width * topography.height }, (_, index) => {
    const offset = index * 4;
    return ((pixels[offset] * .2126 + pixels[offset + 1] * .7152 + pixels[offset + 2] * .0722) / 255 - .5) * amplitude * 2;
  });
  topography.bounds = {
    west: Number(state.settings.xMin), east: Number(state.settings.xMax),
    south: Number(state.settings.yMin), north: Number(state.settings.yMax)
  };
}

function importTextTopography(text, extension) {
  const topography = ensureTopography();
  if (extension === "json") {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.values) || !Number(parsed.width) || !Number(parsed.height)) throw new Error("JSON needs width, height and values.");
    topography.width = Number(parsed.width); topography.height = Number(parsed.height);
    if (parsed.values.length !== topography.width * topography.height) throw new Error("JSON elevation count does not match its dimensions.");
    topography.values = parsed.values.map(Number);
    topography.bounds = parsed.bounds || terrainBounds();
    return;
  }
  if (extension === "asc") {
    const lines = text.trim().split(/\r?\n/);
    const header = {};
    for (let index = 0; index < Math.min(6, lines.length); index++) {
      const [key, value] = lines[index].trim().split(/\s+/);
      header[key.toLowerCase()] = Number(value);
    }
    const start = header.ncols && header.nrows ? 6 : 0;
    const rows = lines.slice(start).map(line => line.trim().split(/\s+/).map(Number)).filter(row => row.length);
    topography.height = header.nrows || rows.length;
    topography.width = header.ncols || rows[0]?.length || 0;
    topography.values = rows.flat().slice(0, topography.width * topography.height);
    const cell = header.cellsize || 1;
    topography.bounds = {
      west: header.xllcorner ?? state.settings.xMin,
      east: (header.xllcorner ?? state.settings.xMin) + topography.width * cell,
      south: header.yllcorner ?? state.settings.yMin,
      north: (header.yllcorner ?? state.settings.yMin) + topography.height * cell
    };
    return;
  }
  const points = text.trim().split(/\r?\n/).map(line => line.trim().split(/[,\s]+/).map(Number)).filter(point => point.length >= 3 && point.every(Number.isFinite));
  if (!points.length) throw new Error("No numeric x, y, elevation rows were found.");
  const bounds = {
    west: Math.min(...points.map(point => point[0])), east: Math.max(...points.map(point => point[0])),
    south: Math.min(...points.map(point => point[1])), north: Math.max(...points.map(point => point[1]))
  };
  topography.values = Array(topography.width * topography.height).fill(0);
  const counts = Array(topography.values.length).fill(0);
  points.forEach(([x, y, elevation]) => {
    const column = Math.round((x - bounds.west) / Math.max(1e-12, bounds.east - bounds.west) * (topography.width - 1));
    const row = Math.round((bounds.north - y) / Math.max(1e-12, bounds.north - bounds.south) * (topography.height - 1));
    const index = terrainIndex(column, row, topography);
    topography.values[index] += elevation; counts[index]++;
  });
  topography.values = topography.values.map((value, index) => counts[index] ? value / counts[index] : 0);
  topography.bounds = bounds;
}

async function loadEtopoRelief() {
  let geographicBounds;
  try {
    geographicBounds = geographicSourceBounds();
  } catch (error) {
    document.querySelector("#topography-source-note").textContent = error.message;
    showToast(error.message);
    return;
  }
  const modelBounds = state.settings.coordinateSystem === "spherical" ? geographicBounds : cartesianModelBounds();
  document.querySelector("#load-etopo").disabled = true;
  document.querySelector("#topography-source-note").textContent = "Loading shaded relief from NOAA NCEI…";
  try {
    const response = await fetchWithProgress(
      `/api/etopo/relief?${new URLSearchParams(geographicBounds)}`, {}, "Downloading NOAA ETOPO relief"
    );
    if (!response.ok) throw new Error(await response.text());
    const src = await blobToDataUrl(await response.blob());
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = src; });
    topographyImage = image;
    const topography = ensureTopography();
    topography.imageSrc = src;
    topography.bounds = modelBounds;
    topography.geographicBounds = geographicBounds;
    topography.coordinateMapping = state.settings.coordinateSystem === "spherical" ? "longitude-latitude" : "equirectangular-to-cartesian";
    topography.source = "NOAA ETOPO relief";
    updateTopographyUI(); updateAll(false);
    document.querySelector("#topography-source-note").textContent = state.settings.coordinateSystem === "spherical"
      ? "ETOPO relief loaded for the current longitude/latitude bounds. Sculpt edits are stored separately."
      : "ETOPO geographic relief mapped across the Cartesian X/Y domain. Source bounds are retained in the project.";
    showToast(`NOAA ETOPO relief loaded${state.settings.coordinateSystem === "spherical" ? "" : " and mapped to Cartesian X/Y"}`);
  } catch (error) {
    document.querySelector("#topography-source-note").textContent = `ETOPO load failed: ${error.message}`;
  } finally {
    document.querySelector("#load-etopo").disabled = false;
  }
}

function updateDrawingUI() {
  const active = tool === "draw-points" || tool === "draw-freehand";
  document.querySelector("#drawing-actions").classList.toggle("hidden", !active);
  document.querySelector("#drawing-count").textContent = `${drawPoints.length} ${drawPoints.length === 1 ? "vertex" : "vertices"}`;
  document.querySelectorAll("[data-draw-mode]").forEach(button => button.classList.toggle("active", tool === `draw-${button.dataset.drawMode}`));
  document.querySelectorAll("[data-edit-mode]").forEach(button => button.classList.toggle("active", tool === button.dataset.editMode));
}

function cancelDrawing() {
  drawPoints = [];
  freehandDrawing = false;
  tool = "select";
  updateDrawingUI();
  draw();
}

function finishDrawing() {
  const model = document.querySelector("#draw-feature-model").value;
  const geometry = FEATURE_TYPES[model].geometry;
  const minimum = geometry === "area" ? 3 : geometry === "line" ? 2 : 1;
  if (drawPoints.length < minimum) {
    showToast(`${FEATURE_TYPES[model].label} needs at least ${minimum} point${minimum === 1 ? "" : "s"}`);
    return;
  }
  const usedPoints = geometry === "point" ? [drawPoints.at(-1)] : drawPoints;
  const center = usedPoints.reduce((sum, point) => [sum[0] + point[0] / usedPoints.length, sum[1] + point[1] / usedPoints.length], [0, 0]);
  const feature = createFeature(model, center[0], center[1], state.features.length);
  configureNewFeatureCoordinates(feature, center);
  feature.points = usedPoints.map(point => [...point]);
  feature.smooth = document.querySelector("#smooth-geometry").checked;
  if (feature.dipPoint) {
    const span = state.settings.coordinateSystem === "spherical"
      ? Math.max(2, Math.max(...usedPoints.map(point => point[1])) - Math.min(...usedPoints.map(point => point[1])))
      : Math.max(50000, Math.max(...usedPoints.map(point => point[1])) - Math.min(...usedPoints.map(point => point[1])));
    feature.dipPoint = [center[0], center[1] + span * 1.3];
  }
  state.features.push(feature);
  activateTemperaturePreview();
  selectedId = feature.id;
  selectedIds = new Set([feature.id]);
  selectedPointIndex = null;
  drawPoints = [];
  tool = "select";
  updateDrawingUI();
  updateAll();
  showToast(`${FEATURE_TYPES[model].label} drawn · ${Math.round(featureTemperature(feature))} K`);
}

function distanceToSegment(point, start, end) {
  const dx = end[0] - start[0]; const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared));
  const projection = [start[0] + t * dx, start[1] + t * dy];
  return { distance: Math.hypot(point[0] - projection[0], point[1] - projection[1]), projection };
}

function addVertexAt(canvasPosition, requireNearbyEdge = false) {
  const feature = state.features.find(item => item.id === selectedId);
  if (!feature || FEATURE_TYPES[feature.model].geometry === "point") {
    showToast("Select a line or area feature first");
    return;
  }
  const projected = feature.points.map(worldToCanvas);
  const segmentCount = FEATURE_TYPES[feature.model].geometry === "area" ? projected.length : projected.length - 1;
  let nearest = null;
  for (let index = 0; index < segmentCount; index++) {
    const candidate = distanceToSegment(canvasPosition, projected[index], projected[(index + 1) % projected.length]);
    if (!nearest || candidate.distance < nearest.distance) nearest = { ...candidate, index };
  }
  if (!nearest) return;
  if (requireNearbyEdge && nearest.distance > 18) {
    showToast("Double-click closer to the selected feature edge");
    return;
  }
  feature.points.splice(nearest.index + 1, 0, canvasToWorld(...nearest.projection));
  feature.geometryEdited = true;
  selectedPointIndex = nearest.index + 1;
  tool = "select";
  updateDrawingUI();
  updateAll();
  showToast("Vertex added");
}

function removeVertexAt(canvasPosition) {
  const feature = state.features.find(item => item.id === selectedId);
  if (!feature) {
    showToast("Select a feature first");
    return;
  }
  const geometry = FEATURE_TYPES[feature.model].geometry;
  const minimum = geometry === "area" ? 3 : geometry === "line" ? 2 : 1;
  if (feature.points.length <= minimum) {
    showToast(`This ${geometry} needs at least ${minimum} vertices`);
    return;
  }
  const projected = feature.points.map(worldToCanvas);
  let nearestIndex = 0; let nearestDistance = Infinity;
  projected.forEach((point, index) => {
    const distance = Math.hypot(point[0] - canvasPosition[0], point[1] - canvasPosition[1]);
    if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; }
  });
  feature.points.splice(nearestIndex, 1);
  feature.geometryEdited = true;
  selectedPointIndex = null;
  tool = "select";
  updateDrawingUI();
  updateAll();
  showToast("Vertex removed");
}

wrap.addEventListener("dragover", event => event.preventDefault());
wrap.addEventListener("drop", event => {
  event.preventDefault();
  const viewport = event.target.closest?.(".viewport-pane")?.dataset.viewport;
  if (viewport) setActiveViewport(viewport);
  const model = event.dataTransfer.getData("text/gwb-feature");
  if (FEATURE_TYPES[model]) {
    const rect = canvas.getBoundingClientRect();
    addFeature(model, event.clientX - rect.left, event.clientY - rect.top);
  }
});

canvas.addEventListener("pointerdown", event => {
  setActiveViewport("primary");
  canvas.focus();
  const legendPoint = rawCanvasPoint(canvas, event);
  if (beginGravityLegendDrag("primary", canvas, event, legendPoint)) return;
  if (cameraPanMode || event.shiftKey || event.button === 1 || event.button === 2) {
    event.preventDefault();
    cameraDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, mode: "pan" };
    canvas.style.cursor = "grabbing";
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  if (viewMode === "three-d" && event.button === 0) {
    event.preventDefault();
    cameraDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, mode: "orbit" };
    canvas.style.cursor = "grabbing";
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  const point = canvasPoint(event);
  hoverPoint = point;
  if (viewMode !== "plan") {
    draw();
    return;
  }
  if (tool === "terrain-select") {
    if (terrainSelection.length >= 2) terrainSelection = [];
    terrainSelection.push(canvasToWorld(...point));
    draw();
    showToast(terrainSelection.length === 1 ? "Choose the opposite selection corner" : "Selection ready");
    return;
  }
  if (tool === "terrain-raise" || tool === "terrain-lower" || tool === "terrain-smooth") {
    terrainDrawing = true;
    sculptTopography(canvasToWorld(...point));
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  if (tool === "draw-points") {
    drawPoints.push(canvasToWorld(...point));
    updateDrawingUI();
    draw();
    if (FEATURE_TYPES[document.querySelector("#draw-feature-model").value].geometry === "point") finishDrawing();
    return;
  }
  if (tool === "draw-freehand") {
    freehandDrawing = true;
    drawPoints = [canvasToWorld(...point)];
    updateDrawingUI();
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  if (tool === "add-vertex") {
    addVertexAt(point);
    return;
  }
  if (tool === "remove-vertex") {
    removeVertexAt(point);
    return;
  }
  const selectedFeature = state.features.find(item => item.id === selectedId);
  const dipHit = selectedFeature?.dipPoint && Math.hypot(...worldToCanvas(selectedFeature.dipPoint).map((value, index) => value - point[index])) <= 13;
  const plumeResizeHit = tool === "select" && hitPlumeContour(selectedFeature, point);
  const layerBoundaryHit = tool === "select" ? hitLayerBoundaryHandle(selectedFeature, point) : null;
  const thicknessHit = tool === "select" && hitThicknessHandle(selectedFeature, point);
  const feature = dipHit || plumeResizeHit || layerBoundaryHit || thicknessHit ? selectedFeature : hitFeature(point);
  if (tool === "section") {
    const world = canvasToWorld(...point).map(value => Math.round(value));
    sectionDraft.push(world);
    syncSectionActions();
    draw();
    showToast(sectionDraft.length === 1 ? "Add more points, then press Enter" : `${sectionDraft.length} section points · Enter to finish`);
    return;
  }
  if (tool === "connect") {
    if (!feature) return;
    if (!connectingFrom) {
      connectingFrom = feature.id;
      selectFeature(feature.id);
      showToast("Choose a second feature to share this boundary");
    } else {
      const source = state.features.find(item => item.id === connectingFrom);
      if (connectFeatures(source, feature)) {
        state.connections.push([source.id, feature.id]);
        showToast("Features connected by shared coordinates");
      }
      connectingFrom = null;
      updateAll();
    }
    return;
  }
  if (!feature && tool === "select") {
    marqueeSelection = {
      start: [...point],
      current: [...point],
      additive: event.metaKey || event.ctrlKey
    };
    canvas.style.cursor = "crosshair";
    canvas.setPointerCapture(event.pointerId);
    draw();
    return;
  }
  if (feature) selectFeature(feature.id, event.metaKey || event.ctrlKey, selectedIds.has(feature.id));
  else selectFeature(null);
  if (feature) {
    if (!selectedIds.has(feature.id)) return;
    const handleIndex = feature.points.findIndex(projected => {
      const handle = worldToCanvas(projected);
      return Math.hypot(handle[0] - point[0], handle[1] - point[1]) <= 10;
    });
    drag = {
      id: feature.id,
      mode: dipHit ? "dip" : plumeResizeHit ? "plume-resize" : layerBoundaryHit ? "layer-boundary" : thicknessHit ? "thickness" : handleIndex >= 0 ? "point" : "feature",
      handleIndex,
      layerBoundaryIndex: layerBoundaryHit?.index ?? null,
      start: canvasToWorld(...point),
      startCanvas: [...point],
      original: feature.points.map(p => [...p]),
      originalRadius: Number(feature.semiMajorAxis),
      originalThickness: featureThickness(feature),
      originalLayers: structuredClone(feature.layers || []),
      dip: feature.dipPoint ? [...feature.dipPoint] : null,
      group: new Map([...selectedIds].map(id => {
        const item = state.features.find(candidate => candidate.id === id);
        return [id, item ? {
          points: item.points.map(point => [...point]),
          dip: item.dipPoint ? [...item.dipPoint] : null
        } : null];
      }).filter(([, original]) => original))
    };
    selectedPointIndex = handleIndex >= 0 ? handleIndex : null;
    draw();
    canvas.setPointerCapture(event.pointerId);
  }
});

canvas.addEventListener("dblclick", event => {
  if (gravityLegendHit("primary", rawCanvasPoint(canvas, event))) {
    event.preventDefault();
    resetGravityLegend("primary");
    return;
  }
  if (cameraPanMode || viewMode !== "plan" || tool !== "select") return;
  event.preventDefault();
  addVertexAt(canvasPoint(event), true);
});

canvas.addEventListener("pointermove", event => {
  const legendPoint = rawCanvasPoint(canvas, event);
  if (moveGravityLegend(event, legendPoint)) return;
  if (!cameraDrag && !drag && !marqueeSelection && gravityLegendHit("primary", legendPoint)) {
    canvas.style.cursor = "grab";
    return;
  }
  if (cameraDrag) {
    const dx = event.clientX - cameraDrag.x; const dy = event.clientY - cameraDrag.y;
    cameraDrag.x = event.clientX; cameraDrag.y = event.clientY;
    if (cameraDrag.mode === "orbit") changeCamera({ orbitYawDelta: dx * .45, orbitPitchDelta: -dy * .35 });
    else changeCamera({ panX: dx, panY: dy });
    return;
  }
  const point = canvasPoint(event);
  hoverPoint = point;
  if (marqueeSelection) {
    marqueeSelection.current = [...point];
    draw();
    return;
  }
  if (viewMode === "section") {
    draw();
    return;
  }
  if (viewMode === "three-d") return;
  const world = canvasToWorld(...point);
  const tomographyValue = state.settings.coordinateSystem === "spherical" ? sampleTomography(world[0], world[1]) : null;
  document.querySelector("#coordinate-readout").textContent = state.settings.coordinateSystem === "spherical"
    ? `lon ${world[0].toFixed(2)}° · lat ${world[1].toFixed(2)}°${tomographyValue === null ? "" : ` · ${state.tomography.scalarField === "dvp" ? "dVp*" : "dVs"} ${tomographyValue.toFixed(3)}% @ ${state.tomography.grid.depth} km`}`
    : `x ${(world[0] / 1000).toFixed(0)} km · y ${(world[1] / 1000).toFixed(0)} km`;
  if (freehandDrawing && tool === "draw-freehand") {
    const lastCanvasPoint = worldToCanvas(drawPoints.at(-1));
    if (Math.hypot(lastCanvasPoint[0] - point[0], lastCanvasPoint[1] - point[1]) >= 7) {
      drawPoints.push(world);
      updateDrawingUI();
      draw();
    }
    return;
  }
  if (terrainDrawing && (tool === "terrain-raise" || tool === "terrain-lower" || tool === "terrain-smooth")) {
    sculptTopography(world);
    return;
  }
  if (!drag) {
    const selectedFeature = state.features.find(item => item.id === selectedId);
    if (!cameraPanMode && tool === "select") {
      canvas.style.cursor = hitPlumeContour(selectedFeature, point) ? "nwse-resize"
        : hitLayerBoundaryHandle(selectedFeature, point) ? "row-resize"
          : hitThicknessHandle(selectedFeature, point) ? "ns-resize" : "default";
    }
    return;
  }
  const feature = state.features.find(item => item.id === drag.id);
  const dx = world[0] - drag.start[0];
  const dz = world[1] - drag.start[1];
  if (drag.mode === "point") {
    feature.points = drag.original.map((point, index) => index === drag.handleIndex ? [world[0], world[1]] : point);
    feature.geometryEdited = true;
  } else if (drag.mode === "dip") {
    feature.dipPoint = [world[0], world[1]];
    feature.geometryEdited = true;
  } else if (drag.mode === "plume-resize") {
    const center = drag.original[0];
    const eccentricity = Math.max(0, Math.min(.98, Number(feature.eccentricity) || 0));
    const minorRatio = Math.sqrt(1 - eccentricity * eccentricity);
    const radius = Math.hypot(world[0] - center[0], (world[1] - center[1]) / minorRatio);
    const minimum = state.settings.coordinateSystem === "spherical" ? .05 : 1000;
    feature.semiMajorAxis = Math.max(minimum, radius);
    feature.plumeGeometryEdited = true;
  } else if (drag.mode === "thickness") {
    const depthRange = Math.max(1000, Number(state.settings.zMax) - Number(state.settings.zMin));
    const depthPerPixel = depthRange / Math.max(1, canvas.clientHeight - 84);
    const thickness = Math.max(1000, Number(drag.originalThickness) - (point[1] - drag.startCanvas[1]) * depthPerPixel);
    if (feature.model === "subducting plate" || feature.model === "fault") {
      feature.thickness = thickness;
      feature.segmentEdited = true;
    } else {
      feature.maxDepth = Number(feature.minDepth) + thickness;
    }
    if (drag.originalLayers.length) {
      const startDepth = feature.model === "subducting plate" || feature.model === "fault" ? 0 : Number(feature.minDepth);
      const originalStart = startDepth;
      const originalThickness = Math.max(1, Number(drag.originalThickness));
      feature.layers = drag.originalLayers.map(layer => ({
        ...layer,
        minDepth: startDepth + (Number(layer.minDepth) - originalStart) / originalThickness * thickness,
        maxDepth: startDepth + (Number(layer.maxDepth) - originalStart) / originalThickness * thickness
      }));
      feature.layersEdited = true;
    }
  } else if (drag.mode === "layer-boundary") {
    const handles = layerBoundaryGeometry(feature);
    const geometry = handles.find(handle => handle.index === drag.layerBoundaryIndex);
    const upper = feature.layers[drag.layerBoundaryIndex];
    const lower = feature.layers[drag.layerBoundaryIndex + 1];
    if (geometry && upper && lower) {
      const fraction = Math.max(0, Math.min(1, (point[1] - geometry.top) / Math.max(1, geometry.bottom - geometry.top)));
      const candidate = geometry.startDepth + fraction * geometry.thickness;
      const minimumGap = 1000;
      const boundary = Math.max(Number(upper.minDepth) + minimumGap, Math.min(Number(lower.maxDepth) - minimumGap, candidate));
      upper.maxDepth = boundary;
      lower.minDepth = boundary;
      feature.layersEdited = true;
      feature.layerMode = "depths";
    }
  } else {
    drag.group.forEach((original, id) => {
      const item = state.features.find(candidate => candidate.id === id);
      if (!item) return;
      item.points = original.points.map(([x, z]) => [x + dx, z + dz]);
      if (original.dip) item.dipPoint = [original.dip[0] + dx, original.dip[1] + dz];
      item.geometryEdited = true;
    });
  }
  updateAll(false);
});
canvas.addEventListener("pointerup", () => {
  if (finishGravityLegendDrag(canvas)) return;
  if (cameraDrag) {
    cameraDrag = null;
    canvas.style.cursor = cameraPanMode || viewMode === "three-d" ? "grab" : "default";
    persist();
    return;
  }
  if (marqueeSelection) {
    finishMarqueeSelection();
    canvas.style.cursor = "default";
    return;
  }
  const completedDrag = drag;
  drag = null;
  if (completedDrag?.mode === "plume-resize") {
    renderInspector();
    const feature = state.features.find(item => item.id === completedDrag.id);
    const unitScale = state.settings.coordinateSystem === "spherical" ? 1 : 1000;
    const unit = state.settings.coordinateSystem === "spherical" ? "°" : " km";
    showToast(`Plume radius resized to ${(Number(feature?.semiMajorAxis) / unitScale).toFixed(1)}${unit}`);
  } else if (completedDrag?.mode === "thickness") {
    renderInspector();
    const feature = state.features.find(item => item.id === completedDrag.id);
    showToast(`Feature thickness set to ${(featureThickness(feature) / 1000).toFixed(1)} km`);
  } else if (completedDrag?.mode === "layer-boundary") {
    renderInspector();
    const feature = state.features.find(item => item.id === completedDrag.id);
    const boundary = feature?.layers?.[completedDrag.layerBoundaryIndex]?.maxDepth;
    showToast(`Sublayer boundary set to ${(Number(boundary) / 1000).toFixed(1)} km`);
  }
  const topographyChanged = terrainDrawing;
  terrainDrawing = false;
  if (freehandDrawing && tool === "draw-freehand") {
    freehandDrawing = false;
    finishDrawing();
  }
  if (topographyChanged) updateAll(false);
});
canvas.addEventListener("pointerleave", () => {
  terrainDrawing = false;
  if (viewMode === "section") {
    hoverPoint = null;
    draw();
  }
});
canvas.addEventListener("pointercancel", () => {
  if (finishGravityLegendDrag(canvas)) return;
  cameraDrag = null;
  marqueeSelection = null;
  canvas.style.cursor = cameraPanMode || viewMode === "three-d" ? "grab" : "default";
  draw();
});
canvas.addEventListener("contextmenu", event => {
  event.preventDefault();
});
canvas.addEventListener("keydown", event => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    event.preventDefault();
    const amount = event.shiftKey ? 80 : 32;
    changeCamera({
      panX: event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0,
      panY: event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0
    });
  } else if (event.key === "Enter" && tool === "draw-points") {
    event.preventDefault();
    finishDrawing();
  } else if (event.key === "Enter" && tool === "section") {
    event.preventDefault();
    finishSectionPath();
  } else if (event.key === "Escape" && (tool === "draw-points" || tool === "draw-freehand")) {
    cancelDrawing();
  } else if ((event.key === "Delete" || event.key === "Backspace") && selectedPointIndex != null) {
    event.preventDefault();
    event.stopPropagation();
    const feature = state.features.find(item => item.id === selectedId);
    if (!feature) return;
    const geometry = FEATURE_TYPES[feature.model].geometry;
    const minimum = geometry === "area" ? 3 : geometry === "line" ? 2 : 1;
    if (feature.points.length > minimum) {
      feature.points.splice(selectedPointIndex, 1);
      selectedPointIndex = null;
      feature.geometryEdited = true;
      updateAll();
      showToast("Vertex removed");
    }
  }
});

secondaryCanvas.addEventListener("pointerdown", event => {
  setActiveViewport("secondary");
  secondaryCanvas.focus();
  const point = rawCanvasPoint(secondaryCanvas, event);
  if (beginGravityLegendDrag("secondary", secondaryCanvas, event, point)) return;
  const orbit = viewportModes.secondary === "three-d" && event.button === 0 && !cameraPanMode && !event.shiftKey;
  if (!(orbit || cameraPanMode || event.shiftKey || event.button === 1 || event.button === 2)) return;
  event.preventDefault();
  cameraDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, viewport: "secondary", mode: orbit ? "orbit" : "pan" };
  secondaryCanvas.style.cursor = "grabbing";
  secondaryCanvas.setPointerCapture(event.pointerId);
});
secondaryCanvas.addEventListener("pointermove", event => {
  const point = rawCanvasPoint(secondaryCanvas, event);
  if (moveGravityLegend(event, point)) return;
  if (!cameraDrag && gravityLegendHit("secondary", point)) {
    secondaryCanvas.style.cursor = "grab";
    return;
  }
  if (!cameraDrag || cameraDrag.viewport !== "secondary") return;
  const dx = event.clientX - cameraDrag.x; const dy = event.clientY - cameraDrag.y;
  cameraDrag.x = event.clientX; cameraDrag.y = event.clientY;
  if (cameraDrag.mode === "orbit") changeCamera({ orbitYawDelta: dx * .45, orbitPitchDelta: -dy * .35 });
  else changeCamera({ panX: dx, panY: dy });
});
secondaryCanvas.addEventListener("pointerup", () => {
  if (finishGravityLegendDrag(secondaryCanvas)) return;
  if (cameraDrag?.viewport !== "secondary") return;
  cameraDrag = null;
  secondaryCanvas.style.cursor = cameraPanMode || viewportModes.secondary === "three-d" ? "grab" : "default";
  persist();
});
secondaryCanvas.addEventListener("pointercancel", () => {
  if (finishGravityLegendDrag(secondaryCanvas)) return;
  if (cameraDrag?.viewport === "secondary") cameraDrag = null;
  secondaryCanvas.style.cursor = cameraPanMode || viewportModes.secondary === "three-d" ? "grab" : "default";
});
secondaryCanvas.addEventListener("dblclick", event => {
  const point = rawCanvasPoint(secondaryCanvas, event);
  if (!gravityLegendHit("secondary", point)) return;
  event.preventDefault();
  resetGravityLegend("secondary");
});
secondaryCanvas.addEventListener("wheel", event => {
  setActiveViewport("secondary");
  event.preventDefault();
  changeCamera({ zoomFactor: event.deltaY < 0 ? 1.1 : 1 / 1.1 });
}, { passive: false });
secondaryCanvas.addEventListener("keydown", event => {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  const amount = event.shiftKey ? 80 : 32;
  changeCamera({
    panX: event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0,
    panY: event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0
  });
});

document.querySelectorAll("[data-tool]").forEach(button => button.addEventListener("click", () => {
  setCameraPanMode(false);
  if (viewMode !== "plan") {
    viewMode = "plan";
    viewportModes[activeViewport] = "plan";
    document.querySelectorAll("[data-view]").forEach(item => item.classList.toggle("active", item.dataset.view === "plan"));
  }
  tool = button.dataset.tool;
  drawPoints = [];
  freehandDrawing = false;
  connectingFrom = null;
  sectionDraft = [];
  document.querySelectorAll("[data-tool]").forEach(item => item.classList.toggle("active", item === button));
  canvas.style.cursor = viewMode === "three-d" ? "grab" : tool === "connect" ? "crosshair" : "default";
  updateDrawingUI();
  syncSectionActions();
  draw();
}));
document.querySelector("#undo-section-point").addEventListener("click", () => {
  sectionDraft.pop();
  syncSectionActions();
  draw();
});
document.querySelector("#finish-section-path").addEventListener("click", finishSectionPath);
document.querySelector("#cancel-section-path").addEventListener("click", cancelSectionPath);
document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => {
  viewMode = button.dataset.view;
  viewportModes[activeViewport] = viewMode;
  if (activeViewport === "secondary") {
    state.ui.secondaryView = viewMode;
    persist();
  }
  document.querySelectorAll("[data-view]").forEach(item => item.classList.toggle("active", item === button));
  canvas.style.cursor = viewMode === "three-d" ? "grab" : viewMode === "plan" && tool === "connect" ? "crosshair" : "default";
  updateViewportLabels();
  draw();
}));
document.querySelectorAll("[data-palette-tab]").forEach(button => button.addEventListener("click", () => {
  const activePane = button.dataset.paletteTab;
  const topographyActive = activePane === "topography";
  document.querySelectorAll("[data-palette-tab]").forEach(item => item.classList.toggle("active", item === button));
  document.querySelector("#features-palette-pane").classList.toggle("hidden", activePane !== "features");
  document.querySelector("#topography-palette-pane").classList.toggle("hidden", activePane !== "topography");
  document.querySelector("#layers-palette-pane").classList.toggle("hidden", activePane !== "layers");
  if (!topographyActive && tool.startsWith("terrain-")) {
    tool = "select"; terrainDrawing = false; terrainSelection = []; canvas.style.cursor = "default";
  }
  updateTopographyUI();
  renderLayersPanel();
  draw();
}));
document.querySelectorAll("[data-scene-layer]").forEach(input => input.addEventListener("change", () => {
  state.sceneLayers = { ...DEFAULT_SCENE_LAYERS, ...(state.sceneLayers || {}) };
  state.sceneLayers[input.dataset.sceneLayer] = input.checked;
  persist(); draw();
}));
document.querySelector("#create-layer-group").addEventListener("click", () => {
  const input = document.querySelector("#new-layer-group-name");
  const name = input.value.trim() || `Group ${(state.layerGroups?.length || 0) + 1}`;
  const group = { id: `layer-group-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, visible: true };
  state.layerGroups = [...(state.layerGroups || []), group];
  const ids = selectedIds.size ? selectedIds : selectedId ? new Set([selectedId]) : new Set();
  state.features.forEach(feature => {
    if (ids.has(feature.id)) feature.layerGroup = group.id;
  });
  input.value = "";
  renderLayersPanel(); persist(); draw();
  showToast(ids.size ? `${name} created with ${ids.size} selected feature${ids.size === 1 ? "" : "s"}` : `${name} created`);
});
document.querySelector("#new-layer-group-name").addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  document.querySelector("#create-layer-group").click();
});
document.querySelector("#show-all-layers").addEventListener("click", () => {
  (state.layerGroups || []).forEach(group => { group.visible = true; });
  state.features.forEach(feature => {
    feature.visible = true;
    feature.hiddenSublayers = [];
  });
  renderLayersPanel(); persist(); draw();
  showToast("All feature layers shown");
});
document.querySelector("#hide-all-layers").addEventListener("click", () => {
  (state.layerGroups || []).forEach(group => { group.visible = false; });
  state.features.forEach(feature => { feature.visible = false; });
  renderLayersPanel(); persist(); draw();
  showToast("All feature layers hidden");
});
document.querySelector("#generate-terrain").addEventListener("click", generateTopography);
document.querySelectorAll("[data-terrain-tool]").forEach(button => button.addEventListener("click", () => {
  tool = `terrain-${button.dataset.terrainTool}`;
  viewMode = "plan";
  viewportModes[activeViewport] = "plan";
  terrainDrawing = false;
  if (tool !== "terrain-select") terrainSelection = [];
  document.querySelectorAll("[data-view]").forEach(item => item.classList.toggle("active", item.dataset.view === "plan"));
  document.querySelectorAll("[data-terrain-tool]").forEach(item => item.classList.toggle("active", item === button));
  canvas.style.cursor = tool === "terrain-select" ? "crosshair" : "cell";
  draw();
}));
document.querySelector("#selection-uplift").addEventListener("click", () => applyTerrainSelection(1));
document.querySelector("#selection-depress").addEventListener("click", () => applyTerrainSelection(-1));
document.querySelector("#load-etopo").addEventListener("click", loadEtopoRelief);
document.querySelector("#paleo-model").addEventListener("change", event => {
  ensurePaleogeography().model = event.target.value;
  syncPaleoAgeRange(true);
  state.paleogeography.age = Number(document.querySelector("#paleo-age").value);
  persist();
});
document.querySelector("#paleo-age").addEventListener("input", event => {
  syncPaleoAgeRange();
  ensurePaleogeography().age = Number(event.target.value);
  document.querySelector("#paleo-age-slider").value = event.target.value;
});
document.querySelector("#paleo-age").addEventListener("change", persist);
document.querySelector("#paleo-age-slider").addEventListener("input", event => {
  document.querySelector("#paleo-age").value = event.target.value;
  ensurePaleogeography().age = Number(event.target.value);
});
document.querySelector("#paleo-age-slider").addEventListener("change", persist);
document.querySelector("#paleo-anchor").addEventListener("change", event => {
  ensurePaleogeography().anchorPlateId = Number(event.target.value); persist();
});
document.querySelector("#load-paleogeography").addEventListener("click", () => loadPaleogeography(false));
document.querySelector("#load-local-gplates").addEventListener("click", () => loadPaleogeography(true));
document.querySelector("#build-paleo-relief").addEventListener("click", buildPaleoRelief);
document.querySelector("#convert-paleo-features").addEventListener("click", convertPaleoFeatures);
document.querySelector("#show-paleogeography").addEventListener("change", event => {
  ensurePaleogeography().visible = event.target.checked; persist(); draw();
});
document.querySelector("#import-topography").addEventListener("click", () => document.querySelector("#topography-file").click());
document.querySelector("#topography-file").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const extension = file.name.split(".").pop().toLowerCase();
    if (["png", "jpg", "jpeg"].includes(extension)) await importRasterTopography(file);
    else importTextTopography(await readFileWithProgress(file, `Opening topography ${file.name}`), extension);
    state.topography.source = `Imported · ${file.name}`;
    updateTopographyUI(); updateAll(false);
    showToast("Topography imported");
  } catch (error) {
    showToast(`Import failed: ${error.message}`);
  }
  event.target.value = "";
});
document.querySelector("#terrain-opacity").addEventListener("input", event => {
  ensureTopography().opacity = Number(event.target.value);
  ensureColorMaps().topography.opacity = Number(event.target.value);
  persist(); draw();
});
document.querySelector("#terrain-hillshade").addEventListener("change", event => {
  ensureTopography().hillshade = event.target.checked; persist(); draw();
});
document.querySelector("#apply-topography-features").addEventListener("change", event => {
  ensureTopography().exportToFeatures = event.target.checked;
  updateAll(false);
  showToast(event.target.checked ? "Topography will be exported per overlapping GWB plate" : "Topography conversion disabled");
});
document.querySelector("#topography-mode").addEventListener("change", event => {
  state.settings.topographyMode = event.target.value;
  updateTopographyUI();
  updateAll(false);
  showToast(event.target.value === "none"
    ? "Topography disabled for export"
    : event.target.value === "isostatic"
      ? "Isostatic density framework enabled"
      : "Terrain topography enabled");
});
document.querySelectorAll("[data-geographic-bound]").forEach(input => {
  input.addEventListener("input", event => {
    const keys = {
      west: "geographicSourceWest",
      east: "geographicSourceEast",
      south: "geographicSourceSouth",
      north: "geographicSourceNorth"
    };
    state.settings[keys[event.target.dataset.geographicBound]] = Number(event.target.value);
    document.querySelectorAll(`[data-geographic-bound="${event.target.dataset.geographicBound}"]`).forEach(peer => {
      if (peer !== event.target) peer.value = event.target.value;
    });
    persist();
  });
  input.addEventListener("change", () => {
    if (lithosphereTable && state.settings.coordinateSystem !== "spherical") applyLithosphereField();
  });
});
[
  ["background-density", "backgroundDensity", 1],
  ["gravity-magnitude", "gravityMagnitude", 1],
  ["compensation-depth", "compensationDepth", 1000],
  ["integration-points", "integrationPoints", 1],
  ["reference-profile-x", "referenceProfileX", 1],
  ["reference-profile-y", "referenceProfileY", 1]
].forEach(([id, key, scale]) => {
  document.querySelector(`#${id}`).addEventListener("input", event => {
    state.settings[key] = Number(event.target.value) * scale;
    updateAll(false);
  });
});
document.querySelector("#clear-topography").addEventListener("click", () => {
  state.topography = { ...DEFAULT_TOPOGRAPHY }; topographyImage = null; terrainSelection = [];
  updateTopographyUI(); updateAll(false); showToast("Topography cleared");
});
document.querySelector("#export-topography").addEventListener("click", () => {
  const topography = ensureTopography(); const bounds = terrainBounds();
  const rows = ["x,y,elevation_m"];
  for (let row = 0; row < topography.height; row++) for (let column = 0; column < topography.width; column++) {
    const x = bounds.west + column / Math.max(1, topography.width - 1) * (bounds.east - bounds.west);
    const y = bounds.north - row / Math.max(1, topography.height - 1) * (bounds.north - bounds.south);
    rows.push(`${x},${y},${topography.values[terrainIndex(column, row, topography)]}`);
  }
  download("gwb-topography.xyz.csv", `${rows.join("\n")}\n`, "text/csv");
});
const cameraGrip = document.querySelector("#camera-grip");
const cameraControls = document.querySelector(".camera-controls");
document.querySelector("#toggle-camera-controls").addEventListener("click", () => {
  state.ui.cameraControlsExpanded = !state.ui.cameraControlsExpanded;
  syncCameraControlsExpansion();
  requestAnimationFrame(positionCameraControls);
  persist();
});
cameraGrip.addEventListener("pointerdown", event => {
  event.preventDefault();
  event.stopPropagation();
  const rect = cameraControls.getBoundingClientRect();
  cameraControlsDrag = {
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top
  };
  cameraGrip.setPointerCapture(event.pointerId);
});
cameraGrip.addEventListener("pointermove", event => {
  if (!cameraControlsDrag || cameraControlsDrag.pointerId !== event.pointerId) return;
  const wrapRect = wrap.getBoundingClientRect();
  const maxX = Math.max(8, wrap.clientWidth - cameraControls.offsetWidth - 8);
  const maxY = Math.max(8, wrap.clientHeight - cameraControls.offsetHeight - 8);
  const left = Math.max(8, Math.min(maxX, event.clientX - wrapRect.left - cameraControlsDrag.offsetX));
  const top = Math.max(8, Math.min(maxY, event.clientY - wrapRect.top - cameraControlsDrag.offsetY));
  cameraControls.style.left = `${left}px`;
  cameraControls.style.top = `${top}px`;
  cameraControls.style.transform = "none";
  state.ui.cameraControls = { x: left / maxX, y: top / maxY };
});
cameraGrip.addEventListener("pointerup", event => {
  if (!cameraControlsDrag || cameraControlsDrag.pointerId !== event.pointerId) return;
  cameraControlsDrag = null;
  cameraGrip.releasePointerCapture(event.pointerId);
  persist();
  showToast("Camera controls moved · double-click the grip to dock left");
});
cameraGrip.addEventListener("pointercancel", () => { cameraControlsDrag = null; });
cameraGrip.addEventListener("dblclick", event => {
  event.preventDefault();
  state.ui.cameraControls = null;
  positionCameraControls();
  persist();
  showToast("Camera controls docked on the left");
});
document.querySelector("#zoom-out").addEventListener("click", () => changeCamera({ zoomFactor: 1 / 1.2 }));
document.querySelector("#zoom-in").addEventListener("click", () => changeCamera({ zoomFactor: 1.2 }));
document.querySelector("#rotate-left").addEventListener("click", () => changeCamera(viewMode === "three-d" ? { orbitYawDelta: -15 } : { rotationDelta: -15 }));
document.querySelector("#rotate-right").addEventListener("click", () => changeCamera(viewMode === "three-d" ? { orbitYawDelta: 15 } : { rotationDelta: 15 }));
document.querySelector("#pan-camera").addEventListener("click", () => {
  setCameraPanMode(!cameraPanMode);
  showToast(cameraPanMode ? "Pan enabled · drag anywhere on the canvas" : "Pan disabled");
});
document.querySelector("#reset-camera").addEventListener("click", () => {
  changeCamera({ reset: true });
  showToast("Camera reset");
});
document.querySelector("#toggle-palette-panel").addEventListener("click", () => {
  if (window.matchMedia("(max-width: 700px)").matches) {
    state.ui.compactPanel = state.ui.compactPanel === "palette" ? null : "palette";
    applyWorkspaceUI();
    persist();
    showToast(state.ui.compactPanel === "palette" ? "Feature library opened" : "Feature library closed");
    return;
  }
  state.ui.paletteCollapsed = !state.ui.paletteCollapsed;
  applyWorkspaceUI();
  persist();
  showToast(state.ui.paletteCollapsed ? "Feature library hidden · press [ to restore" : "Feature library shown");
});
document.querySelector("#toggle-inspector-panel").addEventListener("click", () => {
  if (window.matchMedia("(max-width: 700px)").matches) {
    state.ui.compactPanel = state.ui.compactPanel === "inspector" ? null : "inspector";
    applyWorkspaceUI();
    persist();
    showToast(state.ui.compactPanel === "inspector" ? "Properties opened" : "Properties closed");
    return;
  }
  state.ui.inspectorCollapsed = !state.ui.inspectorCollapsed;
  applyWorkspaceUI();
  persist();
  showToast(state.ui.inspectorCollapsed ? "Properties hidden · press ] to restore" : "Properties shown");
});
document.querySelector("#toggle-split-view").addEventListener("click", () => {
  state.ui.splitView = !state.ui.splitView;
  if (!state.ui.splitView) setActiveViewport("primary");
  applyWorkspaceUI();
  updateViewportLabels();
  persist();
  showToast(state.ui.splitView ? "Split view enabled · click A or B to select a viewport" : "Single viewport restored");
});
document.querySelector("#link-cameras").addEventListener("click", () => {
  state.ui.linkedCameras = !state.ui.linkedCameras;
  if (state.ui.linkedCameras) {
    const source = viewportCameras[activeViewport];
    viewportCameras.primary = { ...source };
    viewportCameras.secondary = { ...source };
    renderCamera = viewportCameras[activeViewport];
    Object.assign(state.appearance, {
      viewZoom: viewportCameras.primary.zoom,
      viewRotation: viewportCameras.primary.rotation,
      viewPanX: viewportCameras.primary.panX,
      viewPanY: viewportCameras.primary.panY
    });
    state.ui.secondaryCamera = { ...viewportCameras.secondary };
  }
  applyWorkspaceUI();
  persist();
  draw();
  showToast(state.ui.linkedCameras ? "Cameras linked" : "Cameras can now move independently");
});
document.querySelectorAll("[data-activate-viewport]").forEach(button => button.addEventListener("click", event => {
  event.stopPropagation();
  setActiveViewport(button.dataset.activateViewport);
  showToast(`Viewport ${activeViewport === "primary" ? "A" : "B"} active · toolbar controls apply here`);
}));
canvas.addEventListener("wheel", event => {
  setActiveViewport("primary");
  event.preventDefault();
  changeCamera({ zoomFactor: event.deltaY < 0 ? 1.1 : 1 / 1.1 });
}, { passive: false });
document.querySelector("#toggle-shape-editor").addEventListener("click", () => {
  const editor = document.querySelector("#shape-editor");
  const willOpen = editor.classList.contains("hidden");
  editor.classList.toggle("hidden", !willOpen);
  document.querySelector("#toggle-shape-editor").setAttribute("aria-expanded", String(willOpen));
});
document.querySelector("#close-shape-editor").addEventListener("click", () => {
  document.querySelector("#shape-editor").classList.add("hidden");
  document.querySelector("#toggle-shape-editor").setAttribute("aria-expanded", "false");
});
document.querySelector("#toggle-map-editor").addEventListener("click", () => {
  const editor = document.querySelector("#map-editor");
  const willOpen = editor.classList.contains("hidden");
  editor.classList.toggle("hidden", !willOpen);
  document.querySelector("#toggle-map-editor").setAttribute("aria-expanded", String(willOpen));
  syncMapEditor();
});
document.querySelector("#close-map-editor").addEventListener("click", () => {
  document.querySelector("#map-editor").classList.add("hidden");
  document.querySelector("#toggle-map-editor").setAttribute("aria-expanded", "false");
});
document.querySelector("#toggle-tomography").addEventListener("click", () => {
  const editor = document.querySelector("#tomography-editor");
  const willOpen = editor.classList.contains("hidden");
  editor.classList.toggle("hidden", !willOpen);
  document.querySelector("#toggle-tomography").setAttribute("aria-expanded", String(willOpen));
});
document.querySelector("#close-tomography").addEventListener("click", () => {
  document.querySelector("#tomography-editor").classList.add("hidden");
  document.querySelector("#toggle-tomography").setAttribute("aria-expanded", "false");
});
document.querySelector("#toggle-lithosphere").addEventListener("click", () => {
  const editor = document.querySelector("#lithosphere-editor");
  const willOpen = editor.classList.contains("hidden");
  editor.classList.toggle("hidden", !willOpen);
  document.querySelector("#toggle-lithosphere").setAttribute("aria-expanded", String(willOpen));
  if (willOpen) syncLithosphereUI();
});
document.querySelector("#close-lithosphere").addEventListener("click", () => {
  document.querySelector("#lithosphere-editor").classList.add("hidden");
  document.querySelector("#toggle-lithosphere").setAttribute("aria-expanded", "false");
});
document.querySelector("#toggle-planetary").addEventListener("click", () => {
  const editor = document.querySelector("#planetary-editor");
  const willOpen = editor.classList.contains("hidden");
  editor.classList.toggle("hidden", !willOpen);
  document.querySelector("#toggle-planetary").setAttribute("aria-expanded", String(willOpen));
  if (willOpen) renderPlanetaryCatalog();
});
document.querySelector("#close-planetary").addEventListener("click", () => {
  document.querySelector("#planetary-editor").classList.add("hidden");
  document.querySelector("#toggle-planetary").setAttribute("aria-expanded", "false");
});
document.querySelector("#toggle-research").addEventListener("click", () => {
  const editor = document.querySelector("#research-editor");
  const willOpen = editor.classList.contains("hidden");
  editor.classList.toggle("hidden", !willOpen);
  document.querySelector("#toggle-research").setAttribute("aria-expanded", String(willOpen));
  if (willOpen) {
    runResearchSearch();
    requestAnimationFrame(() => document.querySelector("#research-query").focus());
  }
});
document.querySelector("#close-research").addEventListener("click", () => {
  document.querySelector("#research-editor").classList.add("hidden");
  document.querySelector("#toggle-research").setAttribute("aria-expanded", "false");
});
document.querySelector("#run-research").addEventListener("click", runResearchSearch);
document.querySelector("#research-query").addEventListener("keydown", event => {
  if (event.key === "Enter") runResearchSearch();
});
document.querySelector("#research-query").addEventListener("input", () => {
  clearTimeout(researchTimer);
  researchTimer = setTimeout(runResearchSearch, 320);
});
document.querySelector("#research-scope").addEventListener("change", runResearchSearch);
document.querySelectorAll("[data-research-query]").forEach(button => button.addEventListener("click", () => {
  document.querySelector("#research-query").value = button.dataset.researchQuery;
  runResearchSearch();
}));
document.querySelector("#toggle-gravity").addEventListener("click", () => {
  const editor = document.querySelector("#gravity-editor");
  const willOpen = editor.classList.contains("hidden");
  editor.classList.toggle("hidden", !willOpen);
  document.querySelector("#toggle-gravity").setAttribute("aria-expanded", String(willOpen));
  if (willOpen) syncGravityUI();
});
document.querySelector("#close-gravity").addEventListener("click", () => {
  document.querySelector("#gravity-editor").classList.add("hidden");
  document.querySelector("#toggle-gravity").setAttribute("aria-expanded", "false");
});
const gravityInputKeys = {
  "gravity-field": "field", "gravity-reference-density": "referenceDensity",
  "gravity-topography-density": "topographyDensity", "gravity-samples-x": "samplesX",
  "gravity-samples-y": "samplesY", "gravity-residual-base": "residualBase", "gravity-opacity": "opacity"
};
Object.entries(gravityInputKeys).forEach(([id, key]) => document.querySelector(`#${id}`).addEventListener("input", event => {
  const gravity = ensureGravity();
  gravity[key] = event.target.tagName === "SELECT" ? event.target.value : Number(event.target.value);
  if (key === "opacity") ensureColorMaps().gravity.opacity = gravity.opacity;
  gravity.signature = null;
  if (gravity.enabled) computeGravityPreview(true);
  persist(); draw();
  if (document.querySelector("#gravity-workspace")?.open) {
    syncGravityWorkspaceControls();
    renderGravityWorkspace();
  }
}));
document.querySelector("#gravity-enabled").addEventListener("change", event => {
  const gravity = ensureGravity();
  gravity.enabled = event.target.checked;
  gravity.signature = null;
  if (gravity.enabled) computeGravityPreview(true);
  persist(); syncGravityUI(); draw();
});
document.querySelector("#recompute-gravity").addEventListener("click", () => {
  computeGravityPreview(true);
  persist(); draw();
  showToast("Gravity preview recomputed from current geometry and density");
});
document.querySelector("#import-gravity-observations").addEventListener("click", () => document.querySelector("#gravity-observation-file").click());
document.querySelector("#gravity-observation-file").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const observations = (await readFileWithProgress(file, `Opening gravity observations ${file.name}`)).split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const values = line.split(/[,\t; ]+/).slice(0, 3).map(Number);
      return values.every(Number.isFinite) ? { x: values[0], y: values[1], value: values[2] } : null;
    }).filter(Boolean);
    if (!observations.length) throw new Error("No numeric x, y, gravity rows found.");
    const gravity = ensureGravity();
    gravity.observations = observations;
    gravity.signature = null;
    gravity.field = "residual";
    computeGravityPreview(true);
    persist(); syncGravityUI(); draw();
    showToast(`${observations.length} gravity observations loaded`);
  } catch (error) {
    showToast(error.message || "Could not import observed gravity");
  } finally {
    event.target.value = "";
  }
});
document.querySelector("#clear-gravity-observations").addEventListener("click", () => {
  const gravity = ensureGravity();
  gravity.observations = [];
  gravity.signature = null;
  computeGravityPreview(true);
  persist(); syncGravityUI(); draw();
  showToast("Observed gravity removed");
});
document.querySelector("#open-gravity-workspace").addEventListener("click", () => {
  openGravityWorkspace({ recompute: true });
});
document.querySelector("#minimize-gravity-workspace").addEventListener("click", minimizeGravityWorkspace);
document.querySelector("#restore-gravity-workspace").addEventListener("click", () => openGravityWorkspace());
document.querySelector("#close-gravity-workspace").addEventListener("click", () => {
  state.ui.gravityWorkspaceMinimized = false;
  document.querySelector("#gravity-workspace").close();
  syncWorkspaceDock();
  persist();
});
document.querySelector("#refresh-gravity-workspace").addEventListener("click", () => {
  computeGravityPreview(true);
  renderGravityWorkspace();
});
document.querySelector("#gravity-workspace-field").addEventListener("change", event => {
  const gravity = ensureGravity();
  gravity.field = event.target.value;
  gravity.signature = null;
  computeGravityPreview(true);
  syncGravityUI();
  syncGravityWorkspaceControls();
  persist();
  draw();
  renderGravityWorkspace();
  showToast(`${gravityFieldLabel(gravity.field)} displayed in map, 3D and section profile`);
});
document.querySelector("#gravity-draw-section").addEventListener("click", () => {
  if (state.ui.gravityWorkspaceSectionPicking) {
    if (sectionDraft.length >= 2) {
      state.sectionPath = sectionDraft.map(point => [...point]);
      state.settings.section = [[...sectionDraft[0]], [...sectionDraft.at(-1)]];
      showToast(`Gravity section saved · ${sectionDraft.length} control points`);
    } else {
      showToast("Section drawing cancelled · at least two points are required");
    }
    sectionDraft = [];
    state.ui.gravityWorkspaceSectionPicking = false;
  } else {
    sectionDraft = [];
    state.ui.gravityWorkspaceSectionPicking = true;
    state.ui.gravityWorkspaceContourEditing = false;
    const grid = document.querySelector("#gravity-workspace-grid");
    if (!["triple", "map-section"].includes(grid.dataset.layout)) {
      grid.dataset.layout = "map-section";
      state.ui.gravityWorkspaceLayout = "map-section";
      document.querySelector("#gravity-workspace-layout").value = "map-section";
    }
    showToast("Click two or more points on the gravity map · curved sections are supported");
  }
  syncGravityWorkspaceControls();
  persist();
  draw();
  requestAnimationFrame(renderGravityWorkspace);
});
document.querySelector("#gravity-edit-contours").addEventListener("click", () => {
  const active = !state.ui.gravityWorkspaceContourEditing;
  state.ui.gravityWorkspaceContourEditing = active;
  state.ui.gravityWorkspaceSectionPicking = false;
  sectionDraft = [];
  if (active) state.ui.gravityWorkspaceContoursOnly = true;
  syncGravityWorkspaceControls();
  persist();
  renderGravityWorkspace();
  showToast(active
    ? "Contour editing enabled · select a feature, then drag a visible vertex"
    : "Contour editing finished");
});
document.querySelector("#toggle-gravity-feature-contours").addEventListener("click", () => {
  state.ui.gravityWorkspaceContoursOnly = !state.ui.gravityWorkspaceContoursOnly;
  syncGravityWorkspaceControls();
  persist();
  renderGravityWorkspace();
  showToast(state.ui.gravityWorkspaceContoursOnly
    ? "Gravity workspace · feature contours only"
    : "Gravity workspace · feature fills restored");
});
document.querySelector("#export-gravity-screenshot").addEventListener("click", exportGravityScreenshot);
document.querySelector("#gravity-workspace-layout").addEventListener("change", event => {
  document.querySelector("#gravity-workspace-grid").dataset.layout = event.target.value;
  state.ui.gravityWorkspaceLayout = event.target.value;
  persist();
  requestAnimationFrame(renderGravityWorkspace);
});
bindGravityWorkspaceCanvas(gravityMapCanvas, "plan");
bindGravityWorkspaceCanvas(gravity3DCanvas, "three-d");
bindGravityWorkspaceCanvas(gravitySectionCanvas, "section");
new ResizeObserver(() => requestAnimationFrame(renderGravityWorkspace)).observe(document.querySelector("#gravity-workspace-grid"));
document.querySelector("#toggle-appearance").addEventListener("click", () => {
  const editor = document.querySelector("#appearance-editor");
  const willOpen = editor.classList.contains("hidden");
  editor.classList.toggle("hidden", !willOpen);
  document.querySelector("#toggle-appearance").setAttribute("aria-expanded", String(willOpen));
  syncAppearanceEditor();
});
document.querySelector("#close-appearance").addEventListener("click", () => {
  document.querySelector("#appearance-editor").classList.add("hidden");
  document.querySelector("#toggle-appearance").setAttribute("aria-expanded", "false");
});
document.querySelector("#toggle-color-editor").addEventListener("click", () => {
  const editor = document.querySelector("#color-editor");
  const willOpen = editor.classList.contains("hidden");
  editor.classList.toggle("hidden", !willOpen);
  document.querySelector("#toggle-color-editor").setAttribute("aria-expanded", String(willOpen));
  if (willOpen) syncColorEditor();
});
document.querySelector("#close-color-editor").addEventListener("click", () => {
  document.querySelector("#color-editor").classList.add("hidden");
  document.querySelector("#toggle-color-editor").setAttribute("aria-expanded", "false");
});
document.querySelector("#color-field").addEventListener("change", syncColorEditor);
["color-preset", "color-min", "color-max", "color-reverse", "color-steps", "color-opacity"]
  .forEach(id => document.querySelector(`#${id}`).addEventListener("input", updateColorMapFromControls));
["color-low", "color-mid", "color-high"].forEach(id => document.querySelector(`#${id}`).addEventListener("input", () => {
  document.querySelector("#color-preset").value = "custom";
  updateColorMapFromControls();
}));
document.querySelector("#color-rescale-data").addEventListener("click", () => {
  const field = document.querySelector("#color-field").value;
  if (field === "gravity" && !ensureGravity().result) computeGravityPreview(true);
  const [minimum, maximum] = colorFieldRange(field);
  const map = ensureColorMaps()[field];
  map.min = minimum;
  map.max = maximum > minimum ? maximum : minimum + 1;
  if (field === "temperature") {
    state.appearance.temperatureMin = map.min;
    state.appearance.temperatureMax = map.max;
  }
  syncColorEditor();
  persist();
  draw();
  showToast(`${field[0].toUpperCase() + field.slice(1)} colors rescaled to visible data`);
});
document.querySelector("#color-reset").addEventListener("click", () => {
  const field = document.querySelector("#color-field").value;
  ensureColorMaps()[field] = structuredClone(DEFAULT_COLOR_MAPS[field]);
  if (field === "temperature") {
    state.appearance.temperatureMin = DEFAULT_COLOR_MAPS.temperature.min;
    state.appearance.temperatureMax = DEFAULT_COLOR_MAPS.temperature.max;
  } else if (field === "gravity") {
    ensureGravity().opacity = DEFAULT_COLOR_MAPS.gravity.opacity;
  } else if (field === "tomography") {
    state.tomography = { ...DEFAULT_TOMOGRAPHY, ...(state.tomography || {}), opacity: DEFAULT_COLOR_MAPS.tomography.opacity };
    document.querySelector("#tomography-opacity").value = state.tomography.opacity;
  } else {
    ensureTopography().opacity = DEFAULT_COLOR_MAPS.topography.opacity;
  }
  syncColorEditor();
  persist();
  draw();
  showToast("Color map reset");
});
document.querySelector("#export-screenshot").addEventListener("click", exportModelScreenshot);
const appearanceInputs = {
  "render-mode": ["renderMode", "value"],
  "theme-mode": ["theme", "value"],
  "render-shading": ["shading", "checked"],
  "render-light": ["light", "number"],
  "auto-temperature-preview": ["autoTemperaturePreview", "checked"],
  "temperature-contours": ["temperatureContours", "checked"],
  "slab-projection": ["slabProjection", "checked"],
  "temperature-min": ["temperatureMin", "number"],
  "temperature-max": ["temperatureMax", "number"]
};
Object.entries(appearanceInputs).forEach(([id, [key, kind]]) => {
  document.querySelector(`#${id}`).addEventListener("input", event => {
    state.appearance[key] = kind === "checked" ? event.target.checked
      : kind === "number" ? Number(event.target.value)
        : event.target.value;
    if (key === "theme") document.body.dataset.theme = state.appearance.theme;
    if (key === "temperatureMin" || key === "temperatureMax") {
      const map = ensureColorMaps().temperature;
      map.min = Number(state.appearance.temperatureMin);
      map.max = Number(state.appearance.temperatureMax);
      syncColorEditor();
    }
    persist();
    draw();
  });
});
document.querySelector("#tomography-current-bounds").addEventListener("click", () => {
  if (state.settings.coordinateSystem !== "spherical") {
    setTomographyStatus("The current grid is Cartesian. Enter longitude/latitude bounds or switch to a spherical chunk first.", "error");
    return;
  }
  const fields = {
    "tomography-west": state.settings.xMin, "tomography-east": state.settings.xMax,
    "tomography-south": state.settings.yMin, "tomography-north": state.settings.yMax
  };
  Object.entries(fields).forEach(([id, value]) => { document.querySelector(`#${id}`).value = value; });
  setTomographyStatus("Copied the current spherical grid bounds.", "success");
});
document.querySelector("#tomography-apply-bounds").addEventListener("click", () => {
  if (applyTomographyBounds()) {
    setTomographyStatus("Bounds applied to a 3D spherical chunk.", "success");
    showToast("Tomography area applied to model geometry");
  }
});
document.querySelector("#load-tomography").addEventListener("click", loadTomographySlice);
document.querySelector("#export-tomography-csv").addEventListener("click", exportTomographyCsv);
document.querySelector("#clear-tomography").addEventListener("click", () => {
  state.tomography = { ...DEFAULT_TOMOGRAPHY };
  if (state.background?.source === "SubMachine / ORFEUS") {
    state.background = null;
    referenceImage = null;
  }
  document.querySelector("#export-tomography-csv").disabled = true;
  document.querySelector("#clear-tomography").disabled = true;
  document.querySelector("#tomography-create-feature").disabled = true;
  setTomographyStatus("Tomography overlay cleared.", "success");
  updateTomographyIsoStatus();
  updateAll(false);
});
document.querySelector("#tomography-opacity").addEventListener("input", event => {
  state.tomography = { ...DEFAULT_TOMOGRAPHY, ...(state.tomography || {}), opacity: Number(event.target.value) };
  ensureColorMaps().tomography.opacity = Number(event.target.value);
  persist();
  draw();
});
["tomography-scalar-field", "tomography-vpvs-ratio", "tomography-iso-value", "tomography-iso-mode", "tomography-iso-thickness"]
  .forEach(id => document.querySelector(`#${id}`).addEventListener("input", event => {
    const keys = {
      "tomography-scalar-field": "scalarField",
      "tomography-vpvs-ratio": "vpVsRatio",
      "tomography-iso-value": "isoValue",
      "tomography-iso-mode": "isoMode",
      "tomography-iso-thickness": "isoThicknessKm"
    };
    const numeric = ["vpVsRatio", "isoValue", "isoThicknessKm"].includes(keys[id]);
    state.tomography = {
      ...DEFAULT_TOMOGRAPHY, ...(state.tomography || {}),
      [keys[id]]: numeric ? Number(event.target.value) : event.target.value
    };
    if (id === "tomography-scalar-field" || id === "tomography-vpvs-ratio") {
      const range = Math.abs(Number(document.querySelector("#tomography-range").value) || 1)
        / (state.tomography.scalarField === "dvp" ? Math.max(.1, Number(state.tomography.vpVsRatio)) : 1);
      const map = ensureColorMaps().tomography;
      map.min = -range; map.max = range;
      if (document.querySelector("#color-field").value === "tomography") syncColorEditor();
    }
    updateTomographyIsoStatus();
    persist();
    draw();
  }));
document.querySelector("#tomography-show-iso").addEventListener("change", event => {
  state.tomography = { ...DEFAULT_TOMOGRAPHY, ...(state.tomography || {}), showIso: event.target.checked };
  persist();
  draw();
});
document.querySelector("#tomography-create-feature").addEventListener("click", createFeatureFromTomographyIso);
document.querySelector("#choose-reference-image").addEventListener("click", () => document.querySelector("#reference-image-file").click());
document.querySelector("#reference-image-file").addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      referenceImage = image;
      state.background = {
        src: String(reader.result), name: file.name, opacity: 45, scale: 100,
        offsetX: 0, offsetY: 0, rotation: 0, fitMode: "contain",
        west: Number(state.settings.xMin), east: Number(state.settings.xMax),
        south: Number(state.settings.yMin), north: Number(state.settings.yMax)
      };
      syncMapEditor();
      updateAll(false);
      showToast("Reference image fitted to the plan");
    };
    image.onerror = () => showToast("That image format is not supported by this browser");
    image.src = String(reader.result);
  };
  reader.readAsDataURL(file);
});
const mapInputKeys = {
  "map-opacity": "opacity", "map-scale": "scale", "map-offset-x": "offsetX", "map-offset-y": "offsetY",
  "map-rotation": "rotation", "map-west": "west", "map-east": "east", "map-south": "south", "map-north": "north"
};
Object.entries(mapInputKeys).forEach(([id, key]) => document.querySelector(`#${id}`).addEventListener("input", event => {
  if (!state.background) return;
  state.background[key] = Number(event.target.value);
  updateAll(false);
}));
document.querySelector("#map-fit-mode").addEventListener("change", event => {
  if (!state.background) return;
  state.background.fitMode = event.target.value;
  updateAll(false);
  showToast(event.target.value === "stretch" ? "Image stretched to its bounds" : "Image aspect ratio preserved");
});
document.querySelector("#fit-map-to-grid").addEventListener("click", () => {
  fitReferenceMapToGrid();
  showToast("Reference image fitted to current bounds");
});
document.querySelector("#remove-reference-image").addEventListener("click", () => {
  state.background = null;
  referenceImage = null;
  syncMapEditor();
  updateAll(false);
  showToast("Reference image removed");
});
document.querySelectorAll("[data-draw-mode]").forEach(button => button.addEventListener("click", () => {
  viewMode = "plan";
  viewportModes[activeViewport] = "plan";
  document.querySelectorAll("[data-view]").forEach(item => item.classList.toggle("active", item.dataset.view === "plan"));
  tool = `draw-${button.dataset.drawMode}`;
  drawPoints = [];
  selectedPointIndex = null;
  canvas.style.cursor = "crosshair";
  updateDrawingUI();
  draw();
}));
document.querySelectorAll("[data-edit-mode]").forEach(button => button.addEventListener("click", () => {
  if (!selectedId) {
    showToast("Select a feature before editing vertices");
    return;
  }
  viewMode = "plan";
  viewportModes[activeViewport] = "plan";
  document.querySelectorAll("[data-view]").forEach(item => item.classList.toggle("active", item.dataset.view === "plan"));
  tool = button.dataset.editMode;
  canvas.style.cursor = tool === "remove-vertex" ? "not-allowed" : "copy";
  updateDrawingUI();
}));
document.querySelector("#finish-drawing").addEventListener("click", finishDrawing);
document.querySelector("#cancel-drawing").addEventListener("click", cancelDrawing);
document.querySelector("#smooth-geometry").addEventListener("change", draw);
document.querySelector("#reverse-feature").addEventListener("click", () => {
  const feature = state.features.find(item => item.id === selectedId);
  if (!feature) {
    showToast("Select a feature first");
    return;
  }
  feature.points.reverse();
  if (feature.dipPoint) {
    const center = feature.points.reduce((sum, point) => [sum[0] + point[0] / feature.points.length, sum[1] + point[1] / feature.points.length], [0, 0]);
    feature.dipPoint = [center[0] * 2 - feature.dipPoint[0], center[1] * 2 - feature.dipPoint[1]];
  }
  feature.geometryEdited = true;
  updateAll();
  showToast("Feature direction reversed");
});
document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll("[data-tab]").forEach(item => item.classList.toggle("active", item === button));
  document.querySelector("#properties-tab").classList.toggle("hidden", button.dataset.tab !== "properties");
  document.querySelector("#output-tab").classList.toggle("hidden", button.dataset.tab !== "output");
}));
document.querySelectorAll("[data-output]").forEach(button => button.addEventListener("click", () => {
  outputKind = button.dataset.output;
  document.querySelectorAll("[data-output]").forEach(item => item.classList.toggle("active", item === button));
  renderOutput();
}));

document.querySelector("#download-wb").addEventListener("click", () => download("world-builder-model.wb", buildWbText(), "application/json"));
document.querySelector("#download-grid").addEventListener("click", () => download("world-builder-model.grid", buildGrid(state.settings), "text/plain"));
const geometryExports = {
  vtp: {
    name: "world-builder-model.vtp", mime: "application/vnd.vtk.vtp+xml", build: buildVtp,
    message: "VTP PolyData exported · vtk.js and ParaView compatible"
  },
  vtk: {
    name: "world-builder-model.vtk", mime: "application/vnd.vtk", build: buildLegacyVtk,
    message: "Legacy ASCII VTK exported · physical point arrays included"
  },
  obj: {
    name: "world-builder-model.obj", mime: "text/plain", build: buildObj,
    message: "OBJ surface geometry exported"
  },
  geojson: {
    name: "world-builder-model.geojson", mime: "application/geo+json", build: buildGeoJson,
    message: "GeoJSON plan geometry exported · feature properties included"
  },
  csv: {
    name: "world-builder-model-vertices.csv", mime: "text/csv", build: buildGeometryCsv,
    message: "Geometry vertices and physical attributes exported as CSV"
  }
};
document.querySelectorAll("[data-geometry-export]").forEach(button => button.addEventListener("click", () => {
  if (!state.features.length) return showToast("Add or import at least one feature before exporting geometry");
  const exporter = geometryExports[button.dataset.geometryExport];
  if (!exporter) return;
  download(exporter.name, exporter.build(state.settings, state.features), exporter.mime);
  button.closest(".export-menu").open = false;
  showToast(exporter.message);
}));
document.querySelector("#save-project-state").addEventListener("click", () => {
  download("world-builder-project.gwbproject", `${JSON.stringify(buildProjectStateDocument(), null, 2)}\n`, "application/json");
  showToast("Complete editable project state downloaded");
});
document.querySelector("#open-project-state").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    restoreProjectStateDocument(JSON.parse(await readFileWithProgress(file, `Opening project ${file.name}`)));
    showToast(`${state.features.length} features restored from project state`);
  } catch (error) {
    showToast(error.message || "Could not open that project-state file");
  } finally {
    event.target.value = "";
  }
});
document.querySelector("#copy-output").addEventListener("click", async () => {
  await navigator.clipboard.writeText(document.querySelector("#output-code").textContent);
  showToast("Copied to clipboard");
});
document.querySelector("#undo-action").addEventListener("click", undoModelEdit);
document.querySelector("#redo-action").addEventListener("click", redoModelEdit);
document.querySelector("#new-project").addEventListener("click", () => {
  state = {
    settings: { ...DEFAULT_SETTINGS }, features: [], connections: [], rawWorld: null,
    appearance: { ...DEFAULT_APPEARANCE, ...(state.appearance || {}) },
    topography: { ...DEFAULT_TOPOGRAPHY },
    paleogeography: { ...DEFAULT_PALEOGEOGRAPHY },
    sceneLayers: { ...DEFAULT_SCENE_LAYERS },
    gravity: { ...DEFAULT_GRAVITY },
    tomography: { ...DEFAULT_TOMOGRAPHY },
    lithosphere: { ...DEFAULT_LITHOSPHERE },
    provenance: { tomographyModelIds: [], lithosphereModelIds: [] },
    exportOptions: { ...DEFAULT_EXPORT_OPTIONS },
    colorMaps: structuredClone(DEFAULT_COLOR_MAPS),
    colorMapVersion: COLOR_MAP_VERSION,
    layerGroups: [],
    ui: { ...DEFAULT_UI, ...(state.ui || {}) }
  };
  referenceImage = null;
  topographyImage = null;
  selectedId = null;
  selectedIds.clear();
  applyWorkspaceUI();
  syncSettingsForm();
  syncGravityUI();
  updateTopographyUI();
  updatePaleoUI();
  updateAll();
});
document.querySelector("#import-file").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const world = parseWorldBuilderText(await readFileWithProgress(file, `Importing ${file.name}`));
    loadWorld(world);
    showToast(`${state.features.length} features imported`);
  } catch {
    showToast("Could not read that World Builder file");
  }
});
document.querySelector("#fit-view").addEventListener("click", () => {
  fitDomainToFeatures();
  changeCamera({ reset: true });
  syncSettingsForm();
  updateAll(false);
  showToast("View fitted to model geometry");
});
document.querySelector("#open-examples").addEventListener("click", () => {
  document.querySelector("#examples-dialog").showModal();
  document.querySelector("#example-search").focus();
});
document.querySelector("#close-examples").addEventListener("click", () => document.querySelector("#examples-dialog").close());
document.querySelector("#example-search").addEventListener("input", event => { exampleQuery = event.target.value; renderExamples(); });
document.querySelector("#example-category").addEventListener("change", event => { exampleCategory = event.target.value; renderExamples(); });
document.querySelector("#tomography-catalog-search").addEventListener("input", renderTomographyCatalog);
document.querySelector("#tomography-catalog-provider").addEventListener("change", renderTomographyCatalog);
document.querySelector("#lithosphere-catalog-search").addEventListener("input", renderLithosphereCatalog);
document.querySelector("#lithosphere-catalog-provider").addEventListener("change", renderLithosphereCatalog);
document.querySelector("#planetary-catalog-search").addEventListener("input", renderPlanetaryCatalog);
document.querySelector("#planetary-catalog-family").addEventListener("change", renderPlanetaryCatalog);
document.querySelector("#lithosphere-file").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    installLithosphereTable(parseLithosphereTable(await readFileWithProgress(file, `Opening lithosphere table ${file.name}`)), file.name);
  } catch (error) {
    lithosphereTable = null;
    setLithosphereStatus(error.message || "Could not read this lithosphere table.", "error");
  } finally {
    event.target.value = "";
  }
});
document.querySelector("#apply-gwb-litho1").addEventListener("click", () => {
  const feature = state.features.find(item => item.id === selectedId);
  if (!feature) return showToast("Select a geological feature first");
  if (state.settings.coordinateSystem !== "spherical") return showToast("GWB LITHO1.0 surfaces require a spherical grid");
  const layer = document.querySelector("#gwb-litho1-layer").value;
  const target = document.querySelector("#gwb-litho1-target").value;
  const reference = `Litho1.0: ${layer}`;
  if (target === "topography") feature.lithoTopographyReference = reference;
  else feature.depthReferences = { ...(feature.depthReferences || {}), [target]: reference };
  selectLithosphereReference("litho1");
  updateAll();
  setLithosphereStatus(`${reference} will define ${target === "topography" ? "depth-surface topography" : `${target} depth`} for ${feature.name} in the exported .wb file.`, "success");
  showToast(`Bundled LITHO1.0 surface assigned to ${feature.name}`);
});
document.querySelector("#load-lithosphere-remote").addEventListener("click", async event => {
  const button = event.currentTarget;
  const model = document.querySelector("#lithosphere-remote-table").value;
  button.disabled = true;
  setLithosphereStatus("Downloading the EarthScope GeoCSV table…", "loading");
  try {
    const response = await fetchWithProgress(
      `/api/lithosphere/table?${new URLSearchParams({ model })}`, {}, "Downloading EarthScope CRUST1.0 table"
    );
    if (!response.ok) throw new Error(await response.text());
    selectLithosphereReference("crust1");
    installLithosphereTable(parseLithosphereTable(await response.text()), `EarthScope ${model.toUpperCase()}`);
  } catch (error) {
    setLithosphereStatus(error.message || "The EarthScope table could not be loaded.", "error");
  } finally {
    button.disabled = false;
  }
});
document.querySelector("#apply-lithosphere-field").addEventListener("click", applyLithosphereField);
document.querySelector("#lithosphere-opacity").addEventListener("input", event => {
  state.lithosphere = { ...DEFAULT_LITHOSPHERE, ...(state.lithosphere || {}), opacity: Number(event.target.value) };
  draw();
});
document.querySelector("#lithosphere-opacity").addEventListener("change", persist);
document.querySelector("#clear-lithosphere").addEventListener("click", () => {
  state.lithosphere = { ...DEFAULT_LITHOSPHERE, opacity: state.lithosphere?.opacity ?? 72 };
  lithosphereTable = null;
  document.querySelector("#lithosphere-field").innerHTML = "<option>No data fields</option>";
  document.querySelector("#lithosphere-field").disabled = true;
  document.querySelector("#apply-lithosphere-field").disabled = true;
  document.querySelector("#clear-lithosphere").disabled = true;
  document.querySelector("#lithosphere-file-name").textContent = "No local lithosphere table loaded";
  setLithosphereStatus("Local lithosphere preview cleared.");
  persist();
  updateAll(false);
});
["export-comments", "export-references"].forEach(id => document.querySelector(`#${id}`).addEventListener("change", event => {
  state.exportOptions = {
    ...DEFAULT_EXPORT_OPTIONS, ...(state.exportOptions || {}),
    [id === "export-comments" ? "comments" : "references"]: event.target.checked
  };
  persist();
  renderOutput();
}));

function closeFloatingEditors() {
  [
    ["shape-editor", "toggle-shape-editor"],
    ["map-editor", "toggle-map-editor"],
    ["tomography-editor", "toggle-tomography"],
    ["lithosphere-editor", "toggle-lithosphere"],
    ["research-editor", "toggle-research"],
    ["gravity-editor", "toggle-gravity"],
    ["appearance-editor", "toggle-appearance"]
  ].forEach(([editorId, toggleId]) => {
    document.querySelector(`#${editorId}`).classList.add("hidden");
    document.querySelector(`#${toggleId}`).setAttribute("aria-expanded", "false");
  });
  document.querySelectorAll(".toolbar-menu[open]").forEach(menu => { menu.open = false; });
}

function organizeTopographySections() {
  const pane = document.querySelector("#topography-palette-pane");
  if (!pane || pane.querySelector(".topography-disclosure")) return;
  const sections = [...pane.children].filter(child => child.classList.contains("topography-source"));
  const hasTopography = state.topography?.values?.length === state.topography?.width * state.topography?.height;
  sections.forEach((section, index) => {
    const titleNode = section.querySelector(":scope > small") || section.querySelector(".source-title-row small");
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    details.className = "topography-disclosure";
    const title = titleNode?.textContent?.trim() || `Topography section ${index + 1}`;
    details.open = state.settings.topographyMode === "isostatic"
      ? title.includes("ISOSTASY")
      : hasTopography ? index === sections.length - 1 : index === 0;
    summary.textContent = title;
    section.before(details);
    details.append(summary, section);
    details.addEventListener("toggle", () => {
      if (!details.open) return;
      pane.querySelectorAll(".topography-disclosure").forEach(other => {
        if (other !== details) other.open = false;
      });
    });
  });
}

document.querySelectorAll(".toolbar-menu").forEach(menu => {
  menu.addEventListener("toggle", () => {
    if (!menu.open) return;
    document.querySelectorAll(".toolbar-menu").forEach(other => {
      if (other !== menu) other.open = false;
    });
  });
});
document.querySelectorAll(".toolbar-menu-content button").forEach(button => {
  button.addEventListener("click", () => { button.closest(".toolbar-menu").open = false; });
});
document.addEventListener("pointerdown", event => {
  if (event.target.closest(".toolbar-menu")) return;
  document.querySelectorAll(".toolbar-menu[open]").forEach(menu => { menu.open = false; });
});

window.addEventListener("keydown", event => {
  const target = event.target;
  if (target.matches?.("input, textarea, select") || target.isContentEditable) return;
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "z") {
    event.preventDefault();
    if (event.shiftKey) redoModelEdit(); else undoModelEdit();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && key === "y") {
    event.preventDefault();
    redoModelEdit();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && key === "d") {
    event.preventDefault();
    duplicateSelectedFeature();
    return;
  }
  if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
    event.preventDefault();
    deleteSelectedFeature();
    return;
  }
  const shortcuts = {
    v: () => document.querySelector('[data-tool="select"]').click(),
    c: () => document.querySelector('[data-tool="connect"]').click(),
    s: () => document.querySelector('[data-tool="section"]').click(),
    h: () => document.querySelector("#pan-camera").click(),
    "1": () => document.querySelector('[data-view="plan"]').click(),
    "2": () => document.querySelector('[data-view="three-d"]').click(),
    "3": () => document.querySelector('[data-view="section"]').click(),
    f: () => document.querySelector("#fit-view").click(),
    "0": () => document.querySelector("#reset-camera").click(),
    "[": () => document.querySelector("#toggle-palette-panel").click(),
    "]": () => document.querySelector("#toggle-inspector-panel").click()
  };
  if (event.key === "Escape") {
    closeFloatingEditors();
    if (cameraPanMode) setCameraPanMode(false);
    if (tool === "section") {
      cancelSectionPath();
      return;
    }
    drawPoints = [];
    freehandDrawing = false;
    updateDrawingUI();
    return;
  }
  if (!shortcuts[key]) return;
  event.preventDefault();
  shortcuts[key]();
});

bindPlacementShapePicker();
document.querySelectorAll(".shape-editor, .map-editor").forEach(bindFloatingEditor);
renderPalette();
applyWorkspaceUI();
updateViewportLabels();
setActiveViewport("primary");
syncSettingsForm();
organizeTopographySections();
restoreReferenceImage();
restoreTopographyImage();
syncMapEditor();
syncAppearanceEditor();
syncColorEditor();
syncGravityUI();
syncTomographyUI();
syncLithosphereUI();
renderPlanetaryCatalog();
syncWorkspaceDock();
syncSectionActions();
updateTopographyUI();
updatePaleoUI();
renderLayersPanel();
updateCameraUI();
updateAll();
loadExampleCatalog();
new ResizeObserver(resize).observe(wrap);
window.addEventListener("resize", () => {
  applyWorkspaceUI();
  resize();
});
