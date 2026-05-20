import { TrainerCard, CardPhase, AnswerGrade, HandFrequencies } from '@/domain/types';

// === Learning steps (in minutes) ===
const LEARNING_STEPS = [1, 10, 60]; // 1min, 10min, 1hr
const RELEARNING_STEPS = [10, 60];

// === Defaults ===
const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;
const EASY_BONUS = 1.3;
const HARD_INTERVAL_MULT = 1.2;
const GOOD_INTERVAL_MULT = 1.0;
const LAPSE_NEW_INTERVAL_MULT = 0.5;
const GRADUATING_INTERVAL_DAYS = 1;
const EASY_GRADUATING_INTERVAL_DAYS = 4;
const MASTERED_THRESHOLD_DAYS = 21;

export function createNewCard(spotId: string, hand: string, frequencies: HandFrequencies): TrainerCard {
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
    },
  };
}

export function scheduleCard(card: TrainerCard, grade: AnswerGrade): TrainerCard {
  const now = Date.now();
  const updated = structuredClone(card);
  const mem = updated.memory;

  switch (mem.phase) {
    case 'new':
    case 'learning':
      handleLearning(updated, grade, LEARNING_STEPS);
      break;
    case 'relearning':
      handleLearning(updated, grade, RELEARNING_STEPS);
      break;
    case 'review':
    case 'mastered':
      handleReview(updated, grade);
      break;
  }

  updated.stats.lastAnswerAt = now;
  updated.stats.lastSeenAt = now;
  updated.memory.repetitions += 1;

  return updated;
}

function handleLearning(card: TrainerCard, grade: AnswerGrade, steps: number[]) {
  const mem = card.memory;
  const now = Date.now();

  if (grade === 'again') {
    // Reset to first step
    mem.learningStep = 0;
    mem.phase = mem.phase === 'relearning' ? 'relearning' : 'learning';
    mem.dueAt = now + steps[0] * 60_000;
  } else if (grade === 'easy') {
    // Graduate immediately
    mem.phase = 'review';
    mem.intervalDays = EASY_GRADUATING_INTERVAL_DAYS;
    mem.dueAt = now + mem.intervalDays * 86_400_000;
    mem.learningStep = 0;
  } else {
    // hard or good — advance step
    const advance = grade === 'good' ? 1 : 0; // hard stays same step
    mem.learningStep = Math.min(mem.learningStep + advance, steps.length - 1);

    if (mem.learningStep >= steps.length - 1 && grade === 'good') {
      // Graduate
      mem.phase = 'review';
      mem.intervalDays = GRADUATING_INTERVAL_DAYS;
      mem.dueAt = now + mem.intervalDays * 86_400_000;
      mem.learningStep = 0;
    } else {
      mem.dueAt = now + steps[mem.learningStep] * 60_000;
    }
  }
}

function handleReview(card: TrainerCard, grade: AnswerGrade) {
  const mem = card.memory;
  const now = Date.now();

  if (grade === 'again') {
    // Lapse
    mem.lapses += 1;
    mem.phase = 'relearning';
    mem.learningStep = 0;
    mem.intervalDays = Math.max(1, Math.round(mem.intervalDays * LAPSE_NEW_INTERVAL_MULT));
    mem.dueAt = now + RELEARNING_STEPS[0] * 60_000;
    mem.ease = Math.max(MIN_EASE, mem.ease - 0.2);
    card.stats.streak = 0;
  } else {
    // Success
    let intervalMult: number;
    if (grade === 'hard') {
      intervalMult = HARD_INTERVAL_MULT;
      mem.ease = Math.max(MIN_EASE, mem.ease - 0.15);
    } else if (grade === 'good') {
      intervalMult = mem.ease * GOOD_INTERVAL_MULT;
    } else {
      // easy
      intervalMult = mem.ease * EASY_BONUS;
      mem.ease += 0.15;
    }

    mem.intervalDays = Math.max(1, Math.round(mem.intervalDays * intervalMult));
    mem.dueAt = now + mem.intervalDays * 86_400_000;

    // Check mastered
    if (mem.intervalDays >= MASTERED_THRESHOLD_DAYS && mem.lapses === 0) {
      mem.phase = 'mastered';
    } else {
      mem.phase = 'review';
    }
  }
}

/** Determine grade from answer result + response time */
export function determineGrade(
  isCorrect: boolean,
  isMixedCorrect: boolean,
  responseTimeMs: number
): AnswerGrade {
  if (!isCorrect) return 'again';
  if (isMixedCorrect) return 'hard';
  if (responseTimeMs > 8000) return 'hard';
  if (responseTimeMs < 2000) return 'easy';
  return 'good';
}
