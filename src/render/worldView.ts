import * as THREE from 'three';
import { ARENA, GATES } from '../sim/constants';
import type { GateId, GatePlacement, GateState } from '../sim/gates';
import { leverPoint } from '../sim/gates';
import { objectHeight, objectExtent, type ObjectKind, type SimObject } from '../sim/objects';
import type { World } from '../sim/world';
import { GATE_PLACES } from '../sim/trackLayout';
import { loadRobotModel } from './robotModel';
import { RobotView } from './robotView';

const OFFSET_X = -ARENA.lengthX / 2;
const OFFSET_Z = -ARENA.widthZ / 2;

const OBJECT_COLORS: Record<ObjectKind, number> = {
  LEX: 0x4cc2ff,
  LATERES: 0xff9f43,
};

const GATE_HEIGHTS: Record<GateId, number> = {
  catarata1: GATES.catarata1.height,
  catarata2: GATES.catarata2.height,
};

/** Mesin tampilan untuk seluruh isi simulasi: objek, gate, dan LF. */
export class WorldView {
  readonly group = new THREE.Group();
  private readonly transporter: RobotView;
  private readonly lineFollower: RobotView;
  private readonly objects = new Map<string, THREE.Mesh>();
  private readonly gates = new Map<GateId, GateView>();

  constructor() {
    this.group.name = 'sim-world';

    this.transporter = new RobotView(0x4cc2ff);
    this.lineFollower = new RobotView(0xf2c94c);
    this.lineFollower.group.name = 'line-follower';
    this.lineFollower.group.scale.setScalar(0.72);
    this.group.add(this.transporter.group, this.lineFollower.group);

    for (const id of Object.keys(GATE_PLACES) as GateId[]) {
      const view = new GateView(id, GATE_PLACES[id]);
      this.gates.set(id, view);
      this.group.add(view.group);
    }

    void loadRobotModel('transporter').then((model) => {
      if (model) {
        this.transporter.setModel(model);
      }
    });
    void loadRobotModel('line-follower').then((model) => {
      if (model) {
        this.lineFollower.group.scale.setScalar(1);
        this.lineFollower.setModel(model);
      }
    });
  }

  setObjects(objects: readonly SimObject[]): void {
    for (const mesh of this.objects.values()) {
      this.group.remove(mesh);
    }
    this.objects.clear();
    for (const object of objects) {
      const mesh = createObjectMesh(object.kind);
      this.group.add(mesh);
      this.objects.set(object.id, mesh);
    }
  }

  sync(world: World): void {
    this.transporter.update(world.transporter.state);
    this.lineFollower.update(world.lineFollower.state);

    for (const object of world.objects) {
      const mesh = this.objects.get(object.id);
      if (!mesh) continue;
      const height = objectHeight(object.kind);
      mesh.position.set(object.x + OFFSET_X, object.y + height / 2, object.z + OFFSET_Z);
      mesh.rotation.y = 0;
      mesh.visible = true;
    }

    for (const gate of world.gates) {
      this.gates.get(gate.id)?.apply(gate);
    }
  }
}

function createObjectMesh(kind: ObjectKind): THREE.Mesh {
  const extent = objectExtent(kind);
  const height = objectHeight(kind);
  const material = new THREE.MeshStandardMaterial({
    color: OBJECT_COLORS[kind],
    roughness: 0.55,
    metalness: 0.1,
    emissive: new THREE.Color(OBJECT_COLORS[kind]).multiplyScalar(0.18),
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(extent, height, extent), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

class GateView {
  readonly group = new THREE.Group();
  private readonly door: THREE.Group;
  private readonly leverMaterial: THREE.MeshStandardMaterial;
  private readonly height: number;
  private readonly sign: number;

  constructor(id: GateId, placement: GatePlacement) {
    this.height = GATE_HEIGHTS[id];
    const horizontal = placement.hingeSide === 'lowX' || placement.hingeSide === 'highX';
    this.sign = placement.hingeSide === 'lowZ' || placement.hingeSide === 'lowX' ? 1 : -1;

    if (horizontal) {
      const hingeX = placement.hingeSide === 'lowX' ? placement.x : placement.x + placement.w;
      this.group.position.set(hingeX + OFFSET_X, 0, placement.z + placement.d / 2 + OFFSET_Z);
    } else {
      const hingeZ = placement.hingeSide === 'lowZ' ? placement.z : placement.z + placement.d;
      this.group.position.set(
        placement.x + placement.w / 2 + OFFSET_X,
        0,
        hingeZ + OFFSET_Z,
      );
    }

    this.door = new THREE.Group();
    this.group.add(this.door);

    const material = new THREE.MeshStandardMaterial({
      color: 0xb5522f,
      roughness: 0.62,
      metalness: 0.08,
    });
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(placement.w, this.height, placement.d),
      material,
    );
    if (horizontal) {
      panel.position.set((this.sign * placement.w) / 2, this.height / 2, 0);
    } else {
      panel.position.set(0, this.height / 2, (this.sign * placement.d) / 2);
    }
    panel.castShadow = true;
    panel.receiveShadow = true;
    this.door.add(panel);

    const lever = leverPoint(placement);
    this.leverMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd166,
      roughness: 0.4,
      metalness: 0.35,
    });
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.13, 0.012),
      this.leverMaterial,
    );
    post.position.set(lever.x - this.group.position.x, 0.065, lever.z - this.group.position.z);
    post.castShadow = true;
    this.group.add(post);
  }

  apply(state: GateState): void {
    this.door.rotation.y = THREE.MathUtils.degToRad(state.angleDeg) * this.sign;
    this.leverMaterial.color.set(state.open ? 0x37d67a : 0xffd166);
  }
}
