export interface Rect {
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface Point {
  x: number;
  z: number;
}

export interface Area extends Rect {
  label: string;
  color: number;
  text: string;
}

/**
 * Koordinat memakai sistem arena: x 0..6 (panjang), z 0..4 (lebar),
 * origin di sudut kiri-atas denah. Nilai di bawah diukur dari
 * "Track Banner LF (2,53m x 2,468m)" tim merah dan denah Full Track 6x4 m.
 */
export const ZONES = {
  startTransporter: { x: 0.08, z: 0.62, w: 0.35, d: 0.35 },
  startLineFollower: { x: 0.01, z: 3.339, w: 0.239, d: 0.24 },
  finish: { x: 1.775, z: 1.999, w: 0.349, d: 0.549 },
  pickLex: { x: 1.78, z: 0.02, w: 0.2, d: 0.2 },
  dropLateres: { x: 0.55, z: 0.02, w: 0.2, d: 0.2 },
  transfer: { x: 0.77, z: 1.112, w: 0.4, d: 0.148 },
  transferRight: { x: 2.14, z: 1.112, w: 0.4, d: 0.148 },
} as const satisfies Record<string, Rect>;

/** Pick Zone LATERES 8x8 cm (kotak merah pada banner LF). */
export const LATERES_PICK_ZONES: readonly Rect[] = [
  { x: 0.31, z: 1.28, w: 0.08, d: 0.08 },
  { x: 1.01, z: 2.69, w: 0.08, d: 0.08 },
  { x: 1.66, z: 2.27, w: 0.08, d: 0.08 },
  { x: 2.18, z: 2.27, w: 0.08, d: 0.08 },
];

/** Drop Zone LEX 8x8 cm (kotak hijau pada banner LF). */
export const LEX_DROP_ZONES: readonly Rect[] = [
  { x: 1.236, z: 3.214, w: 0.08, d: 0.08 },
  { x: 1.7, z: 3.5, w: 0.08, d: 0.08 },
];

export const TRANSFER_ZONES: readonly Rect[] = [ZONES.transfer, ZONES.transferRight];

export const SCORE_ZONES = {
  transfer: TRANSFER_ZONES,
  dropLex: LEX_DROP_ZONES,
  dropLateres: [ZONES.dropLateres] as readonly Rect[],
  finish: ZONES.finish,
};

export const AREAS = {
  a: { x: 0, z: 0, w: 2.54, d: 1.11, label: 'AREA A', color: 0x2f7fe0, text: '#7fc0ff' },
  c: { x: 2.54, z: 0, w: 0.93, d: 4, label: 'AREA C', color: 0x2fbf7f, text: '#79e5b0' },
  b: { x: 0, z: 1.11, w: 2.54, d: 2.47, label: 'AREA B', color: 0xe0a52f, text: '#ffd27a' },
} as const satisfies Record<string, Area>;

export const START_POSES = {
  transporter: { x: 0.255, z: 0.795, yaw: 0 },
  lineFollower: { x: 0.1295, z: 3.459, yaw: -Math.PI / 2 },
} as const;

export const SPAWNS = {
  lex: [
    { x: 0.97, z: 1.186 },
    { x: 2.34, z: 1.186 },
  ],
  lateres: [
    { x: 0.35, z: 1.32 },
    { x: 1.05, z: 2.73 },
    { x: 1.7, z: 2.31 },
    { x: 2.22, z: 2.31 },
  ],
} as const;

export const BUMPS: Rect[] = [
  { x: 1.05, z: 0.6, w: 0.45, d: 0.02 },
  { x: 1.05, z: 0.64, w: 0.45, d: 0.02 },
  { x: 1.05, z: 0.68, w: 0.45, d: 0.02 },
  { x: 1.05, z: 0.72, w: 0.45, d: 0.02 },
];

export const GATE_PLACES = {
  catarata1: { x: 1.83, z: 2.69, w: 0.24, d: 0.04, hingeSide: 'lowX' },
  catarata2: { x: 2.28, z: 1.88, w: 0.24, d: 0.04, hingeSide: 'lowX' },
} as const;

/**
 * Jaringan garis hitam pada banner LF, dalam koordinat denah. Node adalah
 * persimpangan/ujung pita, edge adalah segmen pita yang dapat dilalui.
 */
export const LF_TAPE = {
  nodes: {
    start: { x: 0.1295, z: 3.459 },
    startExit: { x: 0.134, z: 3.339 },
    a: { x: 0.134, z: 3.029 },
    b: { x: 0.59, z: 3.029 },
    c: { x: 1.081, z: 3.029 },
    green1Nook: { x: 1.122, z: 3.029 },
    green1Spur: { x: 1.122, z: 3.229 },
    green1Spot: { x: 1.276, z: 3.254 },
    bDown: { x: 0.59, z: 3.377 },
    bottomMid: { x: 1.742, z: 3.378 },
    green2Spur: { x: 1.743, z: 3.488 },
    green2Spot: { x: 1.74, z: 3.54 },
    bottomRight: { x: 1.948, z: 3.378 },
    gate1: { x: 1.949, z: 2.71 },
    stemTop: { x: 1.949, z: 2.559 },
    finish: { x: 1.9495, z: 2.2735 },
    j1: { x: 0.134, z: 2.73 },
    j2: { x: 0.594, z: 2.733 },
    red2Spur: { x: 1.003, z: 2.729 },
    red2Spot: { x: 1.05, z: 2.73 },
    l1: { x: 0.134, z: 2.351 },
    r1: { x: 0.582, z: 2.349 },
    l2: { x: 0.134, z: 2.176 },
    e1: { x: 0.581, z: 1.951 },
    e2: { x: 1.052, z: 1.949 },
    e2s: { x: 1.053, z: 2.188 },
    l3: { x: 0.134, z: 1.698 },
    l4: { x: 0.134, z: 1.321 },
    red1Spur: { x: 0.299, z: 1.319 },
    red1Spot: { x: 0.35, z: 1.32 },
    t1: { x: 0.967, z: 1.699 },
    u1n: { x: 0.967, z: 1.474 },
    ulb: { x: 0.867, z: 1.473 },
    urb: { x: 1.067, z: 1.473 },
    ult: { x: 0.867, z: 1.263 },
    urt: { x: 1.067, z: 1.263 },
    transferLeft: { x: 0.967, z: 1.258 },
    v0s: { x: 1.205, z: 1.698 },
    v0: { x: 1.206, z: 1.309 },
    v1n: { x: 1.519, z: 1.309 },
    m1: { x: 1.519, z: 1.559 },
    m1s: { x: 1.519, z: 2.308 },
    red3Spur: { x: 1.649, z: 2.309 },
    red3Spot: { x: 1.7, z: 2.31 },
    m2: { x: 2.239, z: 1.559 },
    m2n: { x: 2.24, z: 1.263 },
    m3: { x: 2.399, z: 1.559 },
    m3s: { x: 2.399, z: 2.307 },
    red4Spur: { x: 2.268, z: 2.309 },
    red4Spot: { x: 2.22, z: 2.31 },
    m4n: { x: 2.442, z: 1.263 },
    transferRight: { x: 2.342, z: 1.258 },
  },
  edges: [
    ['start', 'startExit'],
    ['startExit', 'a'],
    ['a', 'b'],
    ['a', 'j1'],
    ['b', 'c'],
    ['b', 'bDown'],
    ['b', 'j2'],
    ['c', 'green1Nook'],
    ['c', 'j2'],
    ['green1Nook', 'green1Spur'],
    ['green1Spur', 'green1Spot'],
    ['bDown', 'bottomMid'],
    ['bottomMid', 'green2Spur'],
    ['green2Spur', 'green2Spot'],
    ['bottomMid', 'bottomRight'],
    ['bottomRight', 'gate1'],
    ['gate1', 'stemTop'],
    ['stemTop', 'finish'],
    ['j1', 'j2'],
    ['j1', 'l1'],
    ['j2', 'red2Spur'],
    ['red2Spur', 'red2Spot'],
    ['l1', 'r1'],
    ['l1', 'l2'],
    ['l2', 'e1'],
    ['l2', 'l3'],
    ['l3', 'l4'],
    ['l3', 't1'],
    ['l4', 'red1Spur'],
    ['red1Spur', 'red1Spot'],
    ['r1', 'e1'],
    ['e1', 'e2'],
    ['e1', 'e2s'],
    ['e2', 'e2s'],
    ['t1', 'u1n'],
    ['t1', 'v0s'],
    ['u1n', 'ulb'],
    ['u1n', 'urb'],
    ['ulb', 'ult'],
    ['urb', 'urt'],
    ['ult', 'transferLeft'],
    ['urt', 'transferLeft'],
    ['v0s', 'v0'],
    ['v0', 'v1n'],
    ['v1n', 'm1'],
    ['m1', 'm1s'],
    ['m1', 'm2'],
    ['m1s', 'red3Spur'],
    ['red3Spur', 'red3Spot'],
    ['m2', 'm2n'],
    ['m2', 'm3'],
    ['m3', 'm3s'],
    ['m3', 'm4n'],
    ['m3s', 'red4Spur'],
    ['red4Spur', 'red4Spot'],
    ['m2n', 'transferRight'],
    ['m4n', 'transferRight'],
  ] as const satisfies readonly (readonly [string, string])[],
} as const;

export type LfTapeNode = keyof typeof LF_TAPE.nodes;

export interface LfSpot {
  node: LfTapeNode;
  x: number;
  z: number;
}

export const LATERES_SPOTS: readonly LfSpot[] = [
  { node: 'red1Spot', x: 0.35, z: 1.32 },
  { node: 'red2Spot', x: 1.05, z: 2.73 },
  { node: 'red3Spot', x: 1.7, z: 2.31 },
  { node: 'red4Spot', x: 2.22, z: 2.31 },
];

export const LEX_DROP_SPOTS: readonly LfSpot[] = [
  { node: 'green1Spot', x: 1.276, z: 3.254 },
  { node: 'green2Spot', x: 1.74, z: 3.54 },
];

export const TRANSFER_STOPS: readonly LfSpot[] = [
  { node: 'transferLeft', x: 0.967, z: 1.258 },
  { node: 'transferRight', x: 2.342, z: 1.258 },
];

export const LF_FINISH_STOP: LfSpot = { node: 'finish', x: 1.9495, z: 2.2735 };
