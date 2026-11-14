import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ARENA } from '../sim/constants';
import { loadCameraSnapshot, saveCameraSnapshot, type CameraSnapshot } from '../state/storage';

const ISO_AZIMUTH = THREE.MathUtils.degToRad(45);
const ISO_ELEVATION = THREE.MathUtils.degToRad(35.264);
const MIN_POLAR = 0.15;
const MAX_POLAR = Math.PI / 2 - 0.06;

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private locked = false;

  constructor(domElement: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 24;
    this.controls.minPolarAngle = MIN_POLAR;
    this.controls.maxPolarAngle = MAX_POLAR;
    this.controls.target.set(0, 0, 0);

    const saved = loadCameraSnapshot();
    if (saved) {
      this.applySnapshot(saved);
    } else {
      this.reset();
    }
  }

  get isLocked(): boolean {
    return this.locked;
  }

  reset(): void {
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const distance =
      (Math.max(ARENA.lengthX, ARENA.widthZ) / 2 / Math.tan(fov / 2)) * 1.18;
    const cosElevation = Math.cos(ISO_ELEVATION);

    this.camera.position.set(
      distance * cosElevation * Math.sin(ISO_AZIMUTH),
      distance * Math.sin(ISO_ELEVATION),
      distance * cosElevation * Math.cos(ISO_AZIMUTH),
    );
    this.camera.lookAt(0, 0, 0);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  applySnapshot(snapshot: CameraSnapshot): void {
    const polar = THREE.MathUtils.clamp(snapshot.polar, MIN_POLAR, MAX_POLAR);
    const radius = THREE.MathUtils.clamp(snapshot.radius, 4, 24);
    const [tx, ty, tz] = snapshot.target;
    this.controls.target.set(tx, ty, tz);
    this.camera.position.set(
      tx + radius * Math.sin(polar) * Math.sin(snapshot.azimuth),
      ty + radius * Math.cos(polar),
      tz + radius * Math.sin(polar) * Math.cos(snapshot.azimuth),
    );
    this.camera.lookAt(tx, ty, tz);
    this.controls.update();
  }

  snapshot(): CameraSnapshot {
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    const radius = offset.length();
    const polar = Math.acos(THREE.MathUtils.clamp(offset.y / Math.max(radius, 1e-6), -1, 1));
    return {
      azimuth: Math.atan2(offset.x, offset.z),
      polar,
      radius,
      target: [this.controls.target.x, this.controls.target.y, this.controls.target.z],
    };
  }

  persist(): void {
    saveCameraSnapshot(this.snapshot());
  }

  setLocked(locked: boolean): void {
    this.locked = locked;
    this.controls.enabled = !locked;
    if (locked) {
      this.persist();
    }
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  update(): void {
    if (!this.locked) {
      this.controls.update();
    }
  }
}
