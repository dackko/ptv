// ================= IMPORTS =================
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// ================= SETTINGS (settings.json) =================
const SETTINGS_URL = new URL("../settings.json", import.meta.url);

function reviveSettingsValue(value) {
  if (Array.isArray(value)) {
    return value.map(reviveSettingsValue);
  }

  if (value && typeof value === "object") {
    const next = {};
    Object.entries(value).forEach(([key, nestedValue]) => {
      next[key] = reviveSettingsValue(nestedValue);
    });
    return next;
  }

  if (typeof value === "string" && /^0x[0-9a-f]+$/i.test(value)) {
    return Number(value);
  }

  return value;
}

function attachDerivedSettings(rawSettings) {
  const settings =
    rawSettings && typeof rawSettings === "object" ? rawSettings : {};

  settings.HOTSPOT_LAYOUT_PRESETS ??= {};
  settings.HOTSPOT_COLORS ??= {};
  settings.HOTSPOT_CONNECTION_PAIRS ??= [];
  settings.HOTSPOT_DATA_SOURCES ??= [];
  settings.MAP_DOT_SOURCE ??= "./assets/map_dots.json";
  settings.CONFIG ??= {};
  settings.CONFIG.hotspots ??= {};
  settings.CONFIG.hotspots.layout ??= {};
  settings.CONFIG.hotspots.layout.presets ??= settings.HOTSPOT_LAYOUT_PRESETS;
  settings.CONFIG.hotspots.connectionPairs ??=
    settings.HOTSPOT_CONNECTION_PAIRS;

  return settings;
}

async function loadSettings() {
  const response = await fetch(SETTINGS_URL);
  if (!response.ok) {
    throw new Error(
      `Unable to load settings from ${SETTINGS_URL.pathname} (status ${response.status})`,
    );
  }

  const parsed = await response.json();
  return attachDerivedSettings(reviveSettingsValue(parsed));
}

const SETTINGS = await loadSettings();
const HOTSPOT_LAYOUT_PRESETS = SETTINGS.HOTSPOT_LAYOUT_PRESETS;
const HOTSPOT_COLORS = SETTINGS.HOTSPOT_COLORS;
const HOTSPOT_CONNECTION_PAIRS = SETTINGS.HOTSPOT_CONNECTION_PAIRS;
const HOTSPOT_DATA_SOURCES = SETTINGS.HOTSPOT_DATA_SOURCES;
const MAP_DOT_SOURCE = SETTINGS.MAP_DOT_SOURCE;
const CONFIG = SETTINGS.CONFIG;

// ================= CONSTANTS =================
const MAP_OFFSET_X = CONFIG.map.offsetX;
const GROUND_Y = CONFIG.map.offsetY;
const DOT_BASE_Y = GROUND_Y; // Base Y where dots sit on the map plane.

function getCylinderCenterY(height, lift = 0) {
  return DOT_BASE_Y + height / 2 + lift;
}

function getMapWorldX(x) {
  return x * SPACING + MAP_OFFSET_X;
}

function createDomedCylinderGeometry(
  topRadius,
  bottomRadius,
  height,
  radialSegments,
  domeHeightRatio,
  domeSegments,
) {
  const ratio = Math.max(0.08, Math.min(domeHeightRatio, 0.7));
  const domeHeight = Math.min(topRadius * ratio, height * 0.45);
  const cylinderHeight = Math.max(0.001, height - domeHeight);

  const cylinder = new THREE.CylinderGeometry(
    topRadius,
    bottomRadius,
    cylinderHeight,
    radialSegments,
    1,
    true,
  );

  const theta = 2 * Math.atan(domeHeight / topRadius);
  const sphereRadius = topRadius / Math.sin(theta);
  const dome = new THREE.SphereGeometry(
    sphereRadius,
    radialSegments,
    domeSegments,
    0,
    Math.PI * 2,
    0,
    theta,
  );

  const rimY = sphereRadius * Math.cos(theta);
  dome.translate(0, cylinderHeight / 2 - rimY, 0);

  const bottomCap = new THREE.CircleGeometry(bottomRadius, radialSegments);
  const topCap = new THREE.CircleGeometry(topRadius, radialSegments);
  topCap.rotateX(-Math.PI / 2);
  // Keep the top cap slightly inside to avoid z-fighting at the dome seam.
  topCap.translate(0, cylinderHeight / 2 - 0.0005, 0);

  bottomCap.rotateX(Math.PI / 2);
  bottomCap.translate(0, -cylinderHeight / 2, 0);

  const merged = mergeGeometries([cylinder, dome, topCap, bottomCap], true);
  merged.computeVertexNormals();
  merged.translate(0, -domeHeight / 2, 0);
  return merged;
}

function createCrystalHotspotGeometry(radius, height, radialSegments, preset = {}) {
  const segs = Math.max(3, Math.floor(radialSegments));
  const bodyRatio = Math.max(
    0.35,
    Math.min(0.82, preset.bodyHeightRatio ?? 0.64),
  );
  const bodyHeight = Math.max(0.04, height * bodyRatio);
  const tipHeight = Math.max(0.04, height - bodyHeight);
  const bodyTop = Math.max(0.01, radius * (preset.bodyTopScale ?? 0.42));
  const bodyBottom = Math.max(0.01, radius * (preset.bodyBottomScale ?? 1.0));

  const bodyCenterY = -height / 2 + bodyHeight / 2;
  const tipCenterY = bodyCenterY + bodyHeight / 2 + tipHeight / 2;

  const body = new THREE.CylinderGeometry(
    bodyTop,
    bodyBottom,
    bodyHeight,
    segs,
    1,
    false,
  );
  body.translate(0, bodyCenterY, 0);

  const tip = new THREE.ConeGeometry(
    Math.max(0.01, bodyTop * 1.14),
    tipHeight,
    segs,
    1,
    false,
  );
  tip.translate(0, tipCenterY, 0);

  const merged = mergeGeometries([body, tip], true);
  merged.computeVertexNormals();
  return merged;
}

