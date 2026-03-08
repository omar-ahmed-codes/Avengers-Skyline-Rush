import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";
import {
  createInitialState,
  GRID_HEIGHT,
  GRID_WIDTH,
  HEROES,
  isRoadRow,
  setHero,
  stepState,
} from "./gameLogic.js";

const HIGH_SCORES_KEY = "avengers-road-rush-high-scores";
const MOVE_INTERVAL_MS = 72;
const CELL_WIDTH = 1.08;
const LANE_DEPTH = 1.52;
const HERO_TRACK_Z = 2.7;

const HERO_MODEL_BY_ID = {
  captain: {
    primary: 0x1d4ca8,
    secondary: 0xda4451,
    skin: 0xf0c9a8,
    hair: 0x5c3a29,
    accessory: "shield",
    helmet: true,
  },
  ironman: {
    primary: 0xa02235,
    secondary: 0xe7b949,
    skin: 0xe0bf9f,
    hair: 0x422820,
    accessory: "arc",
    helmet: true,
  },
  thor: {
    primary: 0x44548e,
    secondary: 0xd0d7df,
    skin: 0xf2ccad,
    hair: 0xc18a47,
    accessory: "hammer",
    helmet: false,
  },
  hulk: {
    primary: 0x4f3f88,
    secondary: 0x49c25d,
    skin: 0x5ddd68,
    hair: 0x1f2f1f,
    accessory: "smash",
    bulky: true,
  },
  widow: {
    primary: 0x171922,
    secondary: 0xa9333d,
    skin: 0xedc4a6,
    hair: 0xb24731,
    accessory: "batons",
    helmet: false,
  },
  strange: {
    primary: 0x2f3f96,
    secondary: 0xd1483e,
    skin: 0xe9bf9f,
    hair: 0x3d2a22,
    accessory: "cape-orb",
    helmet: false,
  },
};

const VILLAIN_MODELS = {
  loki: {
    primary: 0x1f5a38,
    secondary: 0xdcb84d,
    skin: 0xebc5a7,
    hair: 0x2d2119,
    accessory: "horns",
  },
  ultron: {
    primary: 0x7f8b9e,
    secondary: 0xd4475f,
    skin: 0xa4b2c4,
    hair: 0x7f8b9e,
    accessory: "robot-eyes",
    helmet: true,
  },
  thanos: {
    primary: 0x53437a,
    secondary: 0xd3aa45,
    skin: 0xa475d4,
    hair: 0x2b2342,
    accessory: "gauntlet",
    bulky: true,
  },
  redskull: {
    primary: 0x2a2b31,
    secondary: 0xa9262f,
    skin: 0xd34b52,
    hair: 0x7e2026,
    accessory: "hydra",
  },
};

const KEY_TO_DIRECTION = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  W: "up",
  s: "down",
  S: "down",
  a: "left",
  A: "left",
  d: "right",
  D: "right",
};

const boardEl = document.querySelector("#board");
const scoreEl = document.querySelector("#score");
const levelEl = document.querySelector("#level");
const highScoreEl = document.querySelector("#high-score");
const statusEl = document.querySelector("#status");
const overlayEl = document.querySelector("#overlay");
const overlayTitleEl = document.querySelector("#overlay-title");
const overlaySubtitleEl = document.querySelector("#overlay-subtitle");
const overlayScoreEl = document.querySelector("#overlay-score");
const overlayHighEl = document.querySelector("#overlay-high");
const playEl = document.querySelector("#play");
const restartEl = document.querySelector("#restart");
const pauseEl = document.querySelector("#pause");
const soundEl = document.querySelector("#sound");
const controlsEl = document.querySelector(".controls");
const heroButtonsEl = document.querySelector("#heroes");
const scoresListEl = document.querySelector("#scores-list");

let state = createInitialState();
let queuedDirections = [];
let moveCooldownMs = 0;
let isPaused = true;
let hasStarted = false;
let hasStoredScore = false;
let soundEnabled = true;
let audioCtx = null;
let musicTimer = null;
let lastFrameTime = null;
let renderHeroX = state.heroX;
let heroFacing = "up";

let heroActor = null;
const villainActors = new Map();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06070f);
scene.fog = new THREE.Fog(0x06070f, 52, 150);

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);
camera.position.set(0, 7.6, -7.4);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.domElement.className = "game-canvas";
const existingCanvas = boardEl.querySelector("canvas");
if (existingCanvas) {
  existingCanvas.remove();
}
boardEl.prepend(renderer.domElement);

function toWorldX(x) {
  return ((GRID_WIDTH - 1) / 2 - x) * CELL_WIDTH;
}

function toWorldZ(y) {
  return (GRID_HEIGHT - 1 - y) * LANE_DEPTH;
}

function worldZForRow(worldRow, heroProgress) {
  return HERO_TRACK_Z + (worldRow - heroProgress) * LANE_DEPTH;
}

function villainKeyFromImage(url) {
  if (url.includes("Hiddleston")) return "loki";
  if (url.includes("Spader")) return "ultron";
  if (url.includes("Brolin")) return "thanos";
  return "redskull";
}

const farZ = toWorldZ(0);
const worldWidth = GRID_WIDTH * CELL_WIDTH + 1.6;
const worldDepth = farZ + 1.6;
let renderHeroProgress = state.heroWorldRow;

