import * as THREE from 'three';
import { ARENA, BUMP } from '../sim/constants';
import {
  AREAS,
  BUMPS,
  LATERES_PICK_ZONES,
  LEX_DROP_ZONES,
  ZONES,
  type Area,
  type Rect,
} from '../sim/trackLayout';

export type FloorState = 'loading' | 'loaded' | 'missing';

const OFFSET_X = -ARENA.lengthX / 2;
const OFFSET_Z = -ARENA.widthZ / 2;

interface ZoneDisplay {
  rect: Rect;
  color: number;
  label: string;
  scale: number;
}

const ZONE_DISPLAYS: readonly ZoneDisplay[] = [
  { rect: ZONES.startTransporter, color: 0x37d67a, label: 'START T', scale: 0.62 },
  { rect: ZONES.startLineFollower, color: 0x37d67a, label: 'START LF', scale: 0.5 },
  { rect: ZONES.finish, color: 0xf2c94c, label: 'FINISH', scale: 0.7 },
  { rect: ZONES.pickLex, color: 0x4cc2ff, label: 'PICK LEX', scale: 0.55 },
  { rect: ZONES.dropLateres, color: 0xff9f43, label: 'DROP LATERES', scale: 0.55 },
  { rect: ZONES.transfer, color: 0xb57bff, label: 'TRANSFER L', scale: 0.6 },
  { rect: ZONES.transferRight, color: 0xb57bff, label: 'TRANSFER R', scale: 0.6 },
  ...LATERES_PICK_ZONES.map((rect) => ({
    rect,
    color: 0xff6b6b,
    label: '',
    scale: 0.32,
  })),
  ...LEX_DROP_ZONES.map((rect) => ({
    rect,
    color: 0x4cc2ff,
    label: '',
    scale: 0.32,
  })),
];

function centerOf(rect: Rect): THREE.Vector3 {
  return new THREE.Vector3(
    rect.x + rect.w / 2 + OFFSET_X,
    0,
    rect.z + rect.d / 2 + OFFSET_Z,
  );
}

function makeLabel(text: string, color: string, scale = 1): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D tidak tersedia');
  }

  context.fillStyle = 'rgba(7, 11, 17, 0.55)';
  context.beginPath();
  context.roundRect(4, 18, 504, 60, 14);
  context.fill();

  context.font = '600 34px system-ui, -apple-system, "Segoe UI", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = color;
  context.fillText(text, 256, 48);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale, 0.1875 * scale, 1);
  return sprite;
}

function createFloor(
  renderer: THREE.WebGLRenderer,
  onFloorState?: (state: FloorState) => void,
): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    color: 0x16212c,
    roughness: 0.94,
    metalness: 0.02,
  });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA.lengthX, ARENA.widthZ),
    material,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;

  const url = `${import.meta.env.BASE_URL}assets/track/floor.webp`;
  onFloorState?.('loading');

  new THREE.TextureLoader().load(
    url,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      material.map = texture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
      onFloorState?.('loaded');
    },
    undefined,
    () => {
      console.warn(`Tekstur trek tidak ditemukan di ${url}. Jalankan npm run assets.`);
      onFloorState?.('missing');
    },
  );

  return floor;
}

function addWalls(group: THREE.Group): void {
  const thickness = ARENA.wallThickness;
  const height = ARENA.wallHeight;
  const material = new THREE.MeshStandardMaterial({
    color: 0x5b6b7c,
    roughness: 0.82,
  });

  const walls = [
    { w: ARENA.lengthX + thickness * 2, d: thickness, x: 0, z: -ARENA.widthZ / 2 - thickness / 2 },
    { w: ARENA.lengthX + thickness * 2, d: thickness, x: 0, z: ARENA.widthZ / 2 + thickness / 2 },
    { w: thickness, d: ARENA.widthZ, x: -ARENA.lengthX / 2 - thickness / 2, z: 0 },
    { w: thickness, d: ARENA.widthZ, x: ARENA.lengthX / 2 + thickness / 2, z: 0 },
  ];

  for (const wall of walls) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.w, height, wall.d), material);
    mesh.position.set(wall.x, height / 2, wall.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}

function addAreas(group: THREE.Group): void {
  for (const area of Object.values(AREAS) as Area[]) {
    const center = centerOf(area);
    const tint = new THREE.Mesh(
      new THREE.PlaneGeometry(area.w, area.d),
      new THREE.MeshBasicMaterial({
        color: area.color,
        transparent: true,
        opacity: 0.07,
        depthWrite: false,
      }),
    );
    tint.rotation.x = -Math.PI / 2;
    tint.position.set(center.x, 0.0008, center.z);
    tint.renderOrder = 1;
    group.add(tint);

    const label = makeLabel(area.label, area.text, 0.9);
    label.position.set(center.x, 0.035, center.z - area.d / 2 + 0.24);
    group.add(label);
  }
}

function addOutline(group: THREE.Group, rect: Rect, color: number): void {
  const center = centerOf(rect);
  const halfWidth = rect.w / 2;
  const halfDepth = rect.d / 2;
  const y = 0.004;

  const points = [
    new THREE.Vector3(center.x - halfWidth, y, center.z - halfDepth),
    new THREE.Vector3(center.x + halfWidth, y, center.z - halfDepth),
    new THREE.Vector3(center.x + halfWidth, y, center.z + halfDepth),
    new THREE.Vector3(center.x - halfWidth, y, center.z + halfDepth),
  ];

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.LineLoop(
    geometry,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }),
  );
  line.renderOrder = 3;
  group.add(line);
}

function addZones(group: THREE.Group): void {
  for (const zone of ZONE_DISPLAYS) {
    const center = centerOf(zone.rect);

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(zone.rect.w, zone.rect.d),
      new THREE.MeshBasicMaterial({
        color: zone.color,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(center.x, 0.0025, center.z);
    plane.renderOrder = 2;
    group.add(plane);

    addOutline(group, zone.rect, zone.color);

    if (!zone.label) {
      continue;
    }
    const label = makeLabel(zone.label, '#e9f1fa', zone.scale);
    label.position.set(center.x, 0.055, center.z);
    label.renderOrder = 4;
    group.add(label);
  }
}

function addBumps(group: THREE.Group): void {
  const material = new THREE.MeshStandardMaterial({
    color: 0x8a97a6,
    roughness: 0.72,
  });

  for (const bump of BUMPS) {
    const center = centerOf(bump);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(bump.w, BUMP.height, bump.d),
      material,
    );
    mesh.position.set(center.x, BUMP.height / 2, center.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}

export function buildArena(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  onFloorState?: (state: FloorState) => void,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'arena';

  group.add(createFloor(renderer, onFloorState));
  addWalls(group);
  addAreas(group);
  addZones(group);
  addBumps(group);

  scene.add(group);
  return group;
}
