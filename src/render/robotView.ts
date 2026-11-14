import * as THREE from 'three';
import { ARENA } from '../sim/constants';
import type { RobotState } from '../sim/robot';

export class RobotView {
  readonly group: THREE.Group;

  constructor(color = 0x4cc2ff) {
    this.group = new THREE.Group();
    this.group.name = 'transporter';

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.45,
      metalness: 0.25,
    });
    const deckMaterial = new THREE.MeshStandardMaterial({
      color: 0x203040,
      roughness: 0.6,
      metalness: 0.3,
    });
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x11161c,
      roughness: 0.9,
    });
    const metalMaterial = new THREE.MeshStandardMaterial({
      color: 0xb8c4d2,
      roughness: 0.35,
      metalness: 0.75,
    });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.24), bodyMaterial);
    chassis.position.y = 0.075;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    this.group.add(chassis);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.18), deckMaterial);
    deck.position.y = 0.115;
    deck.castShadow = true;
    this.group.add(deck);

    const wheelGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.03, 18);
    wheelGeometry.rotateX(Math.PI / 2);
    for (const x of [-0.11, 0.11]) {
      for (const z of [-0.13, 0.13]) {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.position.set(x, 0.04, z);
        wheel.castShadow = true;
        this.group.add(wheel);
      }
    }

    const gripperBase = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.14), metalMaterial);
    gripperBase.position.set(0.16, 0.075, 0);
    gripperBase.castShadow = true;
    this.group.add(gripperBase);

    for (const z of [-0.05, 0.05]) {
      const prong = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.02), metalMaterial);
      prong.position.set(0.21, 0.075, z);
      prong.castShadow = true;
      this.group.add(prong);
    }

    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.006, 0.06), metalMaterial);
    marker.position.set(0.095, 0.13, 0);
    this.group.add(marker);
  }

  setModel(model: THREE.Object3D): void {
    this.group.clear();
    this.group.add(model);
  }

  update(state: Pick<RobotState, 'x' | 'z' | 'yaw'>): void {
    this.group.position.set(state.x - ARENA.lengthX / 2, 0, state.z - ARENA.widthZ / 2);
    this.group.rotation.y = -state.yaw;
  }
}
