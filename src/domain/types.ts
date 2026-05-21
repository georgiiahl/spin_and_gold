// === Actions ===
export type Action = 'fold' | 'call' | 'raise' | 'jam';

// === Format ===
export type GameFormat = '3max' | 'hu';

// === Positions ===
export const POSITIONS_3MAX = ['BTN', 'SB', 'BB'] as const;
export const POSITIONS_HU = ['SB', 'BB'] as const; // SB = BTN in HU

export function getPositions(format: GameFormat): readonly string[] {
  return format === '3max' ? POSITIONS_3MAX : POSITIONS_HU;
}

// === History actions (structured) ===
export type HistoryAction = 'fold' | 'call' | 'raise' | 'jam' | 'open';

export type HistoryEntry = {
  position: string;
  action: HistoryAction;
};

// === Spot ===
export type Spot = {
  id: string;
  title: string;
  format: GameFormat;
  category?: string;
  effectiveStackBb: number;
  actingPosition: string;
  history: HistoryEntry[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

export const UNCATEGORIZED_SPOT_CATEGORY = 'Uncategorized';

export function normalizeSpotCategory(category?: string): string | undefined {
  const trimmed = category?.trim();
  return trimmed ? trimmed : undefined;
}

export function getSpotCategoryLabel(category?: string): string {
  return normalizeSpotCategory(category) ?? UNCATEGORIZED_SPOT_CATEGORY;
}

// === Hand Frequencies ===
export type HandFrequencies = {
  fold: number;
  call: number;
  raise: number;
  jam: number;
};

// === Spot Range ===
export type SpotRange = Record<string, HandFrequencies>;

// === Trainer Card ===
export type CardPhase = 'new' | 'learning' | 'review' | 'mastered' | 'relearning';

export type CardMemory = {
  phase: CardPhase;
  ease: number;
  intervalDays: number;
  repetitions: number;
  dueAt?: number;
  lapses: number;
  learningStep: number;
  consecutiveHardOnStep?: number;
  stability: number;
  difficulty: number;
  reps: number;
  state: number;
  last_review?: number;
  structuralDifficulty?: number;
};

export type TrainerCard = {
  id: string; // `${spotId}:${hand}`
  spotId: string;
  hand: string;
  frequencies: HandFrequencies;
  stats: {
    shown: number;
    correct: number;
    wrong: number;
    streak: number;
    avgResponseMs: number;
    lastSeenAt?: number;
    lastAnswerAt?: number;
  };
  memory: CardMemory;
};

// === Session ===
export type AnswerGrade = 'again' | 'hard' | 'good' | 'easy';

export type SessionAnswer = {
  spotId: string;
  hand: string;
  selectedAction: Action;
  correctActions: Action[];
  primaryAction?: Action;
  isCorrect: boolean;
  isMixedCorrect: boolean;
  responseTimeMs: number;
  grade: AnswerGrade;
  balancedAnswer?: { allocations: Partial<Record<Action, number>> };
  balancedScore?: number;
  timestamp: number;
  errorType?: 'wrong_action' | 'mix_miss' | 'depth_confusion' | 'position_confusion';
};

export type SessionConfig = {
  mode: 'until_done' | 'timed' | 'cards';
  timeLimitMin?: number;
  cardLimit?: number;
};