function createOrbitalHotspotGeometry(
  topRadius,
  bottomRadius,
  height,
  radialSegments,
  domeHeightRatio,
  domeSegments,
  preset = {},
) {
  const core = createDomedCylinderGeometry(
    topRadius,
    bottomRadius,
    height,
    radialSegments,
    domeHeightRatio,
    domeSegments,
  );
  const majorRadius =
    Math.max(topRadius, bottomRadius) * (preset.ringScale ?? 1.25);
  const tubeRadius = Math.max(
    0.008,
    majorRadius * (preset.ringThickness ?? 0.14),
  );
  const ringTubularSegments = Math.max(
    10,
    Math.floor(radialSegments * 1.8),
  );
  const ringRadialSegments = Math.max(
    6,
    Math.floor(radialSegments * 0.6),
  );

  const ring = new THREE.TorusGeometry(
    majorRadius,
    tubeRadius,
    ringRadialSegments,
    ringTubularSegments,
  );
  ring.rotateX(Math.PI / 2);
  ring.translate(0, height * (preset.ringOffset ?? 0.08), 0);

  const merged = mergeGeometries([core, ring], true);
  merged.computeVertexNormals();
  return merged;
}

function createBeaconHotspotGeometry(radius, height, radialSegments, preset = {}) {
  const segs = Math.max(4, Math.floor(radialSegments));
  const tier1Ratio = Math.max(
    0.2,
    Math.min(0.7, preset.tier1HeightRatio ?? 0.44),
  );
  const tier2Ratio = Math.max(
    0.15,
    Math.min(0.55, preset.tier2HeightRatio ?? 0.33),
  );
  const tier1Height = Math.max(0.04, height * tier1Ratio);
  const tier2Height = Math.max(0.04, height * tier2Ratio);
  const tipHeight = Math.max(0.04, height - tier1Height - tier2Height);

  const tier1Radius = Math.max(0.01, radius * (preset.tier1RadiusScale ?? 1.0));
  const tier2Radius = Math.max(0.01, radius * (preset.tier2RadiusScale ?? 0.68));
  const tipRadius = Math.max(0.01, radius * (preset.tipRadiusScale ?? 0.34));

  const tier1CenterY = -height / 2 + tier1Height / 2;
  const tier2CenterY = tier1CenterY + tier1Height / 2 + tier2Height / 2;
  const tipCenterY = tier2CenterY + tier2Height / 2 + tipHeight / 2;

  const tier1 = new THREE.CylinderGeometry(
    tier1Radius * 0.9,
    tier1Radius,
    tier1Height,
    segs,
    1,
    false,
  );
  tier1.translate(0, tier1CenterY, 0);

  const tier2 = new THREE.CylinderGeometry(
    tier2Radius * 0.88,
    tier2Radius,
    tier2Height,
    segs,
    1,
    false,
  );
  tier2.translate(0, tier2CenterY, 0);

  const tip = new THREE.ConeGeometry(tipRadius, tipHeight, segs, 1, false);
  tip.translate(0, tipCenterY, 0);

  const merged = mergeGeometries([tier1, tier2, tip], true);
  merged.computeVertexNormals();
  return merged;
}

function getActiveHotspotLayoutPreset() {
  const layoutCfg = CONFIG.hotspots.layout ?? {};
  const presets = layoutCfg.presets ?? {};
  const activeName = layoutCfg.active ?? "classic";
  const fallback = presets.classic ?? {};
  return presets[activeName] ?? fallback;
}

function buildHotspotGeometryFromLayout() {
  const preset = getActiveHotspotLayoutPreset();
  const baseRadius = CONFIG.dots.radius * CONFIG.hotspots.radiusMultiplier;
  const baseHeight = CONFIG.dots.height * CONFIG.hotspots.heightMultiplier;

  const topRadius = Math.max(0.02, baseRadius * (preset.topScale ?? 1));
  const bottomRadius = Math.max(0.02, baseRadius * (preset.bottomScale ?? 1));
  const hotspotHeight = Math.max(0.08, baseHeight * (preset.heightScale ?? 1));
  const radialSegments = Math.max(
    4,
    Math.floor(preset.radialSegments ?? CONFIG.hotspots.radialSegments),
  );
  const domeHeightRatio = preset.domeHeightRatio ?? CONFIG.hotspots.dome.heightRatio;
  const domeSegments = Math.max(
    2,
    Math.floor(preset.domeSegments ?? CONFIG.hotspots.dome.segments),
  );

  let geometry = null;
  if (preset.geometry === "crystal") {
    geometry = createCrystalHotspotGeometry(
      Math.max(topRadius, bottomRadius),
      hotspotHeight,
      radialSegments,
      preset,
    );
  } else if (preset.geometry === "orbital") {
    geometry = createOrbitalHotspotGeometry(
      topRadius,
      bottomRadius,
      hotspotHeight,
      radialSegments,
      domeHeightRatio,
      domeSegments,
      preset,
    );
  } else if (preset.geometry === "beacon") {
    geometry = createBeaconHotspotGeometry(
      Math.max(topRadius, bottomRadius),
      hotspotHeight,
      radialSegments,
      preset,
    );
  } else {
    geometry = createDomedCylinderGeometry(
      topRadius,
      bottomRadius,
      hotspotHeight,
      radialSegments,
      domeHeightRatio,
      domeSegments,
    );
  }

  return { geometry, hotspotHeight, preset };
}

function getHotspotIdleLift(hs, elapsedTime = 0) {
  const idleCfg = CONFIG.hotspots.effects?.idle;
  if (!idleCfg?.enabled) return 0;

  const phase = hs.animationPhase ?? 0;
  return Math.sin(elapsedTime * idleCfg.speed + phase) * idleCfg.amplitude;
}

