import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  createJokerSMGModel,
  createJokerSMGLookDevLights,
  createJokerSMGEnvironment,
} from '../src/createJokerSmgModel.ts';

const params = new URLSearchParams(location.search);
const initialMode = (params.get('mode') as 'clay' | 'eval' | 'hero') || 'hero';

const stage = document.getElementById('stage')!;
const hud = document.getElementById('hud')!;

// -----------------------------------------------------------------------------
// WebGL Renderer Setup (Locked Exposure = 0.40 & Brightness = 1.0)
// -----------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.40;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b10);

const envTex = createJokerSMGEnvironment(renderer);
scene.environment = envTex;

// -----------------------------------------------------------------------------
// Model & Runtime Setup
// -----------------------------------------------------------------------------
const model = createJokerSMGModel({ castShadow: true, receiveShadow: false, preset: 'glacier' });
scene.add(model);

const runtime = (model.userData as any).sculptRuntime;
const parts = runtime.parts;
const subAssemblies = runtime.subAssemblies;

// Studio Look-Dev Lighting Setup (Light Brightness = 1.0)
const lights = createJokerSMGLookDevLights('reference');
scene.add(lights);

// Ground Shadow Plane
const box = new THREE.Box3().setFromObject(model);
const size = box.getSize(new THREE.Vector3());
const center = box.getCenter(new THREE.Vector3());

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(size.x * 4, size.z * 8),
  new THREE.ShadowMaterial({ opacity: 0.35 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(center.x, box.min.y - 0.05, center.z);
ground.receiveShadow = true;
scene.add(ground);

// -----------------------------------------------------------------------------
// Disassembly / Reassembly Visual FX (Shockwave, Particles, Flash)
// -----------------------------------------------------------------------------

const shockwaveGeo = new THREE.TorusGeometry(1.2, 0.03, 16, 64);
const matShockwave = new THREE.MeshBasicMaterial({
  color: 0x00f5d4,
  transparent: true,
  opacity: 0,
  wireframe: false,
});
const shockwaveMesh = new THREE.Mesh(shockwaveGeo, matShockwave);
shockwaveMesh.rotation.x = Math.PI / 2;
scene.add(shockwaveMesh);

const assemblyFlashLight = new THREE.PointLight(0x00f5d4, 0, 15);
assemblyFlashLight.position.set(0, 0.2, 0);
scene.add(assemblyFlashLight);

const particleGroup = new THREE.Group();
scene.add(particleGroup);

const crystalGeo = new THREE.OctahedronGeometry(0.04, 0);
const matCrystal = new THREE.MeshStandardMaterial({
  color: 0x55ffff,
  roughness: 0.1,
  metalness: 0.9,
  emissive: 0x00f5d4,
  emissiveIntensity: 0.8,
  transparent: true,
  opacity: 0,
});

type FloatingCrystal = {
  mesh: THREE.Mesh;
  basePos: THREE.Vector3;
  velocity: THREE.Vector3;
};

const floatingCrystals: FloatingCrystal[] = [];
for (let i = 0; i < 35; i++) {
  const crystal = new THREE.Mesh(crystalGeo, matCrystal);
  const p = new THREE.Vector3(
    (Math.random() - 0.5) * 4.5,
    (Math.random() - 0.5) * 2.5 + 0.2,
    (Math.random() - 0.5) * 2.0,
  );
  crystal.position.copy(p);
  crystal.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
  particleGroup.add(crystal);

  floatingCrystals.push({
    mesh: crystal,
    basePos: p.clone(),
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 0.4,
      (Math.random() - 0.5) * 0.4,
      (Math.random() - 0.5) * 0.4,
    ),
  });
}

function triggerDisassemblyFX() {
  shockwaveMesh.scale.set(0.1, 0.1, 0.1);
  matShockwave.opacity = 1.0;
  assemblyFlashLight.intensity = 35;
  matCrystal.opacity = 0.95;
}

// -----------------------------------------------------------------------------
// 5.56mm Bullet ("Goli") & Casing Geometry Factories
// -----------------------------------------------------------------------------

const matCopperJacket = new THREE.MeshPhysicalMaterial({
  color: 0xd97724,
  metalness: 0.95,
  roughness: 0.12,
  clearcoat: 0.6,
  clearcoatRoughness: 0.05,
});

const matBrassCase = new THREE.MeshPhysicalMaterial({
  color: 0xe5b838,
  metalness: 0.92,
  roughness: 0.15,
  clearcoat: 0.4,
});

const bulletTipGeo = new THREE.ConeGeometry(0.022, 0.12, 16);
bulletTipGeo.rotateZ(-Math.PI / 2);
bulletTipGeo.computeVertexNormals();

const bulletNeckGeo = new THREE.CylinderGeometry(0.022, 0.028, 0.06, 16);
bulletNeckGeo.rotateZ(Math.PI / 2);
bulletNeckGeo.computeVertexNormals();

const casingBodyGeo = new THREE.CylinderGeometry(0.028, 0.038, 0.22, 16);
casingBodyGeo.rotateZ(Math.PI / 2);
casingBodyGeo.computeVertexNormals();

const casingGeo = new THREE.CylinderGeometry(0.028, 0.038, 0.26, 16);
casingGeo.computeVertexNormals();

const muzzleLight = new THREE.PointLight(0x00f5d4, 0, 12);
muzzleLight.position.set(-3.7, 0.37, 0);
scene.add(muzzleLight);

const starShape = new THREE.Shape();
const outerR = 0.28;
const innerR = 0.08;
for (let i = 0; i < 10; i++) {
  const r = i % 2 === 0 ? outerR : innerR;
  const a = (i / 10) * Math.PI * 2;
  if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
}
starShape.closePath();
const starGeo = new THREE.ShapeGeometry(starShape);

const matMuzzleFlame = new THREE.MeshBasicMaterial({
  color: 0x55ffff,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0,
});
const muzzleFlameMesh = new THREE.Mesh(starGeo, matMuzzleFlame);
muzzleFlameMesh.position.set(-3.75, 0.37, 0);
muzzleFlameMesh.rotation.y = Math.PI / 2;
scene.add(muzzleFlameMesh);

const smokeGeo = new THREE.SphereGeometry(0.2, 12, 12);
const matSmoke = new THREE.MeshStandardMaterial({
  color: 0xb0f5ff,
  transparent: true,
  opacity: 0,
  roughness: 0.9,
});
const smokeMesh = new THREE.Mesh(smokeGeo, matSmoke);
smokeMesh.position.set(-3.85, 0.37, 0);
scene.add(smokeMesh);

type ActiveBullet = {
  mesh: THREE.Group;
  tracer: THREE.Line;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
};

type ActiveCasing = {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotVelocity: THREE.Vector3;
  life: number;
};

const activeBullets: ActiveBullet[] = [];
const activeCasings: ActiveCasing[] = [];

function spawnBulletGoli() {
  const bGroup = new THREE.Group();

  const tipMesh = new THREE.Mesh(bulletTipGeo, matCopperJacket);
  tipMesh.position.x = -0.06;
  bGroup.add(tipMesh);

  const neckMesh = new THREE.Mesh(bulletNeckGeo, matBrassCase);
  neckMesh.position.x = 0.02;
  bGroup.add(neckMesh);

  const bodyMesh = new THREE.Mesh(casingBodyGeo, matBrassCase);
  bodyMesh.position.x = 0.15;
  bGroup.add(bodyMesh);

  const startPos = new THREE.Vector3(-3.7, 0.37, 0);
  bGroup.position.copy(startPos);

  const tracerGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1.4, 0, 0),
  ]);
  const tracerMat = new THREE.LineBasicMaterial({ color: 0x00f5d4, transparent: true, opacity: 0.95 });
  const tracerLine = new THREE.Line(tracerGeo, tracerMat);
  bGroup.add(tracerLine);

  scene.add(bGroup);

  activeBullets.push({
    mesh: bGroup,
    tracer: tracerLine,
    position: startPos.clone(),
    velocity: new THREE.Vector3(-32.0, 0, 0),
    life: 0,
  });
}