const ambientLight = new THREE.AmbientLight(0x8196cf, 0.68);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffd2a6, 1.05);
keyLight.position.set(-4, 13, -3);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 50;
keyLight.shadow.camera.left = -15;
keyLight.shadow.camera.right = 15;
keyLight.shadow.camera.top = 15;
keyLight.shadow.camera.bottom = -15;
scene.add(keyLight);

const fillLight = new THREE.PointLight(0x4ceeff, 0.85, 45, 1.4);
fillLight.position.set(0, 4, -2);
scene.add(fillLight);

const rimLight = new THREE.PointLight(0xff5b9f, 0.65, 40, 1.35);
rimLight.position.set(0, 5, farZ + 4);
scene.add(rimLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(worldWidth + 10, worldDepth + 120),
  new THREE.MeshStandardMaterial({
    color: 0x090d1b,
    roughness: 0.95,
    metalness: 0.05,
  }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, -0.02, HERO_TRACK_Z + 6);
floor.receiveShadow = true;
scene.add(floor);

const laneGroup = new THREE.Group();
scene.add(laneGroup);
const laneMeshes = [];

for (let y = 0; y < GRID_HEIGHT; y += 1) {
  const road = isRoadRow(y);
  const lane = new THREE.Mesh(
    new THREE.BoxGeometry(worldWidth, road ? 0.1 : 0.12, LANE_DEPTH * 0.93),
    new THREE.MeshStandardMaterial({
      color: road ? 0x1a2034 : 0x2a4a73,
      roughness: road ? 0.9 : 0.8,
      metalness: road ? 0.15 : 0.08,
    }),
  );

  lane.position.set(0, road ? 0.04 : 0.05, toWorldZ(y));
  lane.receiveShadow = true;
  laneGroup.add(lane);
  laneMeshes.push({ lane, y, road });
}

const skylineGroup = new THREE.Group();
scene.add(skylineGroup);

const neonWindows = [];
const airships = [];
const towerDrones = [];
let towerBeacon = null;
let towerBeamMaterial = null;

function seededNoise(value) {
  const raw = Math.sin(value * 127.1) * 43758.5453123;
  return raw - Math.floor(raw);
}

function createBuilding({ x, z, width, height, depth, color, windowColor, seed }) {
  const building = new THREE.Group();
  building.position.set(x, 0, z);

  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.78,
      metalness: 0.2,
      emissive: 0x0b1020,
      emissiveIntensity: 0.22,
    }),
  );
  shell.position.y = height / 2;
  shell.castShadow = true;
  shell.receiveShadow = true;
  building.add(shell);

  const windowCount = Math.max(8, Math.floor(width * height * 2.3));
  const windowMat = new THREE.MeshStandardMaterial({
    color: windowColor,
    emissive: windowColor,
    emissiveIntensity: 0.42,
    roughness: 0.28,
    metalness: 0.15,
  });

  for (let i = 0; i < windowCount; i += 1) {
    const lit = seededNoise(seed + i * 2.17) > 0.28;
    if (!lit) continue;

    const paneW = 0.08 + seededNoise(seed + i * 0.91) * 0.08;
    const paneH = 0.1 + seededNoise(seed + i * 1.31) * 0.14;
    const windowPane = new THREE.Mesh(
      new THREE.BoxGeometry(paneW, paneH, 0.02),
      windowMat.clone(),
    );
    windowPane.position.set(
      -width / 2 + 0.16 + seededNoise(seed + i * 1.77) * (width - 0.32),
      0.24 + seededNoise(seed + i * 2.03) * (height - 0.52),
      depth / 2 + 0.015,
    );
    building.add(windowPane);
    neonWindows.push(windowPane.material);
  }

  skylineGroup.add(building);
}

const cityStartZ = farZ + 9.5;
for (let i = -10; i <= 10; i += 1) {
  if (Math.abs(i) < 2) continue;

  const seed = i * 9.37;
  const width = 0.95 + seededNoise(seed + 1) * 1.3;
  const depth = 1 + seededNoise(seed + 2) * 1.6;
  const height = 3.2 + seededNoise(seed + 3) * 7.2 + Math.abs(i) * 0.12;
  const x = i * 1.55 + (seededNoise(seed + 4) - 0.5) * 0.55;
  const z = cityStartZ + Math.abs(i) * 0.35 + seededNoise(seed + 5) * 1.6;
  const hueShift = seededNoise(seed + 6);
  const tint = hueShift > 0.5 ? 0x1f2943 : 0x2a1d40;
  const windows = hueShift > 0.5 ? 0x5cf2ff : 0xff7bb4;

  createBuilding({
    x,
    z,
    width,
    height,
    depth,
    color: tint,
    windowColor: windows,
    seed,
  });
}

const towerGroup = new THREE.Group();
towerGroup.position.set(0, 0, farZ + 9.2);
scene.add(towerGroup);

const towerGlassMat = new THREE.MeshStandardMaterial({
  color: 0x364a71,
  roughness: 0.34,
  metalness: 0.52,
  emissive: 0x122544,
  emissiveIntensity: 0.36,
});

const towerFrameMat = new THREE.MeshStandardMaterial({
  color: 0x1f2b45,
  roughness: 0.6,
  metalness: 0.45,
});