function getHotspotWorldPosition(hs, out) {
  const p = dotPositions[hs.dotIndex];
  const hotspotHeight =
    hs.height ?? CONFIG.dots.height * CONFIG.hotspots.heightMultiplier;
  out.set(
    getMapWorldX(p.x),
    getCylinderCenterY(hotspotHeight, p.lift + (hs.idleLift ?? 0)) +
      CONFIG.hotspots.connectionLine.heightOffset,
    -p.y * SPACING,
  );
}

function collectArcPointsBetween(a, b, lineCfg) {
  const segments = Math.max(1, Math.floor(lineCfg.segments));
  const points = [];

  for (let s = 0; s <= segments; s += 1) {
    const t = s / segments;
    const oneMinus = 1 - t;
    points.push(
      new THREE.Vector3(
        a.x * oneMinus + b.x * t,
        a.y * oneMinus +
          b.y * t +
          Math.sin(Math.PI * t) * lineCfg.arcHeight,
        a.z * oneMinus + b.z * t,
      ),
    );
  }

  return points;
}

function collectHotspotArcPoints() {
  const lineCfg = CONFIG.hotspots.connectionLine;
  const segments = Math.max(1, Math.floor(lineCfg.segments));
  const points = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  for (let i = 0; i < hotspotData.length - 1; i += 1) {
    getHotspotWorldPosition(hotspotData[i], a);
    getHotspotWorldPosition(hotspotData[i + 1], b);

    const start = i === 0 ? 0 : 1;
    for (let s = start; s <= segments; s += 1) {
      const t = s / segments;
      const oneMinus = 1 - t;
      points.push(
        new THREE.Vector3(
          a.x * oneMinus + b.x * t,
          a.y * oneMinus +
            b.y * t +
            Math.sin(Math.PI * t) * lineCfg.arcHeight,
          a.z * oneMinus + b.z * t,
        ),
      );
    }
  }

  return points;
}

function buildArcTubeGeometry(points, lineCfg) {
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
  const tubularSegments = Math.max(2, points.length * 2);
  const radius = Math.max(0.001, lineCfg.thickness);
  const radialSegments = Math.max(3, Math.floor(lineCfg.radialSegments));
  return new THREE.TubeGeometry(
    curve,
    tubularSegments,
    radius,
    radialSegments,
    false,
  );
}

function clearHotspotConnectionLine() {
  if (!hotspotLine) return;
  hotspotLine.geometry.dispose();
  hotspotLine.material.dispose();
  scene.remove(hotspotLine);
  hotspotLine = null;
}

function clearHotspotPairConnections() {
  hotspotPairLines.forEach((entry) => {
    entry.mesh.geometry.dispose();
    entry.mesh.material.dispose();
    scene.remove(entry.mesh);
  });
  hotspotPairLines = [];
}

function isSequentialConnectionEnabled() {
  const lineCfg = CONFIG.hotspots.connectionLine;
  return Boolean(lineCfg?.enabled && (lineCfg.drawSequential ?? false));
}

function updateHotspotConnectionLine() {
  if (!isSequentialConnectionEnabled()) {
    clearHotspotConnectionLine();
    return;
  }
  if (!hotspotLine) return;

  const lineCfg = CONFIG.hotspots.connectionLine;
  const points = collectHotspotArcPoints();
  if (points.length < 2) return;

  const nextGeometry = buildArcTubeGeometry(points, lineCfg);

  hotspotLine.geometry.dispose();
  hotspotLine.geometry = nextGeometry;
}

function findHotspotIndexById(id) {
  if (!id) return -1;
  const needle = String(id).toLowerCase();
  return hotspotData.findIndex(
    (hs) => String(hs.id).toLowerCase() === needle,
  );
}

