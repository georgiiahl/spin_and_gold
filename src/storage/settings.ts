export type AppSettings = {
  flashDurationSec: number;
  fastResponseMs: number;
  slowResponseMs: number;
  showFrequenciesInFeedback: boolean;
  includeTrashHandsInTraining: boolean;
  focusOnMixedHands: boolean;
  mixStrategy: 'strict' | 'tolerant';
  mixThreshold: number;
  feedbackSounds: boolean;
  feedbackVibration: boolean;
  sessionMode: 'until_done' | 'timed' | 'cards';
  sessionTimeLimitMin: number;
  sessionCardLimit: number;
};

const SETTINGS_KEY = 'spin-gold-settings-v1';

export const DEFAULT_SETTINGS: AppSettings = {
  flashDurationSec: 2,
  fastResponseMs: 2000,
  slowResponseMs: 8000,
  showFrequenciesInFeedback: true,
  includeTrashHandsInTraining: true,
  focusOnMixedHands: false,
  mixStrategy: 'strict',
  mixThreshold: 0.65,
  feedbackSounds: true,
  feedbackVibration: true,
  sessionMode: 'until_done',
  sessionTimeLimitMin: 20,
  sessionCardLimit: 100,
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