const towerAccentMat = new THREE.MeshStandardMaterial({
  color: 0x73f7ff,
  roughness: 0.28,
  metalness: 0.62,
  emissive: 0x2ecfda,
  emissiveIntensity: 0.58,
});

const stackedSections = [
  { w: 4.1, d: 2.5, h: 2.2 },
  { w: 3.7, d: 2.3, h: 2.4 },
  { w: 3.25, d: 2.05, h: 2.5 },
  { w: 2.85, d: 1.85, h: 2.3 },
  { w: 2.45, d: 1.6, h: 2.05 },
  { w: 2.05, d: 1.4, h: 1.75 },
];

let yCursor = 0;
stackedSections.forEach((section) => {
  const shaft = new THREE.Mesh(
    new THREE.BoxGeometry(section.w, section.h, section.d),
    towerGlassMat,
  );
  yCursor += section.h / 2;
  shaft.position.y = yCursor;
  yCursor += section.h / 2;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  towerGroup.add(shaft);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(section.w + 0.12, 0.08, section.d + 0.12),
    towerFrameMat,
  );
  frame.position.y = shaft.position.y + section.h / 2 + 0.01;
  towerGroup.add(frame);
});

const northWing = new THREE.Mesh(
  new THREE.BoxGeometry(1.05, 7.4, 1.5),
  towerGlassMat,
);
northWing.position.set(-2.35, 3.7, -0.18);
northWing.castShadow = true;
northWing.receiveShadow = true;
towerGroup.add(northWing);

const southWing = new THREE.Mesh(
  new THREE.BoxGeometry(1.25, 9.1, 1.65),
  towerGlassMat,
);
southWing.position.set(2.25, 4.55, 0.15);
southWing.castShadow = true;
southWing.receiveShadow = true;
towerGroup.add(southWing);

const skybridge = new THREE.Mesh(
  new THREE.BoxGeometry(1.5, 0.36, 1.1),
  towerFrameMat,
);
skybridge.position.set(1.05, 7.8, 0.08);
towerGroup.add(skybridge);

const helipadDeck = new THREE.Mesh(
  new THREE.CylinderGeometry(1.16, 1.22, 0.18, 24),
  new THREE.MeshStandardMaterial({
    color: 0x212d47,
    roughness: 0.42,
    metalness: 0.58,
  }),
);
helipadDeck.position.y = 13.7;
helipadDeck.castShadow = true;
helipadDeck.receiveShadow = true;
towerGroup.add(helipadDeck);

const helipadRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.8, 0.05, 12, 30),
  new THREE.MeshStandardMaterial({
    color: 0xffd17c,
    emissive: 0xff9a3f,
    emissiveIntensity: 0.42,
    roughness: 0.3,
    metalness: 0.52,
  }),
);
helipadRing.rotation.x = Math.PI / 2;
helipadRing.position.y = 13.82;
towerGroup.add(helipadRing);

const towerRing = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.065, 12, 32), towerAccentMat);
towerRing.position.y = 12.55;
towerRing.rotation.x = Math.PI / 2;
towerGroup.add(towerRing);

const avengerLogoGroup = new THREE.Group();
avengerLogoGroup.position.set(0.12, 10.8, 1.38);
towerGroup.add(avengerLogoGroup);

const avengerLogoMat = new THREE.MeshStandardMaterial({
  color: 0xffd37f,
  roughness: 0.2,
  metalness: 0.72,
  emissive: 0xee8f2f,
  emissiveIntensity: 0.5,
});

const logoCircle = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.1, 14, 38), avengerLogoMat);
avengerLogoGroup.add(logoCircle);

const logoSlash = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.52, 0.1), avengerLogoMat);
logoSlash.rotation.z = 0.54;
logoSlash.position.set(0.05, -0.06, 0);
avengerLogoGroup.add(logoSlash);

const logoBar = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.11, 0.1), avengerLogoMat);
logoBar.position.set(0.18, 0.2, 0);
avengerLogoGroup.add(logoBar);

const spire = new THREE.Mesh(
  new THREE.CylinderGeometry(0.09, 0.16, 2.35, 12),
  new THREE.MeshStandardMaterial({
    color: 0x86bfff,
    roughness: 0.38,
    metalness: 0.76,
    emissive: 0x2d7fd0,
    emissiveIntensity: 0.24,
  }),
);
spire.position.y = 15.05;
spire.castShadow = true;
towerGroup.add(spire);

towerBeacon = new THREE.PointLight(0x79f4ff, 1.35, 24, 1.7);
towerBeacon.position.set(0, 16.38, 0);
towerGroup.add(towerBeacon);

towerBeamMaterial = new THREE.MeshBasicMaterial({
  color: 0x79f4ff,
  transparent: true,
  opacity: 0.22,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const towerBeam = new THREE.Mesh(new THREE.ConeGeometry(0.48, 7.1, 28, 1, true), towerBeamMaterial);
towerBeam.position.set(0, 19.8, 0);
towerBeam.rotation.x = Math.PI;
towerGroup.add(towerBeam);

function createAirship(index) {
  const ship = new THREE.Group();

  const hull = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 1.35, 16),
    new THREE.MeshStandardMaterial({
      color: index % 2 === 0 ? 0x8a9dbf : 0x6f8be2,
      roughness: 0.35,
      metalness: 0.55,
      emissive: 0x1a2236,
      emissiveIntensity: 0.25,
    }),
  );
  hull.rotation.z = Math.PI / 2;
  hull.castShadow = true;
  ship.add(hull);

  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 14, 14),
    new THREE.MeshStandardMaterial({
      color: 0xc8d8f7,
      roughness: 0.25,
      metalness: 0.45,
    }),
  );
  nose.position.x = 0.67;
  nose.castShadow = true;
  ship.add(nose);

  const tail = nose.clone();
  tail.position.x = -0.67;
  ship.add(tail);

  const finMat = new THREE.MeshStandardMaterial({
    color: 0xff7cb4,
    roughness: 0.25,
    metalness: 0.5,
    emissive: 0x8d2d66,
    emissiveIntensity: 0.35,
  });
  const finTop = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.5), finMat);
  finTop.position.set(-0.48, 0.2, 0);
  ship.add(finTop);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.18, 0.2),
    new THREE.MeshStandardMaterial({
      color: 0x222838,
      roughness: 0.5,
      metalness: 0.35,
    }),
  );
  cabin.position.set(0, -0.25, 0);
  ship.add(cabin);

  const engineLight = new THREE.PointLight(0xffa76a, 0.8, 6, 2);
  engineLight.position.set(-0.72, 0, 0);
  ship.add(engineLight);

  skylineGroup.add(ship);
  airships.push({
    ship,
    radius: 4.6 + index * 1.8,
    speed: 0.15 + index * 0.04,
    phase: index * 1.3,
    baseY: 3.8 + index * 0.7,
    baseZ: cityStartZ + 3 + index * 1.05,
  });
}

for (let i = 0; i < 4; i += 1) {
  createAirship(i);
}

for (let i = 0; i < 6; i += 1) {
  const drone = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0x95f6ff,
      emissive: 0x59d8e4,
      emissiveIntensity: 0.95,
      roughness: 0.2,
      metalness: 0.25,
    }),
  );
  scene.add(drone);
  towerDrones.push({
    drone,
    radius: 1 + i * 0.35,
    speed: 0.8 + i * 0.22,
    phase: i * ((Math.PI * 2) / 6),
    y: 10.6 + i * 0.42,
  });
}

function animateBackdrop(now) {
  if (towerBeacon) {
    towerBeacon.intensity = 1.05 + Math.sin(now * 2.4) * 0.4;
  }

  if (towerBeamMaterial) {
    towerBeamMaterial.opacity = 0.2 + Math.sin(now * 2.8) * 0.08;
  }

  towerRing.rotation.z = now * 0.4;

  airships.forEach((entry, index) => {
    const angle = now * entry.speed + entry.phase;
    const x = Math.sin(angle) * entry.radius;
    const z = entry.baseZ + Math.cos(angle * 0.6) * 2.2;
    const y = entry.baseY + Math.sin(angle * 1.8) * 0.28;
    const x2 = Math.sin(angle + 0.06) * entry.radius;
    const z2 = entry.baseZ + Math.cos((angle + 0.06) * 0.6) * 2.2;

    entry.ship.position.set(x, y, z);
    entry.ship.rotation.y = Math.atan2(x2 - x, z2 - z);
    entry.ship.rotation.z = Math.sin(now * 1.4 + index) * 0.08;
  });

  towerDrones.forEach((entry, index) => {
    const orbit = now * entry.speed + entry.phase;
    entry.drone.position.set(
      Math.sin(orbit) * entry.radius,
      entry.y + Math.sin(now * 2.2 + index) * 0.12,
      towerGroup.position.z + Math.cos(orbit) * entry.radius,
    );
  });

  neonWindows.forEach((material, index) => {
    const pulse = 0.38 + Math.sin(now * 2.3 + index * 0.23) * 0.18;
    material.emissiveIntensity = pulse;
  });
}

function part(geometry, material, position) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addAccessory(group, rig, model) {
  const accent = new THREE.MeshStandardMaterial({
    color: model.secondary,
    roughness: 0.35,
    metalness: 0.25,
    emissive: 0x111111,
  });

  if (model.accessory === "shield") {
    const disc = part(
      new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16),
      accent,
      new THREE.Vector3(0, -0.05, -0.2),
    );
    disc.rotation.x = Math.PI / 2;
    rig.leftArm.add(disc);

    const inner = part(
      new THREE.CylinderGeometry(0.12, 0.12, 0.083, 16),
      new THREE.MeshStandardMaterial({ color: 0x1f4ca8, roughness: 0.35, metalness: 0.25 }),
      new THREE.Vector3(0, -0.05, -0.17),
    );
    inner.rotation.x = Math.PI / 2;
    rig.leftArm.add(inner);
  }

  if (model.accessory === "arc") {
    const reactor = part(
      new THREE.SphereGeometry(0.11, 18, 18),
      new THREE.MeshStandardMaterial({
        color: 0x83f3ff,
        emissive: 0x4de4ff,
        emissiveIntensity: 0.95,
        roughness: 0.25,
        metalness: 0.1,
      }),
      new THREE.Vector3(0, 1.2, 0.27),
    );
    group.add(reactor);
  }

  if (model.accessory === "hammer") {
    const handle = part(
      new THREE.CylinderGeometry(0.045, 0.045, 0.42, 10),
      new THREE.MeshStandardMaterial({ color: 0x7d5c3d, roughness: 0.7, metalness: 0.1 }),
      new THREE.Vector3(0, -0.15, -0.1),
    );
    handle.rotation.z = 0.1;
    rig.rightArm.add(handle);

    const head = part(
      new THREE.BoxGeometry(0.22, 0.16, 0.16),
      new THREE.MeshStandardMaterial({ color: 0xa9b3bf, roughness: 0.35, metalness: 0.65 }),
      new THREE.Vector3(0, -0.32, -0.1),
    );
    rig.rightArm.add(head);
  }

  if (model.accessory === "batons") {
    const batonMat = new THREE.MeshStandardMaterial({ color: 0x2f3140, roughness: 0.35, metalness: 0.55 });
    const left = part(
      new THREE.CylinderGeometry(0.03, 0.03, 0.5, 10),
      batonMat,
      new THREE.Vector3(-0.15, 1.15, -0.22),
    );
    left.rotation.x = Math.PI * 0.25;
    group.add(left);

    const right = left.clone();
    right.position.x = 0.15;
    group.add(right);
  }

  if (model.accessory === "cape-orb") {
    const cape = part(
      new THREE.BoxGeometry(0.95, 0.82, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xc03f34, roughness: 0.65, metalness: 0.05 }),
      new THREE.Vector3(0, 1.05, -0.28),
    );
    group.add(cape);

    const orb = part(
      new THREE.SphereGeometry(0.1, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffc964,
        emissive: 0xffa226,
        emissiveIntensity: 0.65,
        roughness: 0.3,
        metalness: 0.2,
      }),
      new THREE.Vector3(0, 1.1, 0.28),
    );
    group.add(orb);
  }

  if (model.accessory === "smash") {
    const pulse = part(
      new THREE.TorusGeometry(0.28, 0.03, 10, 24),
      new THREE.MeshStandardMaterial({
        color: 0x8af69b,
        emissive: 0x3be35d,
        emissiveIntensity: 0.35,
        roughness: 0.2,
        metalness: 0.1,
      }),
      new THREE.Vector3(0, 0.34, 0),
    );
    pulse.rotation.x = Math.PI / 2;
    group.add(pulse);
  }

  if (model.accessory === "horns") {
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xdcb84d, roughness: 0.25, metalness: 0.7 });
    const leftHorn = part(
      new THREE.ConeGeometry(0.08, 0.35, 10),
      hornMat,
      new THREE.Vector3(-0.12, 1.92, 0),
    );
    leftHorn.rotation.z = -0.5;
    group.add(leftHorn);

    const rightHorn = leftHorn.clone();
    rightHorn.position.x = 0.12;
    rightHorn.rotation.z = 0.5;
    group.add(rightHorn);
  }

  if (model.accessory === "robot-eyes") {
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xff5776,
      emissive: 0xff3758,
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.2,
    });
    const eyeL = part(new THREE.BoxGeometry(0.08, 0.04, 0.03), eyeMat, new THREE.Vector3(-0.08, 1.66, 0.29));
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.08;
    group.add(eyeL, eyeR);
  }

  if (model.accessory === "gauntlet") {
    const gauntlet = part(
      new THREE.BoxGeometry(0.18, 0.28, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xd3aa45, roughness: 0.32, metalness: 0.68 }),
      new THREE.Vector3(0, -0.2, -0.05),
    );
    rig.rightArm.add(gauntlet);
  }

  if (model.accessory === "hydra") {
    const badge = part(
      new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12),
      new THREE.MeshStandardMaterial({
        color: 0x1fbbb6,
        emissive: 0x189791,
        emissiveIntensity: 0.4,
        roughness: 0.35,
        metalness: 0.5,
      }),
      new THREE.Vector3(0, 1.15, 0.28),
    );
    badge.rotation.x = Math.PI / 2;
    group.add(badge);
  }
}