function buildHotspotPairConnections() {
  if (!CONFIG.hotspots.connectionLine?.enabled) {
    clearHotspotPairConnections();
    return;
  }

  const pairs = CONFIG.hotspots.connectionPairs;
  if (!pairs || pairs.length === 0) {
    clearHotspotPairConnections();
    return;
  }

  clearHotspotPairConnections();

  const baseCfg = CONFIG.hotspots.connectionLine;

  pairs.forEach((pair) => {
    const fromIndex = findHotspotIndexById(pair.fromId);
    const toIndex = findHotspotIndexById(pair.toId);
    if (fromIndex < 0 || toIndex < 0) return;

    const cfg = {
      ...baseCfg,
      ...pair,
      color: pair.color ?? baseCfg.color,
      opacity: pair.opacity ?? baseCfg.opacity,
      arcHeight: pair.arcHeight ?? baseCfg.arcHeight,
      segments: pair.segments ?? baseCfg.segments,
      thickness: pair.thickness ?? baseCfg.thickness,
      radialSegments: pair.radialSegments ?? baseCfg.radialSegments,
      heightOffset: pair.heightOffset ?? baseCfg.heightOffset,
    };

    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    getHotspotWorldPosition(hotspotData[fromIndex], a);
    getHotspotWorldPosition(hotspotData[toIndex], b);

    const points = collectArcPointsBetween(a, b, cfg);
    const geometry = buildArcTubeGeometry(points, cfg);
    const material = new THREE.MeshBasicMaterial({
      color: cfg.color,
      transparent: cfg.opacity < 1,
      opacity: cfg.opacity,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    hotspotPairLines.push({ mesh, fromIndex, toIndex, cfg });
  });
}

function updateHotspotPairConnections() {
  if (!CONFIG.hotspots.connectionLine?.enabled) {
    clearHotspotPairConnections();
    return;
  }
  if (hotspotPairLines.length === 0) return;

  hotspotPairLines.forEach((entry) => {
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    getHotspotWorldPosition(hotspotData[entry.fromIndex], a);
    getHotspotWorldPosition(hotspotData[entry.toIndex], b);

    const points = collectArcPointsBetween(a, b, entry.cfg);
    const nextGeometry = buildArcTubeGeometry(points, entry.cfg);
    entry.mesh.geometry.dispose();
    entry.mesh.geometry = nextGeometry;
  });
}

// ================= HOTSPOTS =================
const HOTSPOTS = [];
async function loadHotspots(type, url) {
  return fetch(url)
    .then((res) => res.json())
    .then((data) => data.map((h) => ({ ...h, type })));
}

// Map hotspots
function latLonToMapXY(lat, lon, mapWidth = 20, mapHeight = 10) {
  const x = (lon / 180) * (mapWidth / 2);
  const y = (lat / 90) * (mapHeight / 2);
  return { x, y };
}

// ================= CONTAINER =================
const container = document.getElementById("map-container");

// ================= SCENE =================
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.map.backgroundColor);

// ================= CAMERA =================
const aspect = container.clientWidth / container.clientHeight;
const f = CONFIG.camera.frustumSize;

const camera = new THREE.OrthographicCamera(
  -f * aspect,
  f * aspect,
  f,
  -f,
  CONFIG.camera.near,
  CONFIG.camera.far,
);

// ================= CAMERA PERSISTENCE =================
const CAMERA_STORAGE_KEY = "map_camera_state";

function getSavedCameraState() {
  try {
    const raw = localStorage.getItem(CAMERA_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

function saveCameraState() {
  try {
    localStorage.setItem(
      CAMERA_STORAGE_KEY,
      JSON.stringify({
        px: camera.position.x,
        py: camera.position.y,
        pz: camera.position.z,
        zoom: camera.zoom,
        tx: controls.target.x,
        ty: controls.target.y,
        tz: controls.target.z,
      }),
    );
  } catch (_) {}
}

const savedCamera = getSavedCameraState();

if (savedCamera) {
  camera.position.set(savedCamera.px, savedCamera.py, savedCamera.pz);
  camera.zoom = savedCamera.zoom;
} else {
  camera.position.set(
    CONFIG.camera.position.x,
    CONFIG.camera.position.y,
    CONFIG.camera.position.z,
  );
  camera.zoom = CONFIG.camera.defaultZoom;
}
camera.updateProjectionMatrix();

camera.lookAt(savedCamera ? savedCamera.tx : 0, savedCamera ? savedCamera.ty : 0, savedCamera ? savedCamera.tz : 0);

// ================= RENDERER =================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(
  Math.min(window.devicePixelRatio, CONFIG.performance.maxPixelRatio),
);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

let mapDataRequested = false;
let mapStarted = false;
let animationStarted = false;
let canvasLogoSprite = null;
let canvasLogoAspect = 1;
const canvasLogoLocalPosition = new THREE.Vector3();

function initializeCanvasLogo() {
  const logoCfg = CONFIG.ui?.canvasLogo;
  if (!logoCfg?.enabled) return;

  const loader = new THREE.TextureLoader();
  loader.load(
    logoCfg.textureUrl,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

      const imageWidth = texture.image?.width ?? 1;
      const imageHeight = texture.image?.height ?? 1;
      canvasLogoAspect = imageWidth / imageHeight;

      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: logoCfg.opacity ?? 1,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      });

      canvasLogoSprite = new THREE.Sprite(material);
      canvasLogoSprite.frustumCulled = false;
      canvasLogoSprite.renderOrder = 1000;
      scene.add(canvasLogoSprite);
      updateCanvasLogoPlacement();
    },
    undefined,
    (error) => {
      console.error("Failed to load canvas logo texture:", error);
    },
  );
}

function updateCanvasLogoPlacement() {
  if (!canvasLogoSprite) return;

  const logoCfg = CONFIG.ui?.canvasLogo;
  if (!logoCfg?.enabled) return;

  const viewHeight = (camera.top - camera.bottom) / camera.zoom;
  const logoHeight = Math.max(
    0.01,
    viewHeight * (logoCfg.sizeByViewportHeight ?? 0.11),
  );
  const logoWidth = logoHeight * canvasLogoAspect;
  const placementMode = logoCfg.placementMode ?? "screen";

  if (placementMode === "map") {
    const { x, y } = latLonToMapXY(
      logoCfg.mapAnchorLat ?? -36,
      logoCfg.mapAnchorLon ?? 76,
    );
    canvasLogoSprite.position.set(
      getMapWorldX(x) + (logoCfg.mapAnchorXOffset ?? 0),
      DOT_BASE_Y + (logoCfg.mapAnchorYOffset ?? 0.02),
      -y * SPACING,
    );
  } else {
    const viewWidth = (camera.right - camera.left) / camera.zoom;
    const marginX = viewWidth * (logoCfg.marginXByViewportWidth ?? 0.03);
    const marginY = viewHeight * (logoCfg.marginYByViewportHeight ?? 0.04);

    const localX = viewWidth / 2 - logoWidth / 2 - marginX;
    const localY = -viewHeight / 2 + logoHeight / 2 + marginY;
    const localZ = -(camera.near + (logoCfg.cameraDistance ?? 1));

    camera.updateMatrixWorld();
    canvasLogoLocalPosition
      .set(localX, localY, localZ)
      .applyMatrix4(camera.matrixWorld);
    canvasLogoSprite.position.copy(canvasLogoLocalPosition);
  }
  canvasLogoSprite.scale.set(logoWidth, logoHeight, 1);
}

initializeCanvasLogo();

function loadMapData() {
  if (mapDataRequested) return;
  mapDataRequested = true;

  Promise.all(
    HOTSPOT_DATA_SOURCES.map(({ type, url }) => loadHotspots(type, url)),
  )
    .then((loadedHotspotGroups) => {
      HOTSPOTS.length = 0;
      loadedHotspotGroups.forEach((group) => {
        HOTSPOTS.push(...group);
      });
      return fetch(MAP_DOT_SOURCE);
    })
    .then((res) => res.json())
    .then(buildDotsFromFile)
    .catch((error) => {
      console.error("Failed to initialize map data:", error);
    });
}

