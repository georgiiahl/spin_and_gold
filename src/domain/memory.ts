import { TrainerCard, AnswerGrade, HandFrequencies } from '@/domain/types';

// === Learning steps (in minutes) ===
const LEARNING_STEPS = [2, 8]; // Quick within-session graduation
const RELEARNING_STEPS = [3, 10]; // Faster retry for errors

// === Defaults ===
const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;
const EASY_BONUS = 1.3;
const HARD_INTERVAL_MULT = 1.2;
const GOOD_INTERVAL_MULT = 1.0;
const LAPSE_NEW_INTERVAL_MULT = 0.3;
const GRADUATING_INTERVAL_DAYS = 1;
const EASY_GRADUATING_INTERVAL_DAYS = 3;
const MASTERED_THRESHOLD_DAYS = 14;
const MASTERED_STREAK_THRESHOLD = 5;
const HARD_CONSECUTIVE_ADVANCE = 3;
const STREAK_BOOST_THRESHOLD = 5;
const STREAK_EASE_BONUS = 0.1;

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
      consecutiveHardOnStep: 0,
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

  // Adaptive streak boost
  if (updated.stats.streak >= STREAK_BOOST_THRESHOLD && grade === 'easy') {
    updated.memory.ease = Math.min(3.0, updated.memory.ease + STREAK_EASE_BONUS);
  }

  return updated;
}

function handleLearning(card: TrainerCard, grade: AnswerGrade, steps: number[]) {
  const mem = card.memory;
  const now = Date.now();

  if (grade === 'again') {
    mem.learningStep = 0;
    mem.consecutiveHardOnStep = 0;
    mem.phase = mem.phase === 'relearning' ? 'relearning' : 'learning';
    mem.dueAt = now + steps[0] * 60_000;
  } else if (grade === 'easy') {
    // Graduate immediately
    mem.phase = 'review';
    mem.intervalDays = EASY_GRADUATING_INTERVAL_DAYS;
    mem.dueAt = now + mem.intervalDays * 86_400_000;
    mem.learningStep = 0;
    mem.consecutiveHardOnStep = 0;
  } else if (grade === 'good') {
    mem.consecutiveHardOnStep = 0;
    mem.learningStep = Math.min(mem.learningStep + 1, steps.length);

    if (mem.learningStep >= steps.length) {
      // Graduate
      mem.phase = 'review';
      mem.intervalDays = GRADUATING_INTERVAL_DAYS;
      mem.dueAt = now + mem.intervalDays * 86_400_000;
      mem.learningStep = 0;
    } else {
      mem.dueAt = now + steps[mem.learningStep] * 60_000;
    }
  } else {
    // hard
    mem.consecutiveHardOnStep = (mem.consecutiveHardOnStep ?? 0) + 1;

    if (mem.consecutiveHardOnStep >= HARD_CONSECUTIVE_ADVANCE) {
      mem.consecutiveHardOnStep = 0;
      const nextStep = mem.learningStep + 1;

      if (nextStep >= steps.length) {
        mem.phase = 'review';
        mem.intervalDays = GRADUATING_INTERVAL_DAYS + 1;
        mem.dueAt = now + mem.intervalDays * 86_400_000;
        mem.learningStep = 0;
      } else {
        mem.learningStep = nextStep;
        mem.dueAt = now + steps[mem.learningStep] * 60_000;
      }
    } else {
      mem.dueAt = now + steps[mem.learningStep] * 60_000;
    }
  }
}

function handleReview(card: TrainerCard, grade: AnswerGrade) {
  const mem = card.memory;
  const now = Date.now();

  if (grade === 'again') {
    mem.lapses += 1;
    mem.phase = 'relearning';
    mem.learningStep = 0;
    mem.consecutiveHardOnStep = 0;
    mem.intervalDays = Math.max(1, Math.round(mem.intervalDays * LAPSE_NEW_INTERVAL_MULT));
    mem.dueAt = now + RELEARNING_STEPS[0] * 60_000;
    mem.ease = Math.max(MIN_EASE, mem.ease - 0.2);
    card.stats.streak = 0;
  } else {
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

    if (mem.intervalDays >= MASTERED_THRESHOLD_DAYS && (mem.lapses === 0 || card.stats.streak >= MASTERED_STREAK_THRESHOLD)) {
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