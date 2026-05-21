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

// Duolingo-style cheerful sounds using chord progressions
const SOUND_CONFIG: Record<FeedbackKind, NoteSequence | null> = {
  correct: {
    notes: [
      { freq: 523.25, startMs: 0, durationMs: 80 },    // C5
      { freq: 659.25, startMs: 60, durationMs: 80 },   // E5
      { freq: 783.99, startMs: 120, durationMs: 160 },  // G5
    ],
    type: 'sine',
    gain: 0.12,
  },
  slow_correct: {
    notes: [
      { freq: 523.25, startMs: 0, durationMs: 100 },   // C5
      { freq: 659.25, startMs: 80, durationMs: 120 },  // E5
    ],
    type: 'sine',
    gain: 0.08,
  },
  depth_confusion: {
    notes: [
      { freq: 440, startMs: 0, durationMs: 120 },      // A4
      { freq: 370, startMs: 100, durationMs: 120 },    // F#4
      { freq: 440, startMs: 220, durationMs: 150 },    // A4
    ],
    type: 'triangle',
    gain: 0.10,
  },
  wrong: {
    notes: [
      { freq: 311, startMs: 0, durationMs: 150 },      // Eb4
      { freq: 277, startMs: 130, durationMs: 200 },    // C#4
    ],
    type: 'sine',
    gain: 0.10,
  },
  mix_acceptable: null,
};

type NoteSequence = {
  notes: Array<{ freq: number; startMs: number; durationMs: number }>;
  type: OscillatorType;
  gain: number;
};

const VIBRATE_CONFIG: Record<FeedbackKind, number[] | null> = {
  correct: [25],
  slow_correct: [25],
  depth_confusion: [30, 80, 30],
  wrong: [150],
  mix_acceptable: null,
};

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export function triggerFeedback(kind: FeedbackKind, options: FeedbackOptions) {
  if (options.feedbackSounds) {
    playChord(kind);
  }
  if (options.feedbackVibration) {
    vibrate(kind);
  }
}

function playChord(kind: FeedbackKind) {
  const config = SOUND_CONFIG[kind];
  if (!config) return;

  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    for (const note of config.notes) {
      const startTime = ctx.currentTime + note.startMs / 1000;
      const duration = note.durationMs / 1000;

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = config.type;
      osc.frequency.setValueAtTime(note.freq, startTime);

      // Smooth bell-like envelope
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