function startMap() {
  if (mapStarted) return;

  mapStarted = true;

  loadMapData();
  if (!animationStarted) {
    animationStarted = true;
    animate();
  }
}

// ================= CONTROLS =================
const controls = new OrbitControls(camera, renderer.domElement);

// Safe Object.assign (only simple props)
Object.assign(controls, {
  enableDamping: CONFIG.controls.enableDamping,
  dampingFactor: CONFIG.controls.dampingFactor,
  enablePan: CONFIG.controls.enablePan,
  enableZoom: CONFIG.controls.enableZoom,
  enableRotate: CONFIG.controls.enableRotate,
  rotateSpeed: CONFIG.controls.rotateSpeed,
  zoomSpeed: CONFIG.controls.zoomSpeed,
  panSpeed: CONFIG.controls.panSpeed,
  screenSpacePanning: CONFIG.controls.screenSpacePanning,
});

// Restore saved orbit target
if (savedCamera) {
  controls.target.set(savedCamera.tx, savedCamera.ty, savedCamera.tz);
}

// Explicit constraints
controls.minPolarAngle = CONFIG.controls.minPolarAngle;
controls.maxPolarAngle = CONFIG.controls.maxPolarAngle;
controls.minZoom = CONFIG.controls.minZoom;
controls.maxZoom = CONFIG.controls.maxZoom;
controls.update();

// Save camera state whenever the user interacts
controls.addEventListener("change", saveCameraState);

// ================= SCROLL TRAP PREVENTION =================
// Disable controls by default so page scroll is never captured until the
// user explicitly clicks into the map.
controls.enabled = false;

const mapOverlay = document.getElementById("map-overlay");
let mapActive = false;
let isPointerDown = false;

function activateMap() {
  controls.enabled = true;
  mapActive = true;
  mapOverlay.style.display = "none";
}

function deactivateMap() {
  controls.enabled = false;
  mapActive = false;
  mapOverlay.style.display = "";
}

mapOverlay.addEventListener("click", activateMap);

// Touch: first tap activates (prevent the tap from also firing a click on the
// scene before the map is ready to handle it).
mapOverlay.addEventListener("touchend", (e) => {
  e.preventDefault();
  activateMap();
}, { passive: false });

// Release when the pointer leaves the container, but not mid-drag.
container.addEventListener("pointerleave", () => {
  if (isPointerDown) return;
  deactivateMap();
});

// Track drag state so we don't deactivate while the user is still dragging.
window.addEventListener("pointerup", () => {
  isPointerDown = false;
});

// Escape key releases focus.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && mapActive) deactivateMap();
});

// ================= LIGHTING =================
scene.add(new THREE.AmbientLight(0xffffff, CONFIG.lighting.ambientIntensity));

const dCfg = CONFIG.lighting.directional;
const dir = new THREE.DirectionalLight(0xffffff, dCfg.intensity);
dir.position.set(dCfg.position.x, dCfg.position.y, dCfg.position.z);
dir.castShadow = dCfg.castShadow;

dir.shadow.mapSize.set(dCfg.shadow.mapSize, dCfg.shadow.mapSize);
dir.shadow.camera.near = dCfg.shadow.near;
dir.shadow.camera.far = dCfg.shadow.far;
dir.shadow.camera.left = -dCfg.shadow.bounds;
dir.shadow.camera.right = dCfg.shadow.bounds;
dir.shadow.camera.top = dCfg.shadow.bounds;
dir.shadow.camera.bottom = -dCfg.shadow.bounds;
dir.shadow.bias = dCfg.shadow.bias;
dir.shadow.normalBias = dCfg.shadow.normalBias;
dir.shadow.autoUpdate = false;
dir.shadow.needsUpdate = true;

scene.add(dir);

// Shadow receiver plane
const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.ShadowMaterial({ opacity: dCfg.shadow.opacity }),
);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.position.y = GROUND_Y;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

// Soft top highlight (gives bright dot caps)
const topLight = new THREE.DirectionalLight(
  0xffffff,
  CONFIG.lighting.topLight.intensity,
);
topLight.position.set(
  CONFIG.lighting.topLight.position.x,
  CONFIG.lighting.topLight.position.y,
  CONFIG.lighting.topLight.position.z,
);
topLight.target.position.set(0, 0, 0);
scene.add(topLight.target);

scene.add(topLight);

// ================= DOTS =================
const {
  radius: DOT_RADIUS,
  height: DOT_HEIGHT,
  color: DOT_COLOR,
} = CONFIG.dots;

const SPACING = CONFIG.dots.spacing;

let dotMesh = null;
let dotPositions = [];

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const clock = new THREE.Clock();
let hoverProxyMesh = null;

