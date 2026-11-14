import { ARENA, ROBOT } from './constants';
import type { GateState } from './gates';
import type { SimObject } from './objects';
import {
  GATE_PLACES,
  LATERES_SPOTS,
  LEX_DROP_SPOTS,
  LEX_DROP_ZONES,
  LF_FINISH_STOP,
  LF_TAPE,
  TRANSFER_STOPS,
  TRANSFER_ZONES,
  type LfSpot,
  type LfTapeNode,
  type Point,
  type Rect,
} from './trackLayout';

export type LfTask = 'idle' | 'pickup' | 'deliver' | 'finish' | 'done';

export interface LfAgentState {
  x: number;
  z: number;
  yaw: number;
  speed: number;
  carryId: string | null;
  task: LfTask;
  waiting: boolean;
  running: boolean;
  paused: boolean;
}

type RouteAction = 'pick' | 'transfer' | 'dropLex' | 'finish';

const TURN_RATE = 7;
const ARRIVE = 0.06;
const LOOKAHEAD = 0.08;
const PICK_DISTANCE = 0.18;
const SPOT_TOLERANCE = 0.14;

const HALF = ROBOT.lineFollower.footprint / 2;
const MIN_X = HALF;
const MAX_X = ARENA.lengthX - HALF;
const MIN_Z = HALF;
const MAX_Z = ARENA.widthZ - HALF;

const NODE_NAMES = Object.keys(LF_TAPE.nodes) as LfTapeNode[];

interface TapeEdge {
  to: LfTapeNode;
  cost: number;
}

const ADJACENCY = new Map<LfTapeNode, TapeEdge[]>();
for (const [fromName, toName] of LF_TAPE.edges) {
  const from = fromName as LfTapeNode;
  const to = toName as LfTapeNode;
  const a = LF_TAPE.nodes[from];
  const b = LF_TAPE.nodes[to];
  const cost = Math.hypot(a.x - b.x, a.z - b.z);
  if (!ADJACENCY.has(from)) ADJACENCY.set(from, []);
  if (!ADJACENCY.has(to)) ADJACENCY.set(to, []);
  ADJACENCY.get(from)?.push({ to, cost });
  ADJACENCY.get(to)?.push({ to: from, cost });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeAngle(angle: number): number {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function insideRect(x: number, z: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.w && z >= rect.z && z <= rect.z + rect.d;
}

function insideAny(rects: readonly Rect[], x: number, z: number): boolean {
  return rects.some((rect) => insideRect(x, z, rect));
}

function nearestTapeNode(x: number, z: number): LfTapeNode {
  let best: LfTapeNode = 'start';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const name of NODE_NAMES) {
    const node = LF_TAPE.nodes[name];
    const distance = Math.hypot(node.x - x, node.z - z);
    if (distance < bestDistance) {
      best = name;
      bestDistance = distance;
    }
  }
  return best;
}

function shortestPath(from: LfTapeNode, to: LfTapeNode): LfTapeNode[] {
  const dist = new Map<LfTapeNode, number>();
  const previous = new Map<LfTapeNode, LfTapeNode>();
  const visited = new Set<LfTapeNode>();
  for (const name of NODE_NAMES) dist.set(name, Number.POSITIVE_INFINITY);
  dist.set(from, 0);

  while (visited.size < NODE_NAMES.length) {
    let current: LfTapeNode | null = null;
    let currentDistance = Number.POSITIVE_INFINITY;
    for (const name of NODE_NAMES) {
      if (visited.has(name)) continue;
      const value = dist.get(name) ?? Number.POSITIVE_INFINITY;
      if (value < currentDistance) {
        current = name;
        currentDistance = value;
      }
    }
    if (current === null) break;
    if (current === to) break;
    visited.add(current);
    for (const edge of ADJACENCY.get(current) ?? []) {
      const candidate = currentDistance + edge.cost;
      if (candidate < (dist.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        dist.set(edge.to, candidate);
        previous.set(edge.to, current);
      }
    }
  }

  if (!Number.isFinite(dist.get(to) ?? Number.POSITIVE_INFINITY)) {
    return [from];
  }
  const path: LfTapeNode[] = [];
  let cursor: LfTapeNode | undefined = to;
  while (cursor) {
    path.push(cursor);
    if (cursor === from) break;
    cursor = previous.get(cursor);
  }
  return path.reverse();
}

function pathFor(from: LfTapeNode, to: LfTapeNode): Point[] {
  return shortestPath(from, to).map((name) => {
    const node = LF_TAPE.nodes[name];
    return { x: node.x, z: node.z };
  });
}

function segmentCrossesRect(a: Point, b: Point, rect: Rect): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.02));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    if (insideRect(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, rect)) {
      return true;
    }
  }
  return false;
}

