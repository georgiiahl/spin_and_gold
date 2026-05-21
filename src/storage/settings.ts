export type AppSettings = {
  flashDurationSec: number;
  fastResponseMs: number;
  slowResponseMs: number;
  showFrequenciesInFeedback: boolean;
  includeTrashHandsInTraining: boolean;
  focusOnMixedHands: boolean;
  showMixButton: boolean;
  mixStrategy: 'strict' | 'tolerant';
  mixThreshold: number;
  desiredRetention: number;
  retryMinDelaySec: number;
  sameSpotCooldown: number;
  feedbackSounds: boolean;
  feedbackVibration: boolean;
};

const SETTINGS_KEY = 'spin-gold-settings-v1';

export const DEFAULT_SETTINGS: AppSettings = {
  flashDurationSec: 2,
  fastResponseMs: 1200,
  slowResponseMs: 3500,
  showFrequenciesInFeedback: true,
  includeTrashHandsInTraining: false,
  focusOnMixedHands: false,
  showMixButton: false,
  mixStrategy: 'strict',
  mixThreshold: 0.60,
  desiredRetention: 0.9,
  retryMinDelaySec: 60,
  sameSpotCooldown: 5,
  feedbackSounds: true,
  feedbackVibration: true,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(next: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}