function spawnEjectedCasing() {
  const casingMesh = new THREE.Mesh(casingGeo, matBrassCase);
  const startPos = new THREE.Vector3(0.2, 0.34, 0.22);
  casingMesh.position.copy(startPos);
  casingMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  scene.add(casingMesh);

  activeCasings.push({
    mesh: casingMesh,
    position: startPos.clone(),
    velocity: new THREE.Vector3(
      0.8 + Math.random() * 0.4,
      1.8 + Math.random() * 0.6,
      2.4 + Math.random() * 0.8,
    ),
    rotVelocity: new THREE.Vector3(
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20,
    ),
    life: 0,
  });
}

// -----------------------------------------------------------------------------
// Camera Setup
// -----------------------------------------------------------------------------
const camera = new THREE.PerspectiveCamera(24, window.innerWidth / window.innerHeight, 0.1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

function setCameraPreset(preset: 'hero' | 'side' | 'muzzle' | 'stock') {
  const dist = Math.max(size.x, size.y) * 1.35;
  if (preset === 'hero') {
    camera.position.set(center.x - size.x * 0.45, center.y + size.y * 0.35, center.z + dist * 0.78);
    controls.target.copy(center);
  } else if (preset === 'side') {
    camera.position.set(center.x - size.x * 0.05, center.y + size.y * 0.05, center.z + dist);
    controls.target.copy(center);
  } else if (preset === 'muzzle') {
    camera.position.set(-3.2, 0.6, 1.4);
    controls.target.set(-2.5, 0.37, 0);
  } else if (preset === 'stock') {
    camera.position.set(2.4, 0.5, 1.8);
    controls.target.set(1.0, 0.2, 0);
  }
  controls.update();
}
setCameraPreset(initialMode === 'eval' ? 'side' : 'hero');

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// -----------------------------------------------------------------------------
// Recoil & Disassembly Exploded View Engine with FX
// -----------------------------------------------------------------------------
let recoilIntensity = 0;
let autoFiringToggle = false;
let autoFireTimer = 0;
let reloadProgress = -1;
let slowMo = false;
let isExploded = false;
let explodeFactor = 0.0;

function triggerRecoil() {
  if (isExploded) return;
  recoilIntensity = 1.0;

  spawnBulletGoli();
  spawnEjectedCasing();

  muzzleLight.intensity = 24;
  matMuzzleFlame.opacity = 1.0;
  muzzleFlameMesh.scale.setScalar(1.0 + Math.random() * 0.4);
  muzzleFlameMesh.rotation.z = Math.random() * Math.PI;

  matSmoke.opacity = 0.6;
  smokeMesh.position.set(-3.85, 0.37, 0);
  smokeMesh.scale.setScalar(0.4);

  camera.position.x += (Math.random() - 0.5) * 0.02;
  camera.position.y += (Math.random() - 0.5) * 0.02;
}

function triggerReload() {
  if (reloadProgress < 0 && parts.magazineGroup && !isExploded) {
    reloadProgress = 0;
  }
}

function toggleExplodedView() {
  isExploded = !isExploded;
  triggerDisassemblyFX();

  const btnExplode = document.getElementById('btn-explode-toggle')!;
  if (isExploded) {
    btnExplode.classList.add('active');
    btnExplode.textContent = '⚡ Reassemble';
    autoFiringToggle = false;
    document.getElementById('btn-autofire-toggle')?.classList.remove('active');
  } else {
    btnExplode.classList.remove('active');
    btnExplode.textContent = '⚡ Disassemble';
  }
}

// -----------------------------------------------------------------------------
// Control Panel UI Event Binding
// -----------------------------------------------------------------------------
const btnExplodeToggle = document.getElementById('btn-explode-toggle')!;
const btnFire = document.getElementById('btn-fire')!;
const btnAutoFireToggle = document.getElementById('btn-autofire-toggle')!;
const btnReload = document.getElementById('btn-reload')!;
const toggleSlowMo = document.getElementById('toggle-slowmo') as HTMLInputElement;

btnExplodeToggle.addEventListener('click', () => toggleExplodedView());
btnFire.addEventListener('click', () => triggerRecoil());

btnAutoFireToggle.addEventListener('click', () => {
  if (isExploded) return;
  autoFiringToggle = !autoFiringToggle;
  if (autoFiringToggle) btnAutoFireToggle.classList.add('active');
  else btnAutoFireToggle.classList.remove('active');
});

btnReload.addEventListener('click', () => triggerReload());

toggleSlowMo.addEventListener('change', () => {
  slowMo = toggleSlowMo.checked;
});

// Skin Presets
const presets: Record<string, HTMLButtonElement> = {
  glacier: document.getElementById('preset-glacier') as HTMLButtonElement,
  fde: document.getElementById('preset-fde') as HTMLButtonElement,
  stealth: document.getElementById('preset-stealth') as HTMLButtonElement,
  cyberpunk: document.getElementById('preset-cyberpunk') as HTMLButtonElement,
};

Object.entries(presets).forEach(([key, btn]) => {
  btn.addEventListener('click', () => {
    Object.values(presets).forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    runtime.setPreset(key as any);
  });
});

// Camera Views
document.getElementById('cam-hero')!.addEventListener('click', () => setCameraPreset('hero'));
document.getElementById('cam-side')!.addEventListener('click', () => setCameraPreset('side'));
document.getElementById('cam-muzzle')!.addEventListener('click', () => setCameraPreset('muzzle'));
document.getElementById('cam-stock')!.addEventListener('click', () => setCameraPreset('stock'));

const toggleOrbit = document.getElementById('toggle-orbit') as HTMLInputElement;
toggleOrbit.addEventListener('change', () => {
  controls.autoRotate = toggleOrbit.checked;
  controls.autoRotateSpeed = 2.0;
});

// Component Toggles
const toggleForegrip = document.getElementById('toggle-foregrip') as HTMLInputElement;
toggleForegrip.addEventListener('change', () => {
  if (parts.foregripGroup) parts.foregripGroup.visible = toggleForegrip.checked;
});

const toggleSights = document.getElementById('toggle-sights') as HTMLInputElement;
toggleSights.addEventListener('change', () => {
  if (parts.frontSightMesh) parts.frontSightMesh.visible = toggleSights.checked;
  if (parts.rearSightMesh) parts.rearSightMesh.visible = toggleSights.checked;
});

const toggleMag = document.getElementById('toggle-mag') as HTMLInputElement;
toggleMag.addEventListener('change', () => {
  if (parts.magazineGroup) parts.magazineGroup.visible = toggleMag.checked;
});

// Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE') {
    toggleExplodedView();
  } else if (e.code === 'Space') {
    e.preventDefault();
    triggerRecoil();
  } else if (e.code === 'KeyF') {
    if (isExploded) return;
    autoFiringToggle = !autoFiringToggle;
    if (autoFiringToggle) btnAutoFireToggle.classList.add('active');
    else btnAutoFireToggle.classList.remove('active');
  } else if (e.code === 'KeyR') {
    triggerReload();
  } else if (e.code === 'KeyO') {
    toggleOrbit.checked = !toggleOrbit.checked;
    controls.autoRotate = toggleOrbit.checked;
  } else if (e.code === 'KeyC') {
    const cams: ('hero' | 'side' | 'muzzle' | 'stock')[] = ['hero', 'side', 'muzzle', 'stock'];
    const idx = (cams.indexOf('hero') + 1) % cams.length;
    setCameraPreset(cams[idx]);
  }
});

