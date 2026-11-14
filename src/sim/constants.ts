export const ARENA = {
  lengthX: 6.0,
  widthZ: 4.0,
  wallThickness: 0.008,
  wallHeight: 0.1,
} as const;

export const ROBOT = {
  transporter: {
    footprint: 0.35,
    maxSpeed: 0.9,
    accel: 1.2,
    turnRate: 2.6,
    track: 0.28,
  },
  lineFollower: {
    footprint: 0.25,
    defaultSpeed: 0.32,
    minSpeed: 0.05,
    maxSpeed: 0.5,
  },
} as const;

export const OBJECTS = {
  lex: { width: 0.053, depth: 0.053, height: 0.05, mass: 0.04, count: 2 },
  lateres: { width: 0.052, depth: 0.052, height: 0.05, mass: 0.04, count: 4 },
  aqvae: { width: 0.1, depth: 0.1, height: 0.178, mass: 0.1, count: 0 },
} as const;

export const MATCH = {
  setupSeconds: 60,
  durationSeconds: 240,
  countdownSeconds: 3,
  fixedDt: 1 / 60,
} as const;

export const SCORING = {
  lex: 15,
  lateres: 15,
  finish: 10,
  transferPlacement: 5,
  totalPenyisihan: 130,
  battleExtraAqvae: 30,
  lexValidOverlap: 0.25,
} as const;

export const PENALTIES = {
  startEarlySeconds: 5,
  invalidRetrySeconds: 5,
  outOfStartZonePoints: 5,
  earlyGatePoints: 15,
  touchPoints: 5,
} as const;

export const GATES = {
  gripTab: 0.062,
  openAngleDeg: 70,
  catarata1: { width: 0.075, thickness: 0.04, height: 0.4 },
  catarata2: { width: 0.075, thickness: 0.04, height: 0.24 },
} as const;

export const BUMP = {
  height: 0.02,
  gap: 0.03,
  lengths: [0.4, 0.45],
} as const;