function createBlockCharacter(model) {
  const root = new THREE.Group();

  const primaryMat = new THREE.MeshStandardMaterial({
    color: model.primary,
    roughness: 0.42,
    metalness: 0.15,
  });
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: model.secondary,
    roughness: 0.38,
    metalness: 0.25,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: model.skin,
    roughness: 0.5,
    metalness: 0.05,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: model.hair,
    roughness: 0.6,
    metalness: 0.05,
  });

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const torso = part(
    new THREE.BoxGeometry(model.bulky ? 0.78 : 0.66, model.bulky ? 0.88 : 0.84, 0.44),
    primaryMat,
    new THREE.Vector3(0, 1.1, 0),
  );
  bodyGroup.add(torso);

  const chestPlate = part(
    new THREE.BoxGeometry(model.bulky ? 0.54 : 0.46, 0.22, 0.05),
    secondaryMat,
    new THREE.Vector3(0, 1.2, 0.24),
  );
  bodyGroup.add(chestPlate);

  const head = part(
    new THREE.BoxGeometry(0.42, 0.42, 0.42),
    skinMat,
    new THREE.Vector3(0, 1.67, 0),
  );
  bodyGroup.add(head);

  if (model.helmet) {
    const helmet = part(
      new THREE.BoxGeometry(0.5, 0.2, 0.5),
      secondaryMat,
      new THREE.Vector3(0, 1.88, 0),
    );
    bodyGroup.add(helmet);
  } else {
    const hair = part(
      new THREE.BoxGeometry(0.46, 0.16, 0.46),
      hairMat,
      new THREE.Vector3(0, 1.88, 0),
    );
    bodyGroup.add(hair);
  }

  const leftArm = new THREE.Group();
  leftArm.position.set(model.bulky ? -0.55 : -0.45, 1.2, 0);
  bodyGroup.add(leftArm);
  leftArm.add(
    part(
      new THREE.BoxGeometry(model.bulky ? 0.24 : 0.2, 0.7, 0.2),
      primaryMat,
      new THREE.Vector3(0, -0.35, 0),
    ),
  );

  const rightArm = new THREE.Group();
  rightArm.position.set(model.bulky ? 0.55 : 0.45, 1.2, 0);
  bodyGroup.add(rightArm);
  rightArm.add(
    part(
      new THREE.BoxGeometry(model.bulky ? 0.24 : 0.2, 0.7, 0.2),
      primaryMat,
      new THREE.Vector3(0, -0.35, 0),
    ),
  );

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.16, 0.69, 0);
  bodyGroup.add(leftLeg);
  leftLeg.add(part(new THREE.BoxGeometry(0.22, 0.68, 0.25), secondaryMat, new THREE.Vector3(0, -0.34, 0)));

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.16, 0.69, 0);
  bodyGroup.add(rightLeg);
  rightLeg.add(part(new THREE.BoxGeometry(0.22, 0.68, 0.25), secondaryMat, new THREE.Vector3(0, -0.34, 0)));

  addAccessory(bodyGroup, { leftArm, rightArm, leftLeg, rightLeg }, model);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 22),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.27,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  root.add(shadow);

  root.userData = {
    bodyGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    head,
    shadow,
    phase: Math.random() * Math.PI * 2,
    walkSpeed: model.bulky ? 8.4 : 10,
    bounce: model.bulky ? 0.03 : 0.045,
  };

  return root;
}

function animateCharacter(actor, now, motion) {
  const data = actor.userData;
  const phase = now * data.walkSpeed + data.phase;
  const swing = Math.sin(phase) * 0.58 * motion;

  data.leftArm.rotation.x = swing;
  data.rightArm.rotation.x = -swing;
  data.leftLeg.rotation.x = -swing;
  data.rightLeg.rotation.x = swing;
  data.head.rotation.y = Math.sin(phase * 0.45) * 0.08;

  data.bodyGroup.position.y =
    Math.abs(Math.sin(phase)) * data.bounce * motion +
    Math.sin(phase * 0.2) * 0.01;

  data.shadow.scale.setScalar(0.96 - Math.sin(phase) * 0.03);
}

function spawnHeroActor() {
  if (heroActor) {
    scene.remove(heroActor);
  }

  const heroId = HEROES[state.heroIndex].id;
  const model = HERO_MODEL_BY_ID[heroId] ?? HERO_MODEL_BY_ID.captain;
  heroActor = createBlockCharacter(model);
  scene.add(heroActor);
}

spawnHeroActor();