function pathCrossesClosedGate(path: readonly Point[], gates: readonly GateState[]): boolean {
  for (const gate of gates) {
    if (gate.open) continue;
    const placement = GATE_PLACES[gate.id];
    for (let i = 1; i < path.length; i += 1) {
      if (segmentCrossesRect(path[i - 1], path[i], placement)) return true;
    }
  }
  return false;
}

function taskFor(action: RouteAction): LfTask {
  if (action === 'finish') return 'finish';
  if (action === 'pick') return 'pickup';
  return 'deliver';
}

/**
 * Line Follower otomatis yang menyusuri pita hitam sesuai banner LF:
 * Dijkstra di atas graf LF_TAPE, lalu lookahead sepanjang polyline.
 * Gate CATARACTA yang tertutup membuat LF berhenti menunggu.
 */
export class LineFollowerAgent {
  state: LfAgentState;
  private action: RouteAction | null = null;
  private targetSpot: LfSpot | null = null;
  private targetObjectId: string | null = null;
  private route: Point[] = [];
  private routeIndex = 0;
  private routeT = 0;

  constructor(x: number, z: number, yaw = 0) {
    this.state = {
      x,
      z,
      yaw,
      speed: ROBOT.lineFollower.defaultSpeed,
      carryId: null,
      task: 'idle',
      waiting: false,
      running: false,
      paused: false,
    };
  }

  reset(x: number, z: number, yaw = 0): void {
    this.state.x = x;
    this.state.z = z;
    this.state.yaw = yaw;
    this.state.carryId = null;
    this.state.task = 'idle';
    this.state.waiting = false;
    this.state.running = false;
    this.state.paused = false;
    this.action = null;
    this.targetSpot = null;
    this.targetObjectId = null;
    this.route = [];
    this.routeIndex = 0;
    this.routeT = 0;
  }

  setSpeed(speed: number): void {
    this.state.speed = clamp(speed, ROBOT.lineFollower.minSpeed, ROBOT.lineFollower.maxSpeed);
  }

  toggleRunning(): void {
    this.state.running = !this.state.running;
  }

  update(dt: number, objects: SimObject[], gates: readonly GateState[]): void {
    this.state.waiting = false;
    if (!this.state.running || this.state.paused) {
      return;
    }
    if (this.state.task === 'done') {
      return;
    }
    if (this.state.carryId && !this.carriedObject(objects)) {
      this.state.carryId = null;
    }
    if (this.action === null) {
      this.plan(objects, gates);
      if (this.action === null) {
        return;
      }
    }
    if (this.followRoute(dt, gates)) {
      this.completeAction(objects);
    }
  }

  carryKind(objects: SimObject[]): 'LEX' | 'LATERES' | null {
    return this.carriedObject(objects)?.kind ?? null;
  }

  private carriedObject(objects: SimObject[]): SimObject | null {
    if (!this.state.carryId) return null;
    return objects.find((object) => object.id === this.state.carryId) ?? null;
  }

