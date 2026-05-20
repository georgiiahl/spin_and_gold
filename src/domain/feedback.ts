import { AppSettings } from '@/storage/settings';

export type FeedbackKind = 'correct' | 'slow_correct' | 'depth_confusion' | 'wrong' | 'mix_acceptable';

type FeedbackConfig = {
  vibrate: number[];
  oscillator?: OscillatorType;
  frequencyHz?: number;
  durationMs?: number;
  gain?: number;
  panelClassName: string;
};

const FEEDBACK_CONFIG: Record<FeedbackKind, FeedbackConfig> = {
  correct: {
    vibrate: [25],
    oscillator: 'sine',
    frequencyHz: 440,
    durationMs: 80,
    gain: 0.18,
    panelClassName: 'bg-emerald-500/20 border-emerald-300',
  },
  slow_correct: {
    vibrate: [25],
    oscillator: 'sine',
    frequencyHz: 440,
    durationMs: 80,
    gain: 0.045,
    panelClassName: 'bg-emerald-500/10 border-emerald-200',
  },
  depth_confusion: {
    vibrate: [25, 80, 25],
    oscillator: 'triangle',
    frequencyHz: 220,
    durationMs: 120,
    gain: 0.2,
    panelClassName: 'bg-amber-500/20 border-amber-300',
  },
  wrong: {
    vibrate: [120],
    oscillator: 'sawtooth',
    frequencyHz: 150,
    durationMs: 150,
    gain: 0.2,
    panelClassName: 'bg-red-500/20 border-red-300',
  },
  mix_acceptable: {
    vibrate: [],
    panelClassName: 'bg-violet-500/10 border-violet-200',
  },
};

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!window.AudioContext && !(window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) {
    return null;
  }
  if (!audioContext) {
    const Ctx = window.AudioContext
      ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    audioContext = Ctx ? new Ctx() : null;
  }
  return audioContext;
}

function playTone(kind: FeedbackKind): void {
  const config = FEEDBACK_CONFIG[kind];
  if (!config.oscillator || !config.frequencyHz || !config.durationMs || !config.gain) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  const durationSec = config.durationMs / 1000;

  osc.type = config.oscillator;
  osc.frequency.setValueAtTime(config.frequencyHz, now);

  gain.gain.setValueAtTime(config.gain, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + durationSec);
}

function triggerVibration(kind: FeedbackKind): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  const pattern = FEEDBACK_CONFIG[kind].vibrate;
  if (pattern.length > 0) {
    navigator.vibrate(pattern);
  }
}

export function getFeedbackPanelClass(kind: FeedbackKind): string {
  return FEEDBACK_CONFIG[kind].panelClassName;
}

export function triggerFeedback(kind: FeedbackKind, settings: Pick<AppSettings, 'feedbackSounds' | 'feedbackVibration'>): void {
  if (typeof document !== 'undefined') {
    const className = `feedback-flash-${kind}`;
    document.body.classList.add(className);
    window.setTimeout(() => document.body.classList.remove(className), 250);
  }
  if (settings.feedbackVibration) {
    triggerVibration(kind);
  }
  if (settings.feedbackSounds) {
    playTone(kind);
  }
}
