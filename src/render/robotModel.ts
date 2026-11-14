import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type RobotModelName = 'transporter' | 'line-follower';

export function loadRobotModel(name: RobotModelName): Promise<THREE.Group | null> {
  const url = `${import.meta.env.BASE_URL}assets/models/${name}.glb`;
  return available(url).then((ok) => {
    if (!ok) {
      return null;
    }
    return new Promise<THREE.Group | null>((resolve) => {
      new GLTFLoader().load(
        url,
        (gltf) => {
          gltf.scene.name = `${name}-model`;
          gltf.scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          resolve(gltf.scene);
        },
        undefined,
        () => resolve(null),
      );
    });
  });
}

async function available(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) {
      return false;
    }
    const type = response.headers.get('content-type') ?? '';
    return !type.includes('text/html');
  } catch {
    return false;
  }
}