function buildDotsFromFile(dots) {
  // --- create proxy FIRST ---

  const hoverProxyGeometry = new THREE.CylinderGeometry(
    DOT_RADIUS * 1.8,
    DOT_RADIUS * 1.8,
    DOT_HEIGHT * 2.5,
    12,
  );

  const hoverProxyMaterial = new THREE.MeshBasicMaterial({ visible: false });

  hoverProxyMesh = new THREE.InstancedMesh(
    hoverProxyGeometry,
    hoverProxyMaterial,
    dots.length,
  );

  hoverProxyMesh.frustumCulled = false;
  scene.add(hoverProxyMesh);

  const geometry = createDomedCylinderGeometry(
    DOT_RADIUS * CONFIG.dotGeometry.topRadiusFactor,
    DOT_RADIUS,
    DOT_HEIGHT * CONFIG.dotGeometry.heightMultiplier,
    CONFIG.dotGeometry.radialSegments,
    CONFIG.dots.dome.heightRatio,
    CONFIG.dots.dome.segments,
  );

  const sideMaterial = new THREE.MeshStandardMaterial({
    color: DOT_COLOR,
    roughness: CONFIG.dots.material.roughness,
    metalness: CONFIG.dots.material.metalness,
    flatShading: false,
  });
  const capMaterial = new THREE.MeshPhysicalMaterial({
    color: DOT_COLOR,
    roughness: CONFIG.dots.capMaterial.roughness,
    metalness: CONFIG.dots.capMaterial.metalness,
    clearcoat: CONFIG.dots.capMaterial.clearcoat,
    clearcoatRoughness: CONFIG.dots.capMaterial.clearcoatRoughness,
    flatShading: false,
  });

  dotMesh = new THREE.InstancedMesh(
    geometry,
    [sideMaterial, capMaterial, capMaterial, sideMaterial],
    dots.length,
  );
  const dummy = new THREE.Object3D();

  dots.forEach(([x, y], i) => {
    dotPositions[i] = {
      x,
      y,
      lift: 0,
      targetLift: 0,
      isHotspot: false,
      hotspotIndex: -1,
    };

    dummy.position.set(
      getMapWorldX(x),
      getCylinderCenterY(DOT_HEIGHT),
      -y * SPACING,
    );
    dummy.updateMatrix();
    dotMesh.setMatrixAt(i, dummy.matrix);
    hoverProxyMesh.setMatrixAt(i, dummy.matrix);
  });

  dotMesh.instanceMatrix.needsUpdate = true;
  dotMesh.frustumCulled = false;
  dotMesh.castShadow = true;
  hoverProxyMesh.instanceMatrix.needsUpdate = true;

  scene.add(dotMesh);
  // --- Build hotspot dots (BY TYPE) ---
  const {
    geometry: hotspotGeometry,
    hotspotHeight,
    preset: hotspotLayoutPreset,
  } = buildHotspotGeometryFromLayout();
  const glowCfg = CONFIG.hotspots.effects?.glow;
  const glowEnabled = Boolean(glowCfg?.enabled);
  const haloInnerRadius = Math.max(0.25, 1 - (glowCfg?.thickness ?? 0.16));
  const haloSegments = Math.max(16, Math.floor(glowCfg?.segments ?? 40));
  const haloBaseScale =
    CONFIG.dots.radius *
    CONFIG.hotspots.radiusMultiplier *
    Math.max(
      hotspotLayoutPreset.topScale ?? 1,
      hotspotLayoutPreset.bottomScale ?? 1,
    ) *
    (glowCfg?.radiusMultiplier ?? 2.2);
  const haloHeightOffset =
    hotspotHeight * (glowCfg?.heightFactor ?? 0.14) + (glowCfg?.yOffset ?? 0.02);
  const idlePhaseStep = CONFIG.hotspots.effects?.idle?.phaseStep ?? 0.55;
  hotspotHaloMeshes = {};

  // Group hotspots by type
  const grouped = {};
  HOTSPOTS.forEach((hs) => {
    grouped[hs.type] ??= [];
    grouped[hs.type].push(hs);
  });

  Object.entries(grouped).forEach(([type, list]) => {
    const sideMaterial = new THREE.MeshStandardMaterial({
      color: HOTSPOT_COLORS[type] ?? HOTSPOT_COLORS.default,
      roughness:
        hotspotLayoutPreset.sideRoughness ?? CONFIG.hotspots.material.roughness,
      metalness:
        hotspotLayoutPreset.sideMetalness ?? CONFIG.hotspots.material.metalness,
    });
    const capMaterial = new THREE.MeshPhysicalMaterial({
      color: HOTSPOT_COLORS[type] ?? HOTSPOT_COLORS.default,
      roughness:
        hotspotLayoutPreset.capRoughness ??
        CONFIG.hotspots.capMaterial.roughness,
      metalness:
        hotspotLayoutPreset.capMetalness ??
        CONFIG.hotspots.capMaterial.metalness,
      clearcoat:
        hotspotLayoutPreset.capClearcoat ?? CONFIG.hotspots.capMaterial.clearcoat,
      clearcoatRoughness:
        hotspotLayoutPreset.capClearcoatRoughness ??
        CONFIG.hotspots.capMaterial.clearcoatRoughness,
    });
    let haloMesh = null;
    let haloDummy = null;
    if (glowEnabled) {
      const haloGeometry = new THREE.RingGeometry(
        haloInnerRadius,
        1,
        haloSegments,
      );
      haloGeometry.rotateX(-Math.PI / 2);

      const haloMaterial = new THREE.MeshBasicMaterial({
        color: HOTSPOT_COLORS[type] ?? HOTSPOT_COLORS.default,
        transparent: true,
        opacity: glowCfg.opacity ?? 0.22,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });

      haloMesh = new THREE.InstancedMesh(haloGeometry, haloMaterial, list.length);
      haloMesh.frustumCulled = false;
      haloMesh.renderOrder = 2;
      haloDummy = new THREE.Object3D();
      hotspotHaloMeshes[type] = {
        mesh: haloMesh,
        baseScale: haloBaseScale,
        heightOffset: haloHeightOffset,
        pulseAmplitude: glowCfg.pulseAmplitude ?? 0.08,
        pulseSpeed: glowCfg.pulseSpeed ?? 1.3,
      };
      scene.add(haloMesh);
    }

    const mesh = new THREE.InstancedMesh(
      hotspotGeometry,
      [sideMaterial, capMaterial, capMaterial, sideMaterial],
      list.length,
    );

    // IMPORTANT: store type on mesh (used for raycasting)
    mesh.userData.type = type;
    mesh.userData.hotspotHeight = hotspotHeight;

    const dummy = new THREE.Object3D();

    list.forEach((hs, i) => {
      const { x, y } = latLonToMapXY(hs.lat, hs.lon);

      let bestIndex = -1;
      let bestDist = Infinity;

      dotPositions.forEach((p, idx) => {
        const dx = p.x - x;
        const dy = p.y - y;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          bestIndex = idx;
        }
      });

      dotPositions[bestIndex].isHotspot = true;
      dotPositions[bestIndex].hotspotIndex = hotspotData.length;

      hotspotData.push({
        ...hs,
        dotIndex: bestIndex,
        meshType: type,
        meshInstanceId: i,
        height: hotspotHeight,
        idleLift: 0,
        animationPhase: (bestIndex + i) * idlePhaseStep,
      });

      const p = dotPositions[bestIndex];
      dummy.position.set(
        getMapWorldX(p.x),
        getCylinderCenterY(hotspotHeight),
        -p.y * SPACING,
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      if (haloMesh && haloDummy) {
        haloDummy.position.set(
          getMapWorldX(p.x),
          getCylinderCenterY(hotspotHeight) + haloHeightOffset,
          -p.y * SPACING,
        );
        haloDummy.scale.setScalar(haloBaseScale);
        haloDummy.updateMatrix();
        haloMesh.setMatrixAt(i, haloDummy.matrix);
      }
    });

    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.castShadow = true;

    hotspotMeshes[type] = mesh;
    scene.add(mesh);
    if (haloMesh) {
      haloMesh.instanceMatrix.needsUpdate = true;
    }
  });

  buildHotspotConnectionLine();
  buildHotspotPairConnections();
  dir.shadow.needsUpdate = true;
}

