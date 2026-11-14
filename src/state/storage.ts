export interface CameraSnapshot {
  azimuth: number;
  polar: number;
  radius: number;
  target: [number, number, number];
}

export interface BestScores {
  free: number;
  qualifying: number;
}

const CAMERA_KEY = 'jrcsim.camera.v1';
const BEST_KEY = 'jrcsim.best.v1';

export function loadBestScores(): BestScores {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (!raw) {
      return { free: 0, qualifying: 0 };
    }
    const parsed = JSON.parse(raw) as Partial<BestScores>;
    return {
      free: typeof parsed.free === 'number' && Number.isFinite(parsed.free) ? parsed.free : 0,
      qualifying:
        typeof parsed.qualifying === 'number' && Number.isFinite(parsed.qualifying)
          ? parsed.qualifying
          : 0,
    };
  } catch {
    return { free: 0, qualifying: 0 };
  }
}

export function saveBestScore(mode: 'free' | 'qualifying', score: number): BestScores {
  const best = loadBestScores();
  const next: BestScores = {
    ...best,
    [mode]: Math.max(best[mode], score),
  };
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(next));
  } catch {
    // Abaikan kegagalan penyimpanan agar sesi tetap bisa dimainkan.
  }
  return next;
}

export function loadCameraSnapshot(): CameraSnapshot | null {
  try {
    const raw = localStorage.getItem(CAMERA_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<CameraSnapshot>;
    if (
      typeof parsed.azimuth !== 'number' ||
      typeof parsed.polar !== 'number' ||
      typeof parsed.radius !== 'number' ||
      !Array.isArray(parsed.target) ||
      parsed.target.length !== 3
    ) {
      return null;
    }
    const values = [parsed.azimuth, parsed.polar, parsed.radius, ...parsed.target];
    if (!values.every((value) => Number.isFinite(value))) {
      return null;
    }
    return {
      azimuth: parsed.azimuth,
      polar: parsed.polar,
      radius: parsed.radius,
      target: [parsed.target[0], parsed.target[1], parsed.target[2]],
    };
  } catch {
    return null;
  }
}

export function saveCameraSnapshot(snapshot: CameraSnapshot): void {
  try {
    localStorage.setItem(CAMERA_KEY, JSON.stringify(snapshot));
  } catch {
    // Penyimpanan lokal bisa diblokir; abaikan agar permainan tetap berjalan.
  }
}
