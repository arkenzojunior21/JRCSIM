import { BUMP, PENALTIES, ROBOT, SCORING } from './constants';
import { circleOverlapsRect, slideAgainstRects } from './collision';
import type { DriveCommand, DriveMode } from './driveModes';
import {
  createGates,
  gateObstacle,
  updateGates,
  type GateId,
  type GatePlacement,
  type GateState,
} from './gates';
import {
  canCapture,
  createGripper,
  gripReach,
  gripperPoint,
  liftHeight,
  updateGripper,
  type GripperState,
} from './gripper';
import { LineFollowerAgent } from './lfAgent';
import { Mission, type GameMode } from './mission';
import {
  centerInside,
  createObject,
  nearestObject,
  overlapRatio,
  type SimObject,
} from './objects';
import { Transporter } from './robot';
import { ScoreTracker, type ScoreBreakdown } from './scoring';
import {
  BUMPS,
  GATE_PLACES,
  LEX_DROP_ZONES,
  SCORE_ZONES,
  SPAWNS,
  START_POSES,
  ZONES,
  type Rect,
} from './trackLayout';

export interface WorldInput {
  command: DriveCommand;
  grip: boolean;
  liftUp: boolean;
  liftDown: boolean;
}

export interface WorldSnapshot {
  phase: string;
  remaining: number;
  countdown: number;
  score: ScoreBreakdown;
  penaltyPoints: number;
  gatesOpen: number;
  lfCarry: string | null;
}

const TRANSPORTER_RADIUS = ROBOT.transporter.footprint * 0.55;

export class World {
  transporter: Transporter;
  readonly gripper: GripperState = createGripper();
  readonly lineFollower: LineFollowerAgent;
  readonly gates: GateState[];
  readonly mission: Mission;
  readonly scoreTracker = new ScoreTracker();
  objects: SimObject[] = [];
  mode: DriveMode = 'tank';
  penaltyPoints = 0;

  private readonly gatePlacements: Record<GateId, GatePlacement>;
  private startPenaltyChecked = false;

  constructor(mode: GameMode = 'free') {
    this.mission = new Mission(mode);
    this.transporter = new Transporter(
      START_POSES.transporter.x,
      START_POSES.transporter.z,
      START_POSES.transporter.yaw,
    );
    this.lineFollower = new LineFollowerAgent(
      START_POSES.lineFollower.x,
      START_POSES.lineFollower.z,
      START_POSES.lineFollower.yaw,
    );
    this.gatePlacements = GATE_PLACES as Record<GateId, GatePlacement>;
    this.gates = createGates(this.gatePlacements);
    this.spawnObjects();
  }

  reset(mode: GameMode = this.mission.mode): void {
    this.mission.setMode(mode);
    this.scoreTracker.reset();
    this.penaltyPoints = 0;
    this.startPenaltyChecked = false;
    this.transporter.reset(
      START_POSES.transporter.x,
      START_POSES.transporter.z,
      START_POSES.transporter.yaw,
    );
    this.lineFollower.reset(
      START_POSES.lineFollower.x,
      START_POSES.lineFollower.z,
      START_POSES.lineFollower.yaw,
    );
    this.gates.splice(0, this.gates.length, ...createGates(this.gatePlacements));
    this.gripper.closed = false;
    this.gripper.lift = 0;
    this.spawnObjects();
  }

  start(): void {
    this.mission.start();
    this.lineFollower.state.running = true;
  }

  retry(): void {
    this.transporter.reset(
      START_POSES.transporter.x,
      START_POSES.transporter.z,
      START_POSES.transporter.yaw,
    );
    this.lineFollower.reset(
      START_POSES.lineFollower.x,
      START_POSES.lineFollower.z,
      START_POSES.lineFollower.yaw,
    );
    this.gates.splice(0, this.gates.length, ...createGates(this.gatePlacements));
    this.gripper.closed = false;
    this.gripper.lift = 0;
    this.restoreObjectsForRetry();
    this.mission.retry();
    this.lineFollower.state.running = true;
    this.startPenaltyChecked = false;
  }

  update(dt: number, input: WorldInput): void {
    this.mission.update(dt, this.objectiveComplete);
    const running = this.mission.isRunning;

    if (running) {
      this.transporter.update(dt, input.command, this.mode);
      this.resolveTransporterCollision();
      this.applyBumps();
    }

    updateGripper(
      this.gripper,
      { grip: input.grip, up: input.liftUp, down: input.liftDown },
      dt,
    );

    if (running) {
      this.updateCarriedObject();
      this.updateTransporterPickup();
      updateGates(this.gates, this.gatePlacements, this.transporter.state, this.gripper, dt);
      this.lineFollower.update(dt, this.objects, this.gates);
    }

    this.updateObjectPositions();
    this.scoreTracker.update(this.objects, SCORE_ZONES, this.bothRobotsFinished);

    if (this.mission.phase === 'RUNNING' && !this.startPenaltyChecked) {
      this.startPenaltyChecked = true;
      if (!this.transporterInsideStart()) {
        this.penaltyPoints += PENALTIES.outOfStartZonePoints;
      }
    }
  }

  get bothRobotsFinished(): boolean {
    const finish = ZONES.finish;
    const transporterInside =
      this.transporter.state.x >= finish.x &&
      this.transporter.state.x <= finish.x + finish.w &&
      this.transporter.state.z >= finish.z &&
      this.transporter.state.z <= finish.z + finish.d;
    const followerInside =
      this.lineFollower.state.x >= finish.x &&
      this.lineFollower.state.x <= finish.x + finish.w &&
      this.lineFollower.state.z >= finish.z &&
      this.lineFollower.state.z <= finish.z + finish.d;
    return transporterInside && followerInside;
  }

  get objectiveComplete(): boolean {
    if (!this.bothRobotsFinished) {
      return false;
    }
    const lexOk = this.objects
      .filter((object) => object.kind === 'LEX')
      .every((object) => !object.carrier && this.isObjectScored(object));
    const lateresOk = this.objects
      .filter((object) => object.kind === 'LATERES')
      .every((object) => !object.carrier && centerInside(object, ZONES.dropLateres));
    return lexOk && lateresOk;
  }

  get snapshot(): WorldSnapshot {
    return {
      phase: this.mission.phase,
      remaining: this.mission.remaining,
      countdown: this.mission.countdown,
      score: this.scoreTracker.breakdown,
      penaltyPoints: this.penaltyPoints,
      gatesOpen: this.gates.filter((gate) => gate.open).length,
      lfCarry: this.lineFollower.state.carryId,
    };
  }

  setLfSpeed(speed: number): void {
    this.lineFollower.setSpeed(speed);
  }

  toggleLfRunning(): void {
    this.lineFollower.toggleRunning();
  }

  private spawnObjects(): void {
    const objects: SimObject[] = [];
    SPAWNS.lex.forEach((point, index) => {
      objects.push(createObject(`LEX-${index + 1}`, 'LEX', point.x, point.z));
    });
    const lateresSpawns = SPAWNS.lateres;
    lateresSpawns.forEach((point, index) => {
      objects.push(createObject(`LATERES-${index + 1}`, 'LATERES', point.x, point.z));
    });
    this.objects = objects;
  }

  private restoreObjectsForRetry(): void {
    for (const object of this.objects) {
      if (this.isObjectScored(object)) {
        continue;
      }
      object.carrier = null;
      object.x = object.homeX;
      object.z = object.homeZ;
      object.y = 0;
    }
  }

  private isObjectScored(object: SimObject): boolean {
    if (object.kind === 'LEX') {
      return LEX_DROP_ZONES.some(
        (zone) => overlapRatio(object, zone) >= SCORING.lexValidOverlap,
      );
    }
    return centerInside(object, ZONES.dropLateres);
  }

  private resolveTransporterCollision(): void {
    const rects: Rect[] = [];
    for (const gate of this.gates) {
      const obstacle = gateObstacle(gate, this.gatePlacements[gate.id]);
      if (obstacle) {
        rects.push(obstacle);
      }
    }
    if (rects.length === 0) {
      return;
    }
    const result = slideAgainstRects(
      this.transporter.state.x,
      this.transporter.state.z,
      TRANSPORTER_RADIUS,
      this.transporter.state.vx,
      this.transporter.state.vz,
      rects,
    );
    this.transporter.state.x = result.x;
    this.transporter.state.z = result.z;
    this.transporter.state.vx = result.vx;
    this.transporter.state.vz = result.vz;
  }

  private applyBumps(): void {
    const { x, z } = this.transporter.state;
    const overBump = BUMPS.some((bump) =>
      circleOverlapsRect(x, z, TRANSPORTER_RADIUS, {
        x: bump.x - BUMP.gap / 2,
        z: bump.z,
        w: bump.w + BUMP.gap,
        d: bump.d,
      }),
    );
    if (overBump) {
      this.transporter.state.vx *= 0.55;
      this.transporter.state.vz *= 0.55;
    }
  }

  private updateTransporterPickup(): void {
    const carried = this.objects.find((object) => object.carrier === 'transporter');
    const point = gripperPoint(
      this.transporter.state.x,
      this.transporter.state.z,
      this.transporter.state.yaw,
    );

    if (carried) {
      if (!this.gripper.closed) {
        carried.carrier = null;
        carried.x = point.x;
        carried.z = point.z;
        carried.y = 0;
      }
      return;
    }

    if (!canCapture(this.gripper)) {
      return;
    }

    const candidate = nearestObject(
      this.objects,
      point.x,
      point.z,
      (object) => !object.carrier,
      gripReach(),
    );
    if (candidate) {
      candidate.carrier = 'transporter';
      candidate.y = liftHeight(this.gripper);
    }
  }

  private updateCarriedObject(): void {
    const carried = this.objects.find((object) => object.carrier === 'transporter');
    if (!carried) {
      return;
    }
    const point = gripperPoint(
      this.transporter.state.x,
      this.transporter.state.z,
      this.transporter.state.yaw,
    );
    carried.x = point.x;
    carried.z = point.z;
    carried.y = liftHeight(this.gripper);
  }

  private updateObjectPositions(): void {
    for (const object of this.objects) {
      if (object.carrier === 'lineFollower') {
        const agent = this.lineFollower.state;
        object.x = agent.x + Math.cos(agent.yaw) * 0.16;
        object.z = agent.z + Math.sin(agent.yaw) * 0.16;
        object.y = 0.02;
      }
    }
  }

  private transporterInsideStart(): boolean {
    const start = ZONES.startTransporter;
    const x = this.transporter.state.x;
    const z = this.transporter.state.z;
    return (
      x >= start.x &&
      x <= start.x + start.w &&
      z >= start.z &&
      z <= start.z + start.d
    );
  }
}
