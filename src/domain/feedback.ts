export type FeedbackKind =
  | 'correct'
  | 'slow_correct'
  | 'depth_confusion'
  | 'wrong'
  | 'mix_acceptable';

type FeedbackOptions = {
  feedbackSounds: boolean;
  feedbackVibration: boolean;
};

type NoteSequence = {
  notes: Array<{ freq: number; startMs: number; durationMs: number }>;
  type: OscillatorType;
  gain: number;
};

const SOUND_CONFIG: Record<FeedbackKind, NoteSequence | null> = {
  correct: {
    notes: [
      { freq: 523.25, startMs: 0, durationMs: 80 },
      { freq: 659.25, startMs: 60, durationMs: 80 },
      { freq: 783.99, startMs: 120, durationMs: 160 },
    ],
    type: 'sine',
    gain: 0.12,
  },
  slow_correct: {
    notes: [
      { freq: 523.25, startMs: 0, durationMs: 100 },
      { freq: 659.25, startMs: 80, durationMs: 120 },
    ],
    type: 'sine',
    gain: 0.08,
  },
  depth_confusion: {
    notes: [
      { freq: 440, startMs: 0, durationMs: 120 },
      { freq: 370, startMs: 100, durationMs: 120 },
      { freq: 440, startMs: 220, durationMs: 150 },
    ],
    type: 'triangle',
    gain: 0.10,
  },
  wrong: {
    notes: [
      { freq: 311, startMs: 0, durationMs: 150 },
      { freq: 277, startMs: 130, durationMs: 200 },
    ],
    type: 'sine',
    gain: 0.10,
  },
  mix_acceptable: null,
};

const VIBRATE_CONFIG: Record<FeedbackKind, number[] | null> = {
  correct: [25],
  slow_correct: [25],
  depth_confusion: [30, 80, 30],
  wrong: [150],
  mix_acceptable: null,
};

let audioCtx: AudioContext | null = null;
let audioUnlocked = false;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Must be called DIRECTLY inside a user gesture (click/touchend handler).
 * Unlocks AudioContext on iOS and plays the sound immediately.
 */
export function triggerFeedback(kind: FeedbackKind, options: FeedbackOptions) {
  // Unlock audio on first interaction (iOS requirement)
  if (options.feedbackSounds) {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    if (!audioUnlocked) {
      // Play a silent buffer to unlock iOS audio
      const silentBuffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(ctx.destination);
      source.start(0);
      audioUnlocked = true;
    }
    playChord(kind, ctx);
  }

  if (options.feedbackVibration) {
    vibrate(kind);
  }
}

function playChord(kind: FeedbackKind, ctx: AudioContext) {
  const config = SOUND_CONFIG[kind];
  if (!config) return;

  try {
    for (const note of config.notes) {
      const startTime = ctx.currentTime + note.startMs / 1000;
      const duration = note.durationMs / 1000;

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = config.type;
      osc.frequency.setValueAtTime(note.freq, startTime);

      // Bell-like envelope
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(config.gain, startTime + 0.015);
      gainNode.gain.setValueAtTime(config.gain, startTime + duration * 0.3);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.01);
    }
  } catch {
    // Audio not available
  }
}

function vibrate(kind: FeedbackKind) {
  const pattern = VIBRATE_CONFIG[kind];
  if (!pattern) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration not available
  }
}

export function getFeedbackPanelClass(kind: FeedbackKind): string {
  switch (kind) {
    case 'correct':
    case 'slow_correct':
      return 'border-green-200 bg-green-50/50';
    case 'depth_confusion':
      return 'border-amber-200 bg-amber-50/50';
    case 'wrong':
      return 'border-red-200 bg-red-50/50';
    case 'mix_acceptable':
      return 'border-violet-200 bg-violet-50/50';
    default:
      return 'border-gray-200';
  }
}