import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
  preset?: 'glacier' | 'fde' | 'stealth' | 'joker' | 'cyberpunk';
};

export type SubAssemblyTransform = {
  obj: THREE.Object3D;
  homePos: THREE.Vector3;
  explodePos: THREE.Vector3;
  homeRot: THREE.Euler;
  explodeRot: THREE.Euler;
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  materials: Record<string, THREE.Material>;
  parts: {
    boltCarrier?: THREE.Mesh;
    magazineGroup?: THREE.Group;
    foregripGroup?: THREE.Group;
    frontSightMesh?: THREE.Mesh;
    rearSightMesh?: THREE.Mesh;
    flashHiderMesh?: THREE.Mesh;
    muzzlePoint?: THREE.Vector3;
  };
  subAssemblies: Record<string, SubAssemblyTransform>;
  setPreset: (preset: 'glacier' | 'fde' | 'stealth' | 'joker' | 'cyberpunk') => void;
};

// -----------------------------------------------------------------------------
// 2048x2048 Ultra-HD Canvas Texture Generators
// -----------------------------------------------------------------------------

function createGlacierIceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 2048, 2048);
  grad.addColorStop(0, '#85f2ff');
  grad.addColorStop(0.25, '#3ad4e8');
  grad.addColorStop(0.55, '#13879a');
  grad.addColorStop(0.8, '#084f5c');
  grad.addColorStop(1.0, '#032029');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2048, 2048);

  for (let i = 0; i < 10; i++) {
    const cx = Math.random() * 2048;
    const cy = Math.random() * 2048;
    const rad = ctx.createRadialGradient(cx, cy, 20, cx, cy, 550);
    rad.addColorStop(0, 'rgba(0, 245, 212, 0.5)');
    rad.addColorStop(0.5, 'rgba(56, 189, 248, 0.22)');
    rad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, 2048, 2048);
  }

  ctx.strokeStyle = 'rgba(235, 254, 255, 0.95)';
  ctx.lineWidth = 12.0;
  ctx.shadowColor = '#00f5d4';
  ctx.shadowBlur = 26;

  for (let i = 0; i < 50; i++) {
    ctx.beginPath();
    let x = Math.random() * 2048;
    let y = Math.random() * 2048;
    ctx.moveTo(x, y);
    const steps = 7 + Math.floor(Math.random() * 6);
    for (let j = 0; j < steps; j++) {
      x += (Math.random() - 0.5) * 400;
      y += (Math.random() - 0.5) * 400;
      ctx.lineTo(x, y);

      if (Math.random() > 0.55) {
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
        const bx = x + (Math.random() - 0.5) * 240;
        const by = y + (Math.random() - 0.5) * 240;
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 4.0;

  for (let i = 0; i < 110; i++) {
    ctx.beginPath();
    let x = Math.random() * 2048;
    let y = Math.random() * 2048;
    ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      x += (Math.random() - 0.5) * 180;
      y += (Math.random() - 0.5) * 180;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  for (let i = 0; i < 350; i++) {
    const rx = Math.random() * 2048;
    const ry = Math.random() * 2048;
    const r = Math.random() * 7 + 2.0;
    ctx.beginPath();
    ctx.arc(rx, ry, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createGlacierBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 2048, 2048);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10.0;
  for (let i = 0; i < 60; i++) {
    ctx.beginPath();
    let x = Math.random() * 2048;
    let y = Math.random() * 2048;
    ctx.moveTo(x, y);
    for (let j = 0; j < 6; j++) {
      x += (Math.random() - 0.5) * 350;
      y += (Math.random() - 0.5) * 350;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4.0;
  for (let i = 0; i < 80; i++) {
    ctx.beginPath();
    let x = Math.random() * 2048;
    let y = Math.random() * 2048;
    ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      x += (Math.random() - 0.5) * 180;
      y += (Math.random() - 0.5) * 180;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

function buildExtrudeShape(points: [number, number][], holes?: [number, number][][]): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
  }
  for (const loop of holes ?? []) {
    if (loop.length < 3) continue;
    const path = new THREE.Path();
    path.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i += 1) path.lineTo(loop[i][0], loop[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

// High-Precision Extruded Shape for HK416 Integrated Quad-Rail Handguard
function buildHK416QuadRailShape(): THREE.Shape {
  const shape = new THREE.Shape();
  // Octagonal profile with 4 integrated T-rail protrusions
  const r = 0.22;
  const tH = 0.045; // Picatinny tooth height
  const tW = 0.12;  // Picatinny tooth width

  // Top T-rail
  shape.moveTo(-tW, r + tH);
  shape.lineTo(tW, r + tH);
  shape.lineTo(tW, r);
  shape.lineTo(r, tW);
  // Right T-rail
  shape.lineTo(r + tH, tW);
  shape.lineTo(r + tH, -tW);
  shape.lineTo(r, -tW);
  shape.lineTo(tW, -r);
  // Bottom T-rail
  shape.lineTo(tW, -(r + tH));
  shape.lineTo(-tW, -(r + tH));
  shape.lineTo(-tW, -r);
  shape.lineTo(-r, -tW);
  // Left T-rail
  shape.lineTo(-(r + tH), -tW);
  shape.lineTo(-(r + tH), tW);
  shape.lineTo(-r, tW);
  shape.lineTo(-tW, r);
  shape.closePath();

  // Hollow inner barrel channel hole
  const holePath = new THREE.Path();
  const hr = 0.15;
  for (let a = 0; a <= Math.PI * 2; a += Math.PI / 6) {
    const x = Math.cos(a) * hr;
    const y = Math.sin(a) * hr;
    if (a === 0) holePath.moveTo(x, y);
    else holePath.lineTo(x, y);
  }
  holePath.closePath();
  shape.holes.push(holePath);

  return shape;
}

// -----------------------------------------------------------------------------
// Main Factory: createJokerSMGModel (High-Fidelity HK416 Mechanical Overhaul)
// -----------------------------------------------------------------------------

export function createJokerSMGModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = 'M416 Glacier Assault Rifle';

  const castShadow = options.castShadow ?? true;
  const receiveShadow = options.receiveShadow ?? false;
  const initialPreset = options.preset ?? 'glacier';

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const materials: Record<string, THREE.Material> = {};
  const parts: ProceduralModelRuntime['parts'] = {};
  const subAssemblies: Record<string, SubAssemblyTransform> = {};

  const applyShadows = (mesh: THREE.Mesh) => {
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
  };

  const glacierTexture = typeof document !== 'undefined' ? createGlacierIceTexture() : null;
  const glacierBump = typeof document !== 'undefined' ? createGlacierBumpTexture() : null;

  // Refined High-Transmission Physical Ice Material
  const matGlacierIce = new THREE.MeshPhysicalMaterial({
    color: 0x44d6e4,
    roughness: 0.02,
    metalness: 0.05,
    transmission: 0.92,
    opacity: 0.95,
    transparent: true,
    ior: 1.48,
    thickness: 1.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    map: glacierTexture,
    bumpMap: glacierBump,
    bumpScale: 0.14,
  });
  materials.glacierIce = matGlacierIce;

  const matAnodizedBlack = matGlacierIce;
  materials.anodizedBlack = matAnodizedBlack;

  const matPrimaryTan = matGlacierIce;
  materials.primaryTan = matPrimaryTan;

  const matNitrideSteel = new THREE.MeshPhysicalMaterial({
    color: 0x22c2d6,
    roughness: 0.08,
    metalness: 0.85,
    transmission: 0.6,
    transparent: true,
    opacity: 0.9,
    clearcoat: 1.0,
    bumpMap: glacierBump,
    bumpScale: 0.08,
  });
  materials.nitrideSteel = matNitrideSteel;

  const matDarkSteel = matNitrideSteel;
  materials.darkSteel = matDarkSteel;

  const matPolymer = matGlacierIce;
  materials.polymer = matPolymer;

  const matRubber = matGlacierIce;
  materials.rubber = matRubber;

  const matStanagMag = matGlacierIce;
  materials.stanagMag = matStanagMag;

  const matGoldAccent = new THREE.MeshStandardMaterial({
    color: 0x55e0eb,
    roughness: 0.02,
    metalness: 0.95,
  });
  materials.goldAccent = matGoldAccent;

  const matSelectorRed = new THREE.MeshStandardMaterial({ color: 0xd81c24 });
  const matSelectorWhite = new THREE.MeshStandardMaterial({ color: 0xffffff });

  const applyPreset = (p: 'glacier' | 'fde' | 'stealth' | 'joker' | 'cyberpunk') => {
    if (p === 'glacier') {
      matGlacierIce.color.setHex(0x44d6e4);
      matGlacierIce.transmission = 0.92;
      matGlacierIce.transparent = true;
      matGlacierIce.opacity = 0.95;
      matGlacierIce.roughness = 0.02;
      matNitrideSteel.color.setHex(0x22c2d6);
      matNitrideSteel.transmission = 0.6;
    } else if (p === 'fde') {
      matGlacierIce.color.setHex(0x9b8359);
      matGlacierIce.transmission = 0.0;
      matGlacierIce.transparent = false;
      matGlacierIce.opacity = 1.0;
      matGlacierIce.roughness = 0.5;
      matNitrideSteel.color.setHex(0x242834);
      matNitrideSteel.transmission = 0.0;
    } else if (p === 'stealth') {
      matGlacierIce.color.setHex(0x12131b);
      matGlacierIce.transmission = 0.0;
      matGlacierIce.transparent = false;
      matGlacierIce.opacity = 1.0;
      matGlacierIce.roughness = 0.3;
      matNitrideSteel.color.setHex(0x323646);
      matNitrideSteel.transmission = 0.0;
    } else if (p === 'joker') {
      matGlacierIce.color.setHex(0x6b1b9b);
      matGlacierIce.transmission = 0.0;
      matGlacierIce.transparent = false;
      matGlacierIce.opacity = 1.0;
      matGlacierIce.roughness = 0.2;
      matNitrideSteel.color.setHex(0x3bd41c);
      matNitrideSteel.transmission = 0.0;
    } else if (p === 'cyberpunk') {
      matGlacierIce.color.setHex(0x0a0d14);
      matGlacierIce.transmission = 0.0;
      matGlacierIce.transparent = false;
      matGlacierIce.opacity = 1.0;
      matGlacierIce.roughness = 0.15;
      matNitrideSteel.color.setHex(0x7b2cbf);
      matNitrideSteel.transmission = 0.0;
    }
  };
  applyPreset(initialPreset);

  // ---------------------------------------------------------------------------
  // 1. M416 Lower Receiver
  // ---------------------------------------------------------------------------
  const lowerGroup = new THREE.Group();
  lowerGroup.name = 'LowerReceiver_Group';
  root.add(lowerGroup);
  subAssemblies.lowerReceiver = {
    obj: lowerGroup,
    homePos: new THREE.Vector3(0, 0, 0),
    explodePos: new THREE.Vector3(0, -0.45, 0),
    homeRot: new THREE.Euler(0, 0, 0),
    explodeRot: new THREE.Euler(0, 0, -0.1),
  };

  const lowerShape = buildExtrudeShape([
    [-0.5, 0.2],
    [0.8, 0.2],
    [0.8, -0.15],
    [0.5, -0.3],
    [-0.1, -0.3],
    [-0.5, -0.1],
  ]);
  const lowerGeo = new THREE.ExtrudeGeometry(lowerShape, { depth: 0.38, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 4 });
  lowerGeo.center();
  lowerGeo.computeVertexNormals();

  const lowerMesh = new THREE.Mesh(lowerGeo, matGlacierIce);
  lowerMesh.position.set(0.15, -0.05, 0);
  applyShadows(lowerMesh);
  lowerGroup.add(lowerMesh);

  const magWellShape = buildExtrudeShape([
    [-0.5, 0.1],
    [-0.1, 0.1],
    [-0.15, -0.4],
    [-0.55, -0.4],
  ]);
  const magWellGeo = new THREE.ExtrudeGeometry(magWellShape, { depth: 0.42, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 });
  magWellGeo.center();
  magWellGeo.computeVertexNormals();

  const magWellMesh = new THREE.Mesh(magWellGeo, matGlacierIce);
  magWellMesh.position.set(-0.3, -0.15, 0);
  applyShadows(magWellMesh);
  lowerGroup.add(magWellMesh);

  const pinGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.44, 16);
  pinGeo.rotateX(Math.PI / 2);
  const pinFront = new THREE.Mesh(pinGeo, matNitrideSteel);
  pinFront.position.set(-0.3, 0.12, 0);
  lowerGroup.add(pinFront);

  const pinRear = new THREE.Mesh(pinGeo, matNitrideSteel);
  pinRear.position.set(0.7, 0.12, 0);
  lowerGroup.add(pinRear);

  const guardShape = buildExtrudeShape([
    [-0.1, -0.28],
    [0.35, -0.28],
    [0.35, -0.42],
    [-0.1, -0.42],
  ], [[
    [0.0, -0.32],
    [0.28, -0.32],
    [0.28, -0.38],
    [0.0, -0.38],
  ]]);
  const guardGeo = new THREE.ExtrudeGeometry(guardShape, { depth: 0.12, bevelEnabled: false });
  guardGeo.center();
  guardGeo.computeVertexNormals();
  const guardMesh = new THREE.Mesh(guardGeo, matGlacierIce);
  guardMesh.position.set(0.12, -0.35, 0);
  applyShadows(guardMesh);
  lowerGroup.add(guardMesh);

  const triggerGeo = new THREE.BoxGeometry(0.025, 0.14, 0.03);
  triggerGeo.computeVertexNormals();
  const triggerMesh = new THREE.Mesh(triggerGeo, matGoldAccent);
  triggerMesh.position.set(0.15, -0.34, 0);
  triggerMesh.rotation.z = 0.25;
  applyShadows(triggerMesh);
  lowerGroup.add(triggerMesh);

  const paddleGeo = new THREE.BoxGeometry(0.08, 0.14, 0.04);
  const paddleMesh = new THREE.Mesh(paddleGeo, matNitrideSteel);
  paddleMesh.position.set(0.15, 0.08, 0.21);
  lowerGroup.add(paddleMesh);

  const selectorGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16);
  selectorGeo.rotateX(Math.PI / 2);
  selectorGeo.computeVertexNormals();
  const selectorMesh = new THREE.Mesh(selectorGeo, matNitrideSteel);
  selectorMesh.position.set(0.55, 0.05, 0.2);
  applyShadows(selectorMesh);
  lowerGroup.add(selectorMesh);

  const safeMark = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.01), matSelectorWhite);
  safeMark.position.set(0.48, 0.12, 0.21);
  lowerGroup.add(safeMark);

  const semiMark = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.01), matSelectorRed);
  semiMark.position.set(0.55, 0.14, 0.21);
  lowerGroup.add(semiMark);

  const autoMark = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.01), matSelectorRed);
  autoMark.position.set(0.62, 0.12, 0.21);
  lowerGroup.add(autoMark);

  // ---------------------------------------------------------------------------
  // 2. M416 Upper Receiver & Charging Handle
  // ---------------------------------------------------------------------------
  const upperGroup = new THREE.Group();
  upperGroup.name = 'UpperReceiver_Group';
  root.add(upperGroup);
  subAssemblies.upperReceiver = {
    obj: upperGroup,
    homePos: new THREE.Vector3(0, 0, 0),
    explodePos: new THREE.Vector3(0.15, 0.75, 0),
    homeRot: new THREE.Euler(0, 0, 0),
    explodeRot: new THREE.Euler(0, 0, 0.1),
  };

  const upperShape = buildExtrudeShape([
    [-0.6, 0.2],
    [0.85, 0.2],
    [0.85, 0.52],
    [-0.6, 0.52],
  ]);
  const upperGeo = new THREE.ExtrudeGeometry(upperShape, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3 });
  upperGeo.center();
  upperGeo.computeVertexNormals();

  const upperMesh = new THREE.Mesh(upperGeo, matGlacierIce);
  upperMesh.position.set(0.12, 0.36, 0);
  applyShadows(upperMesh);
  upperGroup.add(upperMesh);

  const boltCarrierGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.32, 16);
  boltCarrierGeo.rotateZ(Math.PI / 2);
  boltCarrierGeo.computeVertexNormals();
  const boltCarrierMesh = new THREE.Mesh(boltCarrierGeo, matNitrideSteel);
  boltCarrierMesh.position.set(0.2, 0.34, 0.18);
  applyShadows(boltCarrierMesh);
  upperGroup.add(boltCarrierMesh);
  parts.boltCarrier = boltCarrierMesh;

  const dustCoverGeo = new THREE.BoxGeometry(0.35, 0.16, 0.04);
  dustCoverGeo.computeVertexNormals();
  const dustCoverMesh = new THREE.Mesh(dustCoverGeo, matDarkSteel);
  dustCoverMesh.position.set(0.2, 0.34, 0.21);
  applyShadows(dustCoverMesh);
  upperGroup.add(dustCoverMesh);

  const assistGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.22, 16);
  assistGeo.rotateZ(-Math.PI / 4);
  assistGeo.computeVertexNormals();
  const assistMesh = new THREE.Mesh(assistGeo, matDarkSteel);
  assistMesh.position.set(0.65, 0.32, 0.2);
  applyShadows(assistMesh);
  upperGroup.add(assistMesh);

  const handleStemGeo = new THREE.BoxGeometry(0.4, 0.05, 0.08);
  const handleLatchGeo = new THREE.BoxGeometry(0.08, 0.06, 0.32);
  handleStemGeo.computeVertexNormals();
  handleLatchGeo.computeVertexNormals();

  const handleMesh = new THREE.Mesh(handleStemGeo, matDarkSteel);
  handleMesh.position.set(0.95, 0.52, 0);
  const latchMesh = new THREE.Mesh(handleLatchGeo, matNitrideSteel);
  latchMesh.position.set(1.12, 0.52, 0);
  applyShadows(handleMesh);
  applyShadows(latchMesh);
  upperGroup.add(handleMesh);
  upperGroup.add(latchMesh);

  for (let x = -0.55; x <= 0.85; x += 0.12) {
    const railTooth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.44), matNitrideSteel);
    railTooth.position.set(x, 0.56, 0);
    applyShadows(railTooth);
    upperGroup.add(railTooth);
  }

  // ---------------------------------------------------------------------------
  // 3. High-Fidelity Integrated HK416 Quad-Rail Handguard & Foregrip
  // ---------------------------------------------------------------------------
  const handguardGroup = new THREE.Group();
  handguardGroup.name = 'QuadRailHandguard_Group';
  root.add(handguardGroup);
  subAssemblies.handguard = {
    obj: handguardGroup,
    homePos: new THREE.Vector3(0, 0, 0),
    explodePos: new THREE.Vector3(-1.1, 0.35, 0),
    homeRot: new THREE.Euler(0, 0, 0),
    explodeRot: new THREE.Euler(0, 0, 0.05),
  };

  // High-Precision Integrated HK416 Quad-Rail Body
  const hkRailShape = buildHK416QuadRailShape();
  const quadRailGeo = new THREE.ExtrudeGeometry(hkRailShape, {
    depth: 1.7,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 4,
  });
  quadRailGeo.rotateY(Math.PI / 2);
  quadRailGeo.center();
  quadRailGeo.computeVertexNormals();

  const quadRailMesh = new THREE.Mesh(quadRailGeo, matGlacierIce);
  quadRailMesh.position.set(-1.35, 0.37, 0);
  applyShadows(quadRailMesh);
  handguardGroup.add(quadRailMesh);

  // Milled Picatinny T-Slot Grooves (16 slots along length)
  const slotWidth = 0.05;
  for (let x = -2.15; x <= -0.55; x += 0.1) {
    // Top rail groove cut
    const topCut = new THREE.Mesh(new THREE.BoxGeometry(slotWidth, 0.03, 0.26), matDarkSteel);
    topCut.position.set(x, 0.62, 0);
    handguardGroup.add(topCut);

    // Bottom rail groove cut
    const botCut = new THREE.Mesh(new THREE.BoxGeometry(slotWidth, 0.03, 0.26), matDarkSteel);
    botCut.position.set(x, 0.12, 0);
    handguardGroup.add(botCut);

    // Left side rail groove cut
    const leftCut = new THREE.Mesh(new THREE.BoxGeometry(slotWidth, 0.26, 0.03), matDarkSteel);
    leftCut.position.set(x, 0.37, 0.25);
    handguardGroup.add(leftCut);

    // Right side rail groove cut
    const rightCut = leftCut.clone();
    rightCut.position.z = -0.25;
    handguardGroup.add(rightCut);
  }

  // Side Cooling Ventilation Oval Slots
  for (let x = -2.0; x <= -0.7; x += 0.28) {
    const ventLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 12), matDarkSteel);
    ventLeft.rotateZ(Math.PI / 2);
    ventLeft.position.set(x, 0.44, 0.22);
    handguardGroup.add(ventLeft);

    const ventRight = ventLeft.clone();
    ventRight.position.z = -0.22;
    handguardGroup.add(ventRight);
  }

  // Heavy Rear Barrel Nut Locking Collar with Hex Bolts
  const collarGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.14, 24);
  collarGeo.rotateZ(Math.PI / 2);
  collarGeo.computeVertexNormals();
  const collarMesh = new THREE.Mesh(collarGeo, matNitrideSteel);
  collarMesh.position.set(-0.48, 0.37, 0);
  applyShadows(collarMesh);
  handguardGroup.add(collarMesh);

  const hexBoltGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.06, 6);
  const bolt1 = new THREE.Mesh(hexBoltGeo, matNitrideSteel);
  bolt1.position.set(-0.48, 0.56, 0.15);
  handguardGroup.add(bolt1);

  const bolt2 = bolt1.clone();
  bolt2.position.z = -0.15;
  handguardGroup.add(bolt2);

  // Vertical Foregrip
  const foregripGroup = new THREE.Group();
  foregripGroup.name = 'Foregrip_Group';
  foregripGroup.position.set(-1.35, 0.16, 0);
  handguardGroup.add(foregripGroup);
  parts.foregripGroup = foregripGroup;

  const foregripMainGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.65, 20);
  foregripMainGeo.computeVertexNormals();
  const foregripMesh = new THREE.Mesh(foregripMainGeo, matGlacierIce);
  foregripMesh.position.set(0, -0.32, 0);
  applyShadows(foregripMesh);
  foregripGroup.add(foregripMesh);

  for (let y = -0.15; y >= -0.52; y -= 0.08) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.015, 12, 24), matDarkSteel);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, y, 0);
    foregripGroup.add(ring);
  }

  // ---------------------------------------------------------------------------
  // 4. Barrel, Gas Block & Muzzle Flash Hider (Front)
  // ---------------------------------------------------------------------------
  const barrelGroup = new THREE.Group();
  barrelGroup.position.set(-2.25, 0.37, 0);
  root.add(barrelGroup);
  subAssemblies.barrel = {
    obj: barrelGroup,
    homePos: new THREE.Vector3(-2.25, 0.37, 0),
    explodePos: new THREE.Vector3(-3.8, 0.37, 0),
    homeRot: new THREE.Euler(0, 0, 0),
    explodeRot: new THREE.Euler(0, 0, 0),
  };

  // Outer Nitride Steel Barrel extending inside hollow handguard
  const barrelGeo = new THREE.CylinderGeometry(0.075, 0.075, 1.8, 24);
  barrelGeo.rotateZ(Math.PI / 2);
  barrelGeo.computeVertexNormals();
  const barrelMesh = new THREE.Mesh(barrelGeo, matNitrideSteel);
  barrelMesh.position.set(-0.3, 0, 0);
  applyShadows(barrelMesh);
  barrelGroup.add(barrelMesh);

  // Gas Piston Rod extending back to upper receiver
  const pistonRodGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.4, 16);
  pistonRodGeo.rotateZ(Math.PI / 2);
  pistonRodGeo.computeVertexNormals();
  const pistonRodMesh = new THREE.Mesh(pistonRodGeo, matDarkSteel);
  pistonRodMesh.position.set(-0.1, 0.12, 0);
  barrelGroup.add(pistonRodMesh);

  const gasBlockGeo = new THREE.BoxGeometry(0.18, 0.22, 0.16);
  gasBlockGeo.computeVertexNormals();
  const gasBlockMesh = new THREE.Mesh(gasBlockGeo, matGlacierIce);
  gasBlockMesh.position.set(-0.1, 0.05, 0);
  applyShadows(gasBlockMesh);
  barrelGroup.add(gasBlockMesh);

  const frontSightShape = new THREE.Shape();
  frontSightShape.moveTo(-0.06, 0);
  frontSightShape.lineTo(0.06, 0);
  frontSightShape.lineTo(0.02, 0.35);
  frontSightShape.lineTo(-0.02, 0.35);
  frontSightShape.closePath();
  const frontSightGeo = new THREE.ExtrudeGeometry(frontSightShape, { depth: 0.08, bevelEnabled: false });
  frontSightGeo.center();
  frontSightGeo.computeVertexNormals();
  const frontSightMesh = new THREE.Mesh(frontSightGeo, matDarkSteel);
  frontSightMesh.position.set(-0.1, 0.3, 0);
  applyShadows(frontSightMesh);
  barrelGroup.add(frontSightMesh);
  parts.frontSightMesh = frontSightMesh;

  const rearSightGeo = new THREE.BoxGeometry(0.14, 0.28, 0.18);
  rearSightGeo.computeVertexNormals();
  const rearSightMesh = new THREE.Mesh(rearSightGeo, matDarkSteel);
  rearSightMesh.position.set(0.7, 0.68, 0);
  applyShadows(rearSightMesh);
  upperGroup.add(rearSightMesh);
  parts.rearSightMesh = rearSightMesh;

  const flashHiderGeo = new THREE.CylinderGeometry(0.09, 0.085, 0.35, 20);
  flashHiderGeo.rotateZ(Math.PI / 2);
  flashHiderGeo.computeVertexNormals();
  const flashHiderMesh = new THREE.Mesh(flashHiderGeo, matNitrideSteel);
  flashHiderMesh.position.set(-1.35, 0, 0);
  applyShadows(flashHiderMesh);
  barrelGroup.add(flashHiderMesh);
  parts.flashHiderMesh = flashHiderMesh;

  parts.muzzlePoint = new THREE.Vector3(-3.7, 0.37, 0);

  for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.02), matDarkSteel);
    vent.position.set(-1.35, Math.sin(a) * 0.085, Math.cos(a) * 0.085);
    barrelGroup.add(vent);
  }

  // ---------------------------------------------------------------------------
  // 5. Buffer Tube & Adjustable HK416 Crane Stock (Rear)
  // ---------------------------------------------------------------------------
  const stockGroup = new THREE.Group();
  stockGroup.position.set(0.9, 0.28, 0);
  root.add(stockGroup);
  subAssemblies.stock = {
    obj: stockGroup,
    homePos: new THREE.Vector3(0.9, 0.28, 0),
    explodePos: new THREE.Vector3(2.3, 0.28, 0),
    homeRot: new THREE.Euler(0, 0, 0),
    explodeRot: new THREE.Euler(0, 0, 0),
  };

  const bufferTubeGeo = new THREE.CylinderGeometry(0.11, 0.11, 1.4, 24);
  bufferTubeGeo.rotateZ(Math.PI / 2);
  bufferTubeGeo.computeVertexNormals();
  const bufferTubeMesh = new THREE.Mesh(bufferTubeGeo, matNitrideSteel);
  bufferTubeMesh.position.set(0.7, 0, 0);
  applyShadows(bufferTubeMesh);
  stockGroup.add(bufferTubeMesh);

  const castleNutGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.08, 24);
  castleNutGeo.rotateZ(Math.PI / 2);
  castleNutGeo.computeVertexNormals();
  const castleNutMesh = new THREE.Mesh(castleNutGeo, matGlacierIce);
  castleNutMesh.position.set(0.04, 0, 0);
  stockGroup.add(castleNutMesh);

  const stockShape = buildExtrudeShape([
    [0.4, 0.16],
    [1.42, 0.18],
    [1.46, -0.05],
    [1.38, -0.55],
    [1.15, -0.65],
    [0.75, -0.32],
    [0.4, -0.15],
  ]);
  const stockGeo = new THREE.ExtrudeGeometry(stockShape, { depth: 0.42, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 4 });
  stockGeo.center();
  stockGeo.computeVertexNormals();

  const stockMesh = new THREE.Mesh(stockGeo, matGlacierIce);
  stockMesh.position.set(0.93, -0.18, 0);
  applyShadows(stockMesh);
  stockGroup.add(stockMesh);

  const buttpadGeo = new THREE.BoxGeometry(0.12, 0.88, 0.44);
  buttpadGeo.computeVertexNormals();
  const buttpadMesh = new THREE.Mesh(buttpadGeo, matGlacierIce);
  buttpadMesh.position.set(1.48, -0.18, 0);
  applyShadows(buttpadMesh);
  stockGroup.add(buttpadMesh);

  for (let y = -0.5; y <= 0.2; y += 0.1) {
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.4), matDarkSteel);
    ridge.position.set(1.54, y, 0);
    stockGroup.add(ridge);
  }

  const latchGeo = new THREE.BoxGeometry(0.35, 0.08, 0.12);
  const stockLatchMesh = new THREE.Mesh(latchGeo, matDarkSteel);
  stockLatchMesh.position.set(0.95, -0.52, 0);
  stockGroup.add(stockLatchMesh);

  // ---------------------------------------------------------------------------
  // 6. Pistol Grip (Bottom Rear)
  // ---------------------------------------------------------------------------
  const gripGroup = new THREE.Group();
  gripGroup.position.set(0.5, -0.2, 0);
  root.add(gripGroup);
  subAssemblies.grip = {
    obj: gripGroup,
    homePos: new THREE.Vector3(0.5, -0.2, 0),
    explodePos: new THREE.Vector3(0.85, -1.2, 0),
    homeRot: new THREE.Euler(0, 0, 0),
    explodeRot: new THREE.Euler(0, 0, -0.25),
  };

  const gripShape = buildExtrudeShape([
    [0.1, 0.1],
    [0.3, -0.75],
    [-0.05, -0.85],
    [-0.18, -0.7],
    [-0.12, 0.1],
  ]);
  const gripGeo = new THREE.ExtrudeGeometry(gripShape, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 4 });
  gripGeo.center();
  gripGeo.computeVertexNormals();

  const gripMesh = new THREE.Mesh(gripGeo, matGlacierIce);
  gripMesh.position.set(0.06, -0.38, 0);
  gripMesh.rotation.z = -0.18;
  applyShadows(gripMesh);
  gripGroup.add(gripMesh);

  // ---------------------------------------------------------------------------
  // 7. STANAG 30-Round Curved 5.56 Magazine
  // ---------------------------------------------------------------------------
  const magGroup = new THREE.Group();
  magGroup.name = 'Magazine_Group';
  magGroup.position.set(-0.3, -0.35, 0);
  root.add(magGroup);
  parts.magazineGroup = magGroup;

  subAssemblies.magazine = {
    obj: magGroup,
    homePos: new THREE.Vector3(-0.3, -0.35, 0),
    explodePos: new THREE.Vector3(-0.55, -1.5, 0),
    homeRot: new THREE.Euler(0, 0, 0),
    explodeRot: new THREE.Euler(0, 0, 0.35),
  };

  const magShape = buildExtrudeShape([
    [-0.18, 0.1],
    [0.18, 0.1],
    [0.08, -0.92],
    [-0.24, -0.86],
  ]);
  const magGeo = new THREE.ExtrudeGeometry(magShape, { depth: 0.32, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3 });
  magGeo.center();
  magGeo.computeVertexNormals();

  const magMesh = new THREE.Mesh(magGeo, matGlacierIce);
  magMesh.position.set(-0.06, -0.38, 0);
  magMesh.rotation.z = 0.18;
  applyShadows(magMesh);
  magGroup.add(magMesh);

  const magBaseGeo = new THREE.BoxGeometry(0.34, 0.06, 0.36);
  magBaseGeo.computeVertexNormals();
  const magBaseMesh = new THREE.Mesh(magBaseGeo, matDarkSteel);
  magBaseMesh.position.set(-0.16, -0.88, 0);
  magBaseMesh.rotation.z = 0.18;
  applyShadows(magBaseMesh);
  magGroup.add(magBaseMesh);

  root.userData.sculptRuntime = {
    nodes,
    meshes,
    materials,
    parts,
    subAssemblies,
    setPreset: applyPreset,
  } satisfies ProceduralModelRuntime;

  return root;
}

// -----------------------------------------------------------------------------
// Studio Lighting Setup (Locked Light Brightness = 1.0)
// -----------------------------------------------------------------------------

export function createJokerSMGLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = 'M416 look-dev lights';

  const hemi = new THREE.HemisphereLight(0xffffff, 0x505462, 0.5);
  lights.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(-4.0, 6.0, 5.5);

  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;

  lights.add(key);

  const fill = new THREE.DirectionalLight(0xc2dcff, 0.4);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.8);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);

  return lights;
}

// -----------------------------------------------------------------------------
// Environment Setup
// -----------------------------------------------------------------------------

export function createJokerSMGEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// -----------------------------------------------------------------------------
// Camera Framing Helper
// -----------------------------------------------------------------------------

export function frameJokerSMGCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// -----------------------------------------------------------------------------
// Presentation Post-Processing Composer
// -----------------------------------------------------------------------------

export function createJokerSMGPresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}
