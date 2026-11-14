import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ARENA } from '../sim/constants';

export const TRACK_MODEL_URL = `${import.meta.env.BASE_URL}assets/track/track.glb`;

/** Putaran model hasil ekspor SketchUp: 0, 90, 180, atau 270 derajat. */
export const TRACK_MODEL_YAW = 0;

/**
 * Memuat model trek resmi (hasil ekspor SketchUp ke glTF) bila tersedia.
 * Model diskalakan agar panjangnya 6 m dan diletakkan di atas lantai.
 */
export function loadTrackModel(
  scene: THREE.Scene,
  onResult: (loaded: boolean) => void,
): void {
  void trackModelAvailable().then((available) => {
    if (!available) {
      onResult(false);
      return;
    }
    new GLTFLoader().load(
      TRACK_MODEL_URL,
      (gltf) => {
        const model = gltf.scene;
        model.name = 'track-model';
        model.rotation.y = THREE.MathUtils.degToRad(TRACK_MODEL_YAW);
        model.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        if (size.x < 1e-6 || size.z < 1e-6) {
          onResult(false);
          return;
        }

        const scale = ARENA.lengthX / size.x;
        model.scale.setScalar(scale);

        const center = box.getCenter(new THREE.Vector3());
        model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        scene.add(model);
        onResult(true);
      },
      undefined,
      () => onResult(false),
    );
  });
}

/**
 * Server statis mengembalikan index.html untuk path yang tidak ada, jadi tipe
 * konten diperiksa dulu agar GLTFLoader tidak mem-parse HTML.
 */
async function trackModelAvailable(): Promise<boolean> {
  try {
    const response = await fetch(TRACK_MODEL_URL, { method: 'HEAD' });
    if (!response.ok) {
      return false;
    }
    const type = response.headers.get('content-type') ?? '';
    return !type.includes('text/html');
  } catch {
    return false;
  }
}