  private plan(objects: SimObject[], gates: readonly GateState[]): void {
    const carried = this.carriedObject(objects);

    if (carried) {
      if (carried.kind === 'LEX') {
        const spot = this.chooseLexDropSpot(objects, gates, carried.id);
        if (spot) {
          this.startAction('dropLex', spot, carried.id);
          return;
        }
      } else {
        const stop = this.chooseTransferStop(gates);
        if (stop) {
          this.startAction('transfer', stop, carried.id);
          return;
        }
      }
    }

    const lex = this.pickLexSource(objects);
    if (lex) {
      const stop = this.nearestTransferStopTo(lex, gates);
      if (stop) {
        this.startAction('pick', stop, lex.id);
        return;
      }
    }

    const lateres = this.pickLateresSource(objects, gates);
    if (lateres) {
      this.startAction('pick', lateres.spot, lateres.object.id);
      return;
    }

    this.startAction('finish', LF_FINISH_STOP, null);
  }

  private pickLexSource(objects: SimObject[]): SimObject | null {
    const candidates = objects
      .filter(
        (object) =>
          object.kind === 'LEX' &&
          !object.carrier &&
          insideAny(TRANSFER_ZONES, object.x, object.z),
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - this.state.x, a.z - this.state.z) -
          Math.hypot(b.x - this.state.x, b.z - this.state.z),
      );
    return candidates[0] ?? null;
  }

  private pickSpotForObject(object: SimObject): LfSpot | null {
    return (
      LATERES_SPOTS.find(
        (spot) => Math.hypot(spot.x - object.x, spot.z - object.z) <= SPOT_TOLERANCE,
      ) ?? null
    );
  }

  private pickLateresSource(
    objects: SimObject[],
    gates: readonly GateState[],
  ): { object: SimObject; spot: LfSpot } | null {
    const from = nearestTapeNode(this.state.x, this.state.z);
    const candidates = objects
      .filter((object) => object.kind === 'LATERES' && !object.carrier)
      .map((object) => ({ object, spot: this.pickSpotForObject(object) }))
      .filter((entry): entry is { object: SimObject; spot: LfSpot } => entry.spot !== null)
      .filter(
        ({ object }) =>
          !insideAny(TRANSFER_ZONES, object.x, object.z) &&
          !insideAny(LEX_DROP_ZONES, object.x, object.z),
      )
      .sort(
        (a, b) =>
          Math.hypot(a.object.x - this.state.x, a.object.z - this.state.z) -
          Math.hypot(b.object.x - this.state.x, b.object.z - this.state.z),
      );

    const reachable = candidates.find(
      (entry) => !pathCrossesClosedGate(pathFor(from, entry.spot.node), gates),
    );
    return reachable ?? candidates[0] ?? null;
  }

  private chooseLexDropSpot(
    objects: SimObject[],
    gates: readonly GateState[],
    carriedId: string,
  ): LfSpot | null {
    const free = LEX_DROP_SPOTS.filter((_spot, index) => {
      const zone = LEX_DROP_ZONES[index];
      return !objects.some(
        (object) =>
          object.kind === 'LEX' &&
          object.id !== carriedId &&
          !object.carrier &&
          insideRect(object.x, object.z, zone),
      );
    });
    return this.chooseReachableSpot(free.length > 0 ? free : LEX_DROP_SPOTS, gates);
  }

  private chooseReachableSpot(spots: readonly LfSpot[], gates: readonly GateState[]): LfSpot | null {
    if (spots.length === 0) return null;
    const from = nearestTapeNode(this.state.x, this.state.z);
    let best: LfSpot | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const spot of spots) {
      if (pathCrossesClosedGate(pathFor(from, spot.node), gates)) continue;
      const distance = Math.hypot(spot.x - this.state.x, spot.z - this.state.z);
      if (distance < bestDistance) {
        best = spot;
        bestDistance = distance;
      }
    }
    if (best) return best;
    for (const spot of spots) {
      const distance = Math.hypot(spot.x - this.state.x, spot.z - this.state.z);
      if (distance < bestDistance) {
        best = spot;
        bestDistance = distance;
      }
    }
    return best;
  }

  private chooseTransferStop(gates: readonly GateState[]): LfSpot | null {
    const from = nearestTapeNode(this.state.x, this.state.z);
    let best: LfSpot | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const stop of TRANSFER_STOPS) {
      if (pathCrossesClosedGate(pathFor(from, stop.node), gates)) continue;
      const distance = Math.hypot(stop.x - this.state.x, stop.z - this.state.z);
      if (distance < bestDistance) {
        best = stop;
        bestDistance = distance;
      }
    }
    return best ?? TRANSFER_STOPS[0];
  }

  private nearestTransferStopTo(object: SimObject, gates: readonly GateState[]): LfSpot | null {
    const from = nearestTapeNode(this.state.x, this.state.z);
    const reachable = TRANSFER_STOPS.filter(
      (stop) => !pathCrossesClosedGate(pathFor(from, stop.node), gates),
    );
    const pool = reachable.length > 0 ? reachable : TRANSFER_STOPS;
    let best: LfSpot | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const stop of pool) {
      const distance = Math.hypot(stop.x - object.x, stop.z - object.z);
      if (distance < bestDistance) {
        best = stop;
        bestDistance = distance;
      }
    }
    return best;
  }

  private startAction(action: RouteAction, spot: LfSpot, objectId: string | null): void {
    this.action = action;
    this.targetSpot = spot;
    this.targetObjectId = objectId;
    this.state.task = taskFor(action);
    const from = nearestTapeNode(this.state.x, this.state.z);
    this.route = pathFor(from, spot.node);
    this.routeIndex = 0;
    this.routeT = 0;
  }

  private followRoute(dt: number, gates: readonly GateState[]): boolean {
    if (this.route.length === 0) return true;

    this.projectRoute();

    const last = this.route[this.route.length - 1];
    const remaining = Math.hypot(last.x - this.state.x, last.z - this.state.z);
    if (this.routeIndex >= this.route.length - 2 && remaining < ARRIVE) {
      return true;
    }

    const aim = this.lookaheadPoint();
    const desired = Math.atan2(aim.z - this.state.z, aim.x - this.state.x);
    const diff = normalizeAngle(desired - this.state.yaw);
    this.state.yaw = normalizeAngle(
      this.state.yaw + clamp(diff, -TURN_RATE * dt, TURN_RATE * dt),
    );
    const alignment = Math.max(0, Math.cos(normalizeAngle(desired - this.state.yaw)));
    const speed = this.state.speed * (0.35 + 0.65 * alignment);
    const nextX = clamp(this.state.x + Math.cos(this.state.yaw) * speed * dt, MIN_X, MAX_X);
    const nextZ = clamp(this.state.z + Math.sin(this.state.yaw) * speed * dt, MIN_Z, MAX_Z);

    if (this.blockedByGate(nextX, nextZ, gates)) {
      this.state.waiting = true;
      return false;
    }

    this.state.x = nextX;
    this.state.z = nextZ;
    return false;
  }

  /** Proyeksikan posisi ke polyline rute; hanya boleh maju, tidak mundur. */
  private projectRoute(): void {
    if (this.route.length < 2) {
      this.routeIndex = 0;
      this.routeT = 0;
      return;
    }
    const start = Math.min(this.routeIndex, this.route.length - 2);
    let bestIndex = start;
    let bestT = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = start; i < this.route.length - 1; i += 1) {
      const a = this.route[i];
      const b = this.route[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const lengthSq = dx * dx + dz * dz;
      const t =
        lengthSq > 0
          ? clamp(
              ((this.state.x - a.x) * dx + (this.state.z - a.z) * dz) / lengthSq,
              0,
              1,
            )
          : 0;
      const distance = Math.hypot(
        this.state.x - (a.x + dx * t),
        this.state.z - (a.z + dz * t),
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
        bestT = t;
      }
    }
    this.routeIndex = bestIndex;
    this.routeT = bestT;
  }

  private lookaheadPoint(): Point {
    const route = this.route;
    const start = route[this.routeIndex];
    const next = route[this.routeIndex + 1] ?? start;
    let cursor: Point = {
      x: start.x + (next.x - start.x) * this.routeT,
      z: start.z + (next.z - start.z) * this.routeT,
    };
    let remaining = LOOKAHEAD;
    for (let i = this.routeIndex + 1; i < route.length; i += 1) {
      const point = route[i];
      const distance = Math.hypot(point.x - cursor.x, point.z - cursor.z);
      if (distance >= remaining) {
        const t = remaining / distance;
        return {
          x: cursor.x + (point.x - cursor.x) * t,
          z: cursor.z + (point.z - cursor.z) * t,
        };
      }
      remaining -= distance;
      cursor = point;
    }
    return route[route.length - 1];
  }

  private blockedByGate(x: number, z: number, gates: readonly GateState[]): boolean {
    for (const gate of gates) {
      if (gate.open) continue;
      const placement = GATE_PLACES[gate.id];
      const pad = HALF + 0.02;
      const inside =
        x >= placement.x - pad &&
        x <= placement.x + placement.w + pad &&
        z >= placement.z - pad &&
        z <= placement.z + placement.d + pad;
      if (!inside) continue;
      const wasInside =
        this.state.x >= placement.x - pad &&
        this.state.x <= placement.x + placement.w + pad &&
        this.state.z >= placement.z - pad &&
        this.state.z <= placement.z + placement.d + pad;
      const centerX = placement.x + placement.w / 2;
      const centerZ = placement.z + placement.d / 2;
      const closer =
        Math.hypot(x - centerX, z - centerZ) <
        Math.hypot(this.state.x - centerX, this.state.z - centerZ);
      if (!wasInside || closer) return true;
    }
    return false;
  }

  private completeAction(objects: SimObject[]): void {
    const action = this.action;
    const spot = this.targetSpot;
    if (!action || !spot) {
      this.action = null;
      this.state.task = 'idle';
      return;
    }

    if (action === 'pick') {
      const object = objects.find((entry) => entry.id === this.targetObjectId);
      if (
        object &&
        !object.carrier &&
        Math.hypot(object.x - this.state.x, object.z - this.state.z) <= PICK_DISTANCE
      ) {
        object.carrier = 'lineFollower';
        object.carriedFrom = { x: object.x, z: object.z };
        object.y = 0.02;
        this.state.carryId = object.id;
      }
    } else if (action === 'transfer') {
      this.releaseAtTransfer(objects, spot);
    } else if (action === 'dropLex') {
      const object = this.carriedObject(objects);
      if (object) {
        object.carrier = null;
        object.carriedFrom = null;
        object.x = spot.x;
        object.z = spot.z;
        object.y = 0;
      }
      this.state.carryId = null;
    } else {
      this.state.task = 'done';
    }

    this.action = null;
    this.targetSpot = null;
    this.targetObjectId = null;
    this.route = [];
    this.routeIndex = 0;
    this.routeT = 0;
    if (this.state.task !== 'done') {
      this.state.task = 'idle';
    }
  }

  private releaseAtTransfer(objects: SimObject[], spot: LfSpot): void {
    const object = this.carriedObject(objects);
    if (!object) {
      this.state.carryId = null;
      return;
    }
    const index = TRANSFER_STOPS.findIndex((stop) => stop.node === spot.node);
    const zone = TRANSFER_ZONES[index >= 0 ? index : 0];
    if (!zone) {
      this.state.carryId = null;
      return;
    }
    const slot = objects.filter(
      (entry) =>
        entry.id !== object.id && !entry.carrier && insideRect(entry.x, entry.z, zone),
    ).length;
    object.carrier = null;
    object.carriedFrom = null;
    object.x = zone.x + zone.w / 2 + (slot === 0 ? -0.1 : 0.1);
    object.z = zone.z + 0.04;
    object.y = 0;
    this.state.carryId = null;
  }
}
