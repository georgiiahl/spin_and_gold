import { fsrs, Rating, State, type Card as FsrsCard, type Grade } from 'ts-fsrs';
import { TrainerCard, AnswerGrade, HandFrequencies, CardMemory, CardPhase } from '@/domain/types';

const DEFAULT_EASE = 2.5;
const MASTERED_THRESHOLD_DAYS = 14;
const MASTERED_STREAK_THRESHOLD = 5;
const DEFAULT_DESIRED_RETENTION = 0.9;
const INITIAL_STABILITY = 0.4;

function clampDifficulty(value: number): number {
  return Math.min(10, Math.max(1, Number(value.toFixed(3))));
}

function mapGradeToRating(grade: AnswerGrade): Grade {
  switch (grade) {
    case 'again': return Rating.Again;
    case 'hard': return Rating.Hard;
    case 'good': return Rating.Good;
    case 'easy': return Rating.Easy;
  }
}

function mapPhaseToState(phase: CardPhase): State {
  switch (phase) {
    case 'new': return State.New;
    case 'learning': return State.Learning;
    case 'relearning': return State.Relearning;
    case 'review':
    case 'mastered':
      return State.Review;
  }
}

function mapStateToPhase(state: State, card: TrainerCard, intervalDays: number): CardPhase {
  switch (state) {
    case State.New: return 'new';
    case State.Learning: return 'learning';
    case State.Relearning: return 'relearning';
    case State.Review:
      return intervalDays >= MASTERED_THRESHOLD_DAYS && (card.memory.lapses === 0 || card.stats.streak >= MASTERED_STREAK_THRESHOLD)
        ? 'mastered'
        : 'review';
  }
}

function deriveEaseFromDifficulty(difficulty: number): number {
  const normalized = (difficulty - 1) / 9;
  return Number((3 - normalized * 1.7).toFixed(3));
}

function toFsrsCard(memory: CardMemory, now: number): FsrsCard {
  return {
    due: new Date(memory.dueAt ?? now),
    stability: memory.stability,
    difficulty: memory.difficulty,
    elapsed_days: 0,
    scheduled_days: Math.max(0, Math.round(memory.intervalDays)),
    learning_steps: Math.max(0, memory.learningStep),
    reps: Math.max(0, memory.reps ?? memory.repetitions),
    lapses: Math.max(0, memory.lapses),
    state: memory.state as State,
    last_review: memory.last_review ? new Date(memory.last_review) : undefined,
  };
}

function isFsrsMemory(memory: Partial<CardMemory>): boolean {
  return typeof memory.stability === 'number'
    && typeof memory.difficulty === 'number'
    && typeof memory.reps === 'number'
    && typeof memory.state === 'number';
}

export function migrateCardMemory(card: TrainerCard): TrainerCard {
  const updated = structuredClone(card);
  const mem = updated.memory as Partial<CardMemory>;

  if (isFsrsMemory(mem)) {
    updated.memory.structuralDifficulty = typeof mem.structuralDifficulty === 'number' ? clampDifficulty(mem.structuralDifficulty) : mem.difficulty;
    if (typeof updated.memory.last_review !== 'number' && updated.stats.lastAnswerAt) {
      updated.memory.last_review = updated.stats.lastAnswerAt;
    }
    return updated;
  }

  const oldEase = typeof mem.ease === 'number' ? mem.ease : DEFAULT_EASE;
  const oldInterval = typeof mem.intervalDays === 'number' ? mem.intervalDays : 0;
  const oldReps = typeof mem.repetitions === 'number' ? mem.repetitions : 0;
  const phase = (mem.phase ?? 'new') as CardPhase;
  // Legacy ease range is ~[1.3, 3.0]; map it inversely to FSRS difficulty scale [1, 10].
  const estimatedDifficulty = clampDifficulty(10 - (oldEase - 1.3) * 4);
  const lastReview = updated.stats.lastAnswerAt ?? mem.dueAt;

  updated.memory = {
    phase,
    ease: oldEase,
    intervalDays: Math.max(0, oldInterval),
    repetitions: oldReps,
    dueAt: mem.dueAt,
    lapses: typeof mem.lapses === 'number' ? mem.lapses : 0,
    learningStep: typeof mem.learningStep === 'number' ? mem.learningStep : 0,
    consecutiveHardOnStep: mem.consecutiveHardOnStep ?? 0,
    stability: oldInterval > 0 ? oldInterval : INITIAL_STABILITY,
    difficulty: estimatedDifficulty,
    reps: oldReps,
    state: mapPhaseToState(phase),
    last_review: lastReview,
    structuralDifficulty: estimatedDifficulty,
  };

  return updated;
}

export function createNewCard(
  spotId: string,
  hand: string,
  frequencies: HandFrequencies,
  structuralDifficulty = 5
): TrainerCard {
  const difficulty = clampDifficulty(structuralDifficulty);
  return {
    id: `${spotId}:${hand}`,
    spotId,
    hand,
    frequencies,
    stats: {
      shown: 0,
      correct: 0,
      wrong: 0,
      streak: 0,
      avgResponseMs: 0,
      lastSeenAt: undefined,
      lastAnswerAt: undefined,
    },
    memory: {
      phase: 'new',
      ease: DEFAULT_EASE,
      intervalDays: 0,
      repetitions: 0,
      dueAt: undefined,
      lapses: 0,
      learningStep: 0,
      consecutiveHardOnStep: 0,
      stability: INITIAL_STABILITY,
      difficulty,
      reps: 0,
      state: State.New,
      last_review: undefined,
      structuralDifficulty: difficulty,
    },
  };
}

export function scheduleCard(
  card: TrainerCard,
  grade: AnswerGrade,
  options?: { desiredRetention?: number }
): TrainerCard {
  const now = Date.now();
  const migrated = migrateCardMemory(card);
  const updated = structuredClone(migrated);
  const mem = updated.memory;
  const scheduler = fsrs({
    request_retention: options?.desiredRetention ?? DEFAULT_DESIRED_RETENTION,
    enable_fuzz: false,
  });
  const rating = mapGradeToRating(grade);
  const result = scheduler.next(toFsrsCard(mem, now), new Date(now), rating);
  const next = result.card;

  updated.stats.lastAnswerAt = now;
  updated.stats.lastSeenAt = now;
  updated.memory.repetitions = next.reps;
  updated.memory.reps = next.reps;
  updated.memory.lapses = next.lapses;
  updated.memory.learningStep = next.learning_steps;
  updated.memory.intervalDays = Math.max(0, next.scheduled_days);
  updated.memory.dueAt = next.due.getTime();
  updated.memory.state = next.state;
  updated.memory.last_review = next.last_review?.getTime();
  updated.memory.stability = next.stability;
  updated.memory.difficulty = clampDifficulty(next.difficulty);
  updated.memory.ease = deriveEaseFromDifficulty(updated.memory.difficulty);
  updated.memory.consecutiveHardOnStep = 0;
  updated.memory.phase = mapStateToPhase(next.state, updated, updated.memory.intervalDays);

  return updated;
}

/** Determine grade from answer result + response time */
export function determineGrade(
  isCorrect: boolean,
  isMixedCorrect: boolean,
  responseTimeMs: number,
  thresholds?: { fastMs: number; slowMs: number }
): AnswerGrade {
  const fastMs = thresholds?.fastMs ?? 1200;
  const slowMs = thresholds?.slowMs ?? 3500;
  if (!isCorrect) return 'again';
  if (isMixedCorrect) return 'hard';
  if (responseTimeMs > slowMs) return 'hard';
  if (responseTimeMs < fastMs) return 'easy';
  return 'good';
}
