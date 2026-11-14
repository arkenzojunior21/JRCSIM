export interface RulesConfig {
  invisibleGateRequiresDropZone: boolean;
  lexValidOverlap: number;
  finishCenterOnly: boolean;
  timePenaltyReducesClock: boolean;
  transferScoresOnce: boolean;
  retryKeepsScoredDropObjects: boolean;
}

export const DEFAULT_RULES: RulesConfig = {
  invisibleGateRequiresDropZone: true,
  lexValidOverlap: 0.25,
  finishCenterOnly: true,
  timePenaltyReducesClock: true,
  transferScoresOnce: true,
  retryKeepsScoredDropObjects: true,
};

export const RULE_DESCRIPTIONS: Record<keyof RulesConfig, string> = {
  invisibleGateRequiresDropZone:
    'Gate invisible terbuka setelah objek sah berada di Drop Zone, bukan hanya di Transfer Zone.',
  lexValidOverlap: 'Persentase luas objek LEX yang harus masuk ke Drop Zone agar dianggap sah.',
  finishCenterOnly: 'Robot dianggap finish jika titik tengahnya berada di dalam zona finish.',
  timePenaltyReducesClock: 'Penalti waktu mengurangi sisa waktu pertandingan, bukan nilai.',
  transferScoresOnce: 'Poin Transfer Zone hanya diberikan sekali per objek.',
  retryKeepsScoredDropObjects:
    'Saat retry, objek yang sudah sah di Drop Zone tetap dipertahankan.',
};