function buildHotspotConnectionLine() {
  if (
    !isSequentialConnectionEnabled() ||
    hotspotData.length < 2
  ) {
    clearHotspotConnectionLine();
    return;
  }

  clearHotspotConnectionLine();

  const lineCfg = CONFIG.hotspots.connectionLine;
  const points = collectHotspotArcPoints();
  if (points.length < 2) return;

  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
  const tubularSegments = Math.max(2, points.length * 2);
  const radius = Math.max(0.001, lineCfg.thickness);
  const radialSegments = Math.max(3, Math.floor(lineCfg.radialSegments));
  const geometry = new THREE.TubeGeometry(
    curve,
    tubularSegments,
    radius,
    radialSegments,
    false,
  );

  const material = new THREE.MeshBasicMaterial({
    color: lineCfg.color,
    transparent: lineCfg.opacity < 1,
    opacity: lineCfg.opacity,
  });

  hotspotLine = new THREE.Mesh(geometry, material);
  hotspotLine.frustumCulled = false;
  scene.add(hotspotLine);
}

// Sync hotspot positions with dot lifts (called every frame)
function syncHotspotLift(elapsedTime = 0) {
  const dummy = new THREE.Object3D();
  const haloDummy = new THREE.Object3D();
  const glowEnabled = Boolean(CONFIG.hotspots.effects?.glow?.enabled);

  hotspotData.forEach((hs) => {
    const p = dotPositions[hs.dotIndex];
    const mesh = hotspotMeshes[hs.meshType];
    const hotspotHeight =
      hs.height ??
      mesh?.userData?.hotspotHeight ??
      CONFIG.dots.height * CONFIG.hotspots.heightMultiplier;
    const idleLift = getHotspotIdleLift(hs, elapsedTime);
    hs.idleLift = idleLift;
    const totalLift = p.lift + idleLift;

    dummy.position.set(
      getMapWorldX(p.x),
      getCylinderCenterY(hotspotHeight, totalLift),
      -p.y * SPACING,
    );
    dummy.updateMatrix();

    mesh.setMatrixAt(hs.meshInstanceId, dummy.matrix);

    if (glowEnabled) {
      const haloEntry = hotspotHaloMeshes[hs.meshType];
      if (haloEntry?.mesh) {
        const pulse =
          1 +
          Math.sin(
            elapsedTime * haloEntry.pulseSpeed + (hs.animationPhase ?? 0),
          ) *
            haloEntry.pulseAmplitude;

        haloDummy.position.set(
          getMapWorldX(p.x),
          getCylinderCenterY(hotspotHeight, totalLift) + haloEntry.heightOffset,
          -p.y * SPACING,
        );
        haloDummy.scale.setScalar(haloEntry.baseScale * pulse);
        haloDummy.updateMatrix();
        haloEntry.mesh.setMatrixAt(hs.meshInstanceId, haloDummy.matrix);
      }
    }
  });

  Object.values(hotspotMeshes).forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
  });
  if (glowEnabled) {
    Object.values(hotspotHaloMeshes).forEach((entry) => {
      entry.mesh.instanceMatrix.needsUpdate = true;
    });
  }

  updateHotspotConnectionLine();
  updateHotspotPairConnections();
}

// ================= HOTSPOT DOTS =================
let hotspotMeshes = {};
let hotspotHaloMeshes = {};
let hotspotData = [];
let hotspotLine = null;
let hotspotPairLines = [];

// ================= HOVER =================

let hoveredInstanceId = null;
let hoverCooldown = 0;
let liftActive = false;

function handleHover() {
  if (!dotMesh || !hoverProxyMesh) return;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(hoverProxyMesh);

  // Small hysteresis to prevent flicker
  if (hits.length) {
    const id = hits[0].instanceId;

    if (hoveredInstanceId !== id) {
      hoveredInstanceId = id;
      hoverCooldown = CONFIG.interaction.hoverCooldownFrames;
    }
  } else if (hoverCooldown <= 0) {
    hoveredInstanceId = null;
  }

  hoverCooldown = Math.max(hoverCooldown - 1, 0);

  if (hoveredInstanceId === null) return;

  const center = dotPositions[hoveredInstanceId];
  const { radius, maxLift } = CONFIG.hover;
  const outerRadius = radius * 1.4;
  const outerRadiusSq = outerRadius * outerRadius;
  const invRadius = 1 / radius;
  liftActive = true;

  dotPositions.forEach((p) => {
    const dx = (p.x - center.x) * SPACING;
    const dy = (p.y - center.y) * SPACING;
    const d2 = dx * dx + dy * dy;

    // Smooth falloff (Gaussian-like)
    if (d2 < outerRadiusSq) {
      const t = Math.sqrt(d2) * invRadius;
      p.targetLift = Math.max(p.targetLift, Math.exp(-t * t) * maxLift);
    }
  });
}