// -----------------------------------------------------------------------------
// Main Animation Loop with Rolling Average FPS Smoothing
// -----------------------------------------------------------------------------
let clock = new THREE.Clock();
const frameDeltas: number[] = [];

function animate() {
  const rawDelta = clock.getDelta();
  const delta = slowMo ? rawDelta * 0.12 : rawDelta;

  // Rolling 30-frame average for smooth FPS display
  frameDeltas.push(rawDelta);
  if (frameDeltas.length > 30) frameDeltas.shift();
  const avgDelta = frameDeltas.reduce((a, b) => a + b, 0) / frameDeltas.length;
  const currentFPS = Math.round(1 / Math.max(0.001, avgDelta));

  const targetExplode = isExploded ? 1.0 : 0.0;
  explodeFactor = THREE.MathUtils.lerp(explodeFactor, targetExplode, delta * 8.0);

  if (matShockwave.opacity > 0) {
    matShockwave.opacity = Math.max(0, matShockwave.opacity - delta * 2.5);
    shockwaveMesh.scale.addScalar(delta * 4.5);
  }

  if (assemblyFlashLight.intensity > 0) {
    assemblyFlashLight.intensity = Math.max(0, assemblyFlashLight.intensity - delta * 80.0);
  }

  if (isExploded && matCrystal.opacity < 0.95) {
    matCrystal.opacity = Math.min(0.95, matCrystal.opacity + delta * 3.0);
  } else if (!isExploded && matCrystal.opacity > 0) {
    matCrystal.opacity = Math.max(0, matCrystal.opacity - delta * 3.0);
  }

  floatingCrystals.forEach((c) => {
    c.mesh.position.addScaledVector(c.velocity, delta * explodeFactor);
    c.mesh.rotation.x += delta * 2.0;
    c.mesh.rotation.y += delta * 2.0;
  });

  model.rotation.y = THREE.MathUtils.lerp(model.rotation.y, isExploded ? -Math.PI / 4 : 0, delta * 6.0);
  model.rotation.z = THREE.MathUtils.lerp(model.rotation.z, isExploded ? Math.PI / 6 : 0, delta * 6.0);

  if (subAssemblies) {
    const keys = Object.keys(subAssemblies);
    keys.forEach((key, index) => {
      const sub: any = subAssemblies[key];
      const delay = index * 0.08;
      const localFactor = Math.max(0, Math.min(1.0, (explodeFactor - delay) / (1.0 - delay)));

      sub.obj.position.lerpVectors(sub.homePos, sub.explodePos, localFactor);
      sub.obj.rotation.x = THREE.MathUtils.lerp(sub.homeRot.x, sub.explodeRot.x, localFactor);
      sub.obj.rotation.y = THREE.MathUtils.lerp(sub.homeRot.y, sub.explodeRot.y, localFactor);
      sub.obj.rotation.z = THREE.MathUtils.lerp(sub.homeRot.z, sub.explodeRot.z, localFactor);
    });
  }

  if (autoFiringToggle && !isExploded) {
    autoFireTimer += rawDelta;
    if (autoFireTimer > (slowMo ? 0.25 : 0.08)) {
      triggerRecoil();
      autoFireTimer = 0;
    }
  }

  for (let i = activeBullets.length - 1; i >= 0; i--) {
    const b = activeBullets[i];
    b.life += delta;
    b.position.addScaledVector(b.velocity, delta);
    b.mesh.position.copy(b.position);

    if (b.life > 1.8) {
      scene.remove(b.mesh);
      activeBullets.splice(i, 1);
    }
  }

  for (let i = activeCasings.length - 1; i >= 0; i--) {
    const c = activeCasings[i];
    c.life += delta;
    c.velocity.y -= 9.8 * delta;
    c.position.addScaledVector(c.velocity, delta);
    c.mesh.position.copy(c.position);
    c.mesh.rotation.x += c.rotVelocity.x * delta;
    c.mesh.rotation.y += c.rotVelocity.y * delta;
    c.mesh.rotation.z += c.rotVelocity.z * delta;

    if (c.position.y < -3.0 || c.life > 2.5) {
      scene.remove(c.mesh);
      activeCasings.splice(i, 1);
    }
  }

  if (matMuzzleFlame.opacity > 0) {
    matMuzzleFlame.opacity = Math.max(0, matMuzzleFlame.opacity - delta * 18.0);
    muzzleLight.intensity = matMuzzleFlame.opacity * 24;
  }

  if (matSmoke.opacity > 0) {
    matSmoke.opacity = Math.max(0, matSmoke.opacity - delta * 1.5);
    smokeMesh.position.x -= delta * 0.8;
    smokeMesh.scale.addScalar(delta * 0.8);
  }

  if (recoilIntensity > 0 && !isExploded) {
    recoilIntensity = Math.max(0, recoilIntensity - delta * 14.0);

    const kickZ = Math.sin(recoilIntensity * Math.PI) * 0.15;
    const kickRotZ = Math.sin(recoilIntensity * Math.PI) * 0.06;
    model.position.x = kickZ;

    if (parts.boltCarrier) {
      parts.boltCarrier.position.x = 0.2 + kickZ * 1.2;
    }
  } else if (!isExploded) {
    model.position.x = THREE.MathUtils.lerp(model.position.x, 0, 0.15);
    if (parts.boltCarrier) parts.boltCarrier.position.x = 0.2;
  }

  if (reloadProgress >= 0 && parts.magazineGroup && !isExploded) {
    reloadProgress += delta * 2.2;
    if (reloadProgress <= 1.0) {
      parts.magazineGroup.position.y = -0.35 - Math.sin(reloadProgress * Math.PI) * 0.8;
      parts.magazineGroup.position.x = -0.3 - Math.sin(reloadProgress * Math.PI) * 0.2;
    } else if (reloadProgress <= 2.0) {
      const t = reloadProgress - 1.0;
      parts.magazineGroup.position.y = -0.35 - (1.0 - t) * 0.8;
      parts.magazineGroup.position.x = -0.3 - (1.0 - t) * 0.2;
    } else {
      parts.magazineGroup.position.set(-0.3, -0.35, 0);
      reloadProgress = -1;
    }
  }

  controls.update();
  renderer.render(scene, camera);

  hud.textContent =
    `FPS: ${currentFPS} | M416 Glacier | 5.56mm NATO | ${isExploded ? 'EXPLODED (ZHUUPP!)' : 'ASSEMBLED'}`;
}

renderer.setAnimationLoop(animate);
(window as any).__ready = true;