function getHighScores() {
  try {
    const raw = localStorage.getItem(HIGH_SCORES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((value) => Number.isFinite(value) && value >= 0).slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

function saveHighScore(score) {
  const scores = [...getHighScores(), score].sort((a, b) => b - a).slice(0, 5);
  localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(scores));
  return scores;
}

function renderHighScores(list = getHighScores()) {
  scoresListEl.innerHTML = "";
  if (!list.length) {
    const li = document.createElement("li");
    li.textContent = "No runs yet";
    scoresListEl.appendChild(li);
  } else {
    list.forEach((value) => {
      const li = document.createElement("li");
      li.textContent = String(value);
      scoresListEl.appendChild(li);
    });
  }
  highScoreEl.textContent = String(list[0] ?? 0);
  overlayHighEl.textContent = String(list[0] ?? 0);
}

function showOverlay(mode) {
  overlayEl.classList.add("visible");
  overlayScoreEl.textContent = String(state.score);
  overlayHighEl.textContent = highScoreEl.textContent;

  if (mode === "start") {
    overlayTitleEl.textContent = "Avengers: Skyline Rush";
    overlaySubtitleEl.textContent = "Press Play to launch your run.";
    playEl.hidden = false;
    restartEl.hidden = true;
    return;
  }

  overlayTitleEl.textContent = "Mission Failed";
  overlaySubtitleEl.textContent = "Villains got you. Restart and beat your high score.";
  playEl.hidden = true;
  restartEl.hidden = false;
}

function hideOverlay() {
  overlayEl.classList.remove("visible");
}

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new window.AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playTone(
  freq,
  duration,
  { type = "sawtooth", gainValue = 0.06, start = 0, detune = 0 } = {},
) {
  if (!soundEnabled) return;
  ensureAudio();

  const now = audioCtx.currentTime + start;
  const osc = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  filter.type = "lowpass";
  filter.frequency.value = 1800;

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.03);
}

function startMusicLoop() {
  if (musicTimer) return;
  let step = 0;
  const bassLine = [55, null, 55, null, 65, null, 49, null];
  const leadLine = [
    220,
    null,
    247,
    null,
    262,
    null,
    247,
    null,
    220,
    null,
    196,
    null,
    175,
    null,
    196,
    null,
  ];

  musicTimer = setInterval(() => {
    if (!soundEnabled || isPaused || state.isGameOver) {
      step += 1;
      return;
    }

    const bass = bassLine[step % bassLine.length];
    if (bass) {
      playTone(bass, 0.22, { type: "square", gainValue: 0.05 });
      playTone(bass * 2, 0.16, {
        type: "triangle",
        gainValue: 0.02,
        start: 0.02,
      });
    }

    const lead = leadLine[step % leadLine.length];
    if (lead) {
      playTone(lead, 0.14, {
        type: "sawtooth",
        gainValue: 0.03,
        detune: step % 4 === 0 ? 4 : 0,
      });
    }

    step += 1;
  }, 170);
}

function stopMusicLoop() {
  if (!musicTimer) return;
  clearInterval(musicTimer);
  musicTimer = null;
}

function playMoveSound() {
  playTone(212, 0.05, { type: "square", gainValue: 0.05 });
}

function playLevelSound() {
  playTone(262, 0.1, { type: "triangle", start: 0 });
  playTone(330, 0.1, { type: "triangle", start: 0.1 });
  playTone(392, 0.14, { type: "triangle", start: 0.2 });
}

function playCrashSound() {
  playTone(140, 0.2, { type: "sawtooth", gainValue: 0.08 });
  playTone(90, 0.25, { type: "square", gainValue: 0.06, start: 0.05 });
}

function updateStatus() {
  if (!hasStarted) {
    statusEl.textContent = "Choose your Avenger and launch.";
    return;
  }
  if (state.isGameOver) {
    statusEl.textContent = "Crash! Villains clipped your run. Restart and climb again.";
  } else if (isPaused) {
    statusEl.textContent = "Paused";
  } else {
    statusEl.textContent = "Skyline run is live. Dodge hard and push your legend.";
  }
}

function renderHeroButtons() {
  heroButtonsEl.innerHTML = "";
  HEROES.forEach((hero, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hero-btn";
    if (index === state.heroIndex) {
      button.classList.add("active");
    }
    button.dataset.heroIndex = String(index);

    const image = document.createElement("img");
    image.src = hero.image;
    image.alt = hero.name;

    const label = document.createElement("span");
    label.textContent = hero.name;

    button.append(image, label);
    heroButtonsEl.append(button);
  });
}

function syncVillainActors() {
  const keep = new Set();

  state.lanes.forEach((lane) => {
    lane.obstacles.forEach((obstacle) => {
      const key = `${lane.id}:${obstacle.id}`;
      keep.add(key);

      const modelKey = villainKeyFromImage(obstacle.image);
      const existing = villainActors.get(key);

      if (!existing || existing.userData.modelKey !== modelKey) {
        if (existing) {
          scene.remove(existing);
        }

        const actor = createBlockCharacter(VILLAIN_MODELS[modelKey]);
        actor.userData.modelKey = modelKey;
        scene.add(actor);
        villainActors.set(key, actor);
      }

      const actor = villainActors.get(key);
      actor.userData.laneY = lane.y;
      actor.userData.laneId = lane.id;
      actor.userData.direction = lane.direction;
    });
  });

  Array.from(villainActors.keys()).forEach((key) => {
    if (!keep.has(key)) {
      scene.remove(villainActors.get(key));
      villainActors.delete(key);
    }
  });
}

function renderHud() {
  scoreEl.textContent = String(state.score);
  levelEl.textContent = String(state.level);
  updateStatus();
}

function maybeStoreGameOverScore(previousOver, nextOver) {
  if (!previousOver && nextOver && !hasStoredScore) {
    hasStoredScore = true;
    const scores = saveHighScore(state.score);
    renderHighScores(scores);
    playCrashSound();
    isPaused = true;
    pauseEl.textContent = "Resume";
    showOverlay("gameover");
  }
}

function shortestAngle(from, to) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function update3D(dt, timestamp) {
  const now = timestamp * 0.001;
  const smoothingX = Math.min(1, dt * 22);
  const smoothingProgress = Math.min(1, dt * 16);

  renderHeroX += (state.heroX - renderHeroX) * smoothingX;
  const targetProgress = state.heroWorldRow;
  renderHeroProgress += (targetProgress - renderHeroProgress) * smoothingProgress;
  const laneByY = new Map(state.lanes.map((lane) => [lane.y, lane]));

  laneMeshes.forEach(({ lane, y, road }) => {
    const laneState = laneByY.get(y);
    if (!laneState) {
      lane.visible = false;
      return;
    }
    lane.visible = true;
    lane.position.z = worldZForRow(laneState.worldRow, renderHeroProgress);
    lane.position.y = road ? 0.04 : 0.05;
  });

  const laneCenterWorld = state.heroWorldRow + (state.heroY - (GRID_HEIGHT - 1) / 2);
  floor.position.z = worldZForRow(laneCenterWorld, renderHeroProgress);

  const heroX = toWorldX(renderHeroX);
  const heroZ = HERO_TRACK_Z;
  heroActor.position.set(heroX, 0, heroZ);

  const targetYaw =
    heroFacing === "left"
      ? Math.PI / 2
      : heroFacing === "right"
        ? -Math.PI / 2
        : heroFacing === "down"
          ? Math.PI
          : 0;

  heroActor.rotation.y += shortestAngle(heroActor.rotation.y, targetYaw) * Math.min(1, dt * 12);
  heroActor.rotation.z +=
    ((heroFacing === "left" ? -0.06 : heroFacing === "right" ? 0.06 : 0) - heroActor.rotation.z) *
    Math.min(1, dt * 8);

  animateCharacter(heroActor, now, 0.95);

  state.lanes.forEach((lane) => {
    lane.obstacles.forEach((obstacle) => {
      const key = `${lane.id}:${obstacle.id}`;
      const actor = villainActors.get(key);
      if (!actor) return;

      let x = obstacle.x % GRID_WIDTH;
      if (x < 0) x += GRID_WIDTH;

      actor.position.set(toWorldX(x), 0, worldZForRow(lane.worldRow, renderHeroProgress));
      actor.rotation.y = lane.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
      animateCharacter(actor, now + lane.worldRow * 0.2, 0.72);
    });
  });

  const targetCamX = heroX * 0.22;
  camera.position.x += (targetCamX - camera.position.x) * Math.min(1, dt * 2.6);
  camera.lookAt(camera.position.x * 0.4, 0.92, HERO_TRACK_Z + 7.2);

  animateBackdrop(now);
  renderer.render(scene, camera);
}

function tickFrame(timestamp) {
  if (!lastFrameTime) {
    lastFrameTime = timestamp;
  }

  const dt = Math.min(0.033, (timestamp - lastFrameTime) / 1000);
  lastFrameTime = timestamp;

  if (hasStarted && !isPaused && !state.isGameOver) {
    moveCooldownMs -= dt * 1000;
    let requestedDirection = null;

    if (moveCooldownMs <= 0 && queuedDirections.length > 0) {
      requestedDirection = queuedDirections.shift();
      moveCooldownMs = MOVE_INTERVAL_MS;
      heroFacing = requestedDirection;
    }

    const prevLevel = state.level;
    const wasOver = state.isGameOver;
    state = stepState(state, requestedDirection, dt);
    syncVillainActors();

    if (requestedDirection && !state.isGameOver) {
      playMoveSound();
    }

    if (state.level > prevLevel) {
      playLevelSound();
    }

    maybeStoreGameOverScore(wasOver, state.isGameOver);
  }

  renderHud();
  update3D(dt, timestamp);
  requestAnimationFrame(tickFrame);
}

function queueDirection(direction) {
  if (!direction) return;
  if (queuedDirections.length >= 4) return;
  queuedDirections.push(direction);
}

function togglePause() {
  if (state.isGameOver || !hasStarted) return;
  isPaused = !isPaused;
  pauseEl.textContent = isPaused ? "Resume" : "Pause";
}

function resizeScene() {
  const width = boardEl.clientWidth;
  const height = boardEl.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

document.addEventListener("keydown", (event) => {
  if (event.key === " ") {
    event.preventDefault();
    togglePause();
    return;
  }

  const direction = KEY_TO_DIRECTION[event.key];
  if (!direction) return;
  event.preventDefault();
  queueDirection(direction);
});

controlsEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-dir]");
  if (!button) return;
  queueDirection(button.dataset.dir);
});

heroButtonsEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-hero-index]");
  if (!button) return;
  state = setHero(state, Number(button.dataset.heroIndex));
  spawnHeroActor();
  renderHeroButtons();
});

playEl.addEventListener("click", () => {
  hasStarted = true;
  isPaused = false;
  pauseEl.textContent = "Pause";
  hideOverlay();
  playTone(330, 0.08, { type: "triangle" });
  playTone(440, 0.1, { type: "triangle", start: 0.08 });
});

restartEl.addEventListener("click", () => {
  const heroIndex = state.heroIndex;
  state = setHero(createInitialState(), heroIndex);
  queuedDirections = [];
  moveCooldownMs = 0;
  hasStarted = true;
  isPaused = false;
  hasStoredScore = false;
  heroFacing = "up";
  pauseEl.textContent = "Pause";
  renderHeroX = state.heroX;
  renderHeroProgress = state.heroWorldRow;
  spawnHeroActor();
  syncVillainActors();
  renderHeroButtons();
  hideOverlay();
  playTone(294, 0.08, { type: "triangle" });
  playTone(370, 0.1, { type: "triangle", start: 0.1 });
});

pauseEl.addEventListener("click", togglePause);

soundEl.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundEl.textContent = soundEnabled ? "Sound: On" : "Sound: Off";

  if (soundEnabled) {
    ensureAudio();
    startMusicLoop();
    playTone(440, 0.05, { type: "triangle" });
  } else {
    stopMusicLoop();
  }
});

document.addEventListener(
  "pointerdown",
  () => {
    if (soundEnabled) {
      ensureAudio();
      startMusicLoop();
    }
  },
  { once: true },
);

window.addEventListener("resize", resizeScene);

resizeScene();
renderHighScores();
renderHeroButtons();
syncVillainActors();
showOverlay("start");
renderHud();
requestAnimationFrame(tickFrame);