// ================= HOTSPOT INTERACTION =================
let activeHotspot = null;
const tooltip = document.getElementById("tooltip");
const TOOLTIP_MARGIN = 12;
const TOOLTIP_CURSOR_OFFSET = 14;
let pointerClientX = window.innerWidth * 0.5;
let pointerClientY = window.innerHeight * 0.5;

function positionTooltip(clientX, clientY) {
  const rect = tooltip.getBoundingClientRect();
  const tooltipWidth = rect.width;
  const tooltipHeight = rect.height;

  let left = clientX + TOOLTIP_CURSOR_OFFSET;
  let top = clientY - tooltipHeight - TOOLTIP_CURSOR_OFFSET;

  if (top < TOOLTIP_MARGIN) {
    top = clientY + TOOLTIP_CURSOR_OFFSET;
  }

  const maxLeft = window.innerWidth - tooltipWidth - TOOLTIP_MARGIN;
  const maxTop = window.innerHeight - tooltipHeight - TOOLTIP_MARGIN;

  left = Math.min(
    Math.max(left, TOOLTIP_MARGIN),
    Math.max(TOOLTIP_MARGIN, maxLeft),
  );
  top = Math.min(
    Math.max(top, TOOLTIP_MARGIN),
    Math.max(TOOLTIP_MARGIN, maxTop),
  );

  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
}

function updatePointerState(clientX, clientY) {
  pointerClientX = clientX;
  pointerClientY = clientY;
}

renderer.domElement.addEventListener("pointermove", (e) => {
  updatePointerState(e.clientX, e.clientY);
  if (activeHotspot) {
    positionTooltip(pointerClientX, pointerClientY);
  }

  // Update normalized device coords for raycasting
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  handleHotspots(false);
});

renderer.domElement.addEventListener("pointerdown", (e) => {
  isPointerDown = true;
  updatePointerState(e.clientX, e.clientY);

  // Update mouse coords immediately on tap
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  handleHotspots(true);
});

function handleHotspots(isClick = false) {
  raycaster.setFromCamera(mouse, camera);

  for (const mesh of Object.values(hotspotMeshes)) {
    const hits = raycaster.intersectObject(mesh);
    if (!hits.length) continue;

    const instanceId = hits[0].instanceId;
    const hs =
      hotspotData.find(
        (h) =>
          h.meshType === mesh.userData?.type && h.meshInstanceId === instanceId,
      ) || hotspotData.find((h) => h.meshInstanceId === instanceId);

    if (!hs) continue;

    if (isClick && activeHotspot === hs) {
      hideTooltip();
      return;
    }

    showTooltip(hs);
    return;
  }

  hideTooltip();
}

function showTooltip(hs) {
  activeHotspot = hs;

  tooltip.innerHTML = `<strong>${hs.label}</strong><br>${hs.message}`;
  tooltip.classList.add("visible");
  positionTooltip(pointerClientX, pointerClientY);
}

function hideTooltip() {
  activeHotspot = null;
  tooltip.classList.remove("visible");
}

function smoothLiftUpdate() {
  if (!dotMesh) return;
  if (!liftActive && hoveredInstanceId === null) return;

  const { easing, threshold } = CONFIG.hover;
  const dummy = new THREE.Object3D();
  let dirty = false;

  dotPositions.forEach((p, i) => {
    p.targetLift *= CONFIG.interaction.hoverFalloff;

    const delta = p.targetLift - p.lift;
    if (Math.abs(delta) > threshold) {
      p.lift += delta * easing;
      dirty = true;

      dummy.position.set(
        getMapWorldX(p.x),
        getCylinderCenterY(DOT_HEIGHT, p.lift),
        -p.y * SPACING,
      );
      dummy.updateMatrix();
      dotMesh.setMatrixAt(i, dummy.matrix);
      hoverProxyMesh.setMatrixAt(i, dummy.matrix);
    }
  });

  if (dirty) {
    dotMesh.instanceMatrix.needsUpdate = true;
    hoverProxyMesh.instanceMatrix.needsUpdate = true;
    dir.shadow.needsUpdate = true;
  }
  if (!dirty && hoveredInstanceId === null) {
    liftActive = false;
  }
}

// ================= LOOP =================
function animate() {
  requestAnimationFrame(animate);
  const elapsedTime = clock.getElapsedTime();
  controls.update();
  updateCanvasLogoPlacement();
  handleHover();
  smoothLiftUpdate();
  const idleEnabled = Boolean(CONFIG.hotspots.effects?.idle?.enabled);
  const glowEnabled = Boolean(CONFIG.hotspots.effects?.glow?.enabled);
  if (liftActive || idleEnabled || glowEnabled) {
    syncHotspotLift(elapsedTime);
  }
  renderer.render(scene, camera);
}

// ================= RESIZE =================
new ResizeObserver(() => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  const a = w / h;
  const f = CONFIG.camera.frustumSize;

  camera.left = -f * a;
  camera.right = f * a;
  camera.top = f;
  camera.bottom = -f;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, CONFIG.performance.maxPixelRatio),
  );
  updateCanvasLogoPlacement();
  if (activeHotspot) {
    positionTooltip(pointerClientX, pointerClientY);
  }
}).observe(container);

startMap();

