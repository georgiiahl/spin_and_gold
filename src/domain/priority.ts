import { TrainerCard, HandFrequencies } from '@/domain/types';

// === Tuned weights for infinite flow ===
const RECENT_HAND_PENALTY = 0.05;
const RECENT_SPOT_PENALTY = 0.4;
const TOP_N_POOL = 12;

// === Pool distribution ===
export const RETRY_DELAY_REPEAT_STEPS_SEC = [180, 600] as const;
const MIN_RETRY_DELAY_SEC = 1;
export const REVIEW_SAMPLE_EVERY_N = 8;
export const ERROR_RATE_PROBLEM_THRESHOLD = 0.4;
export const ERROR_RATE_WINDOW = 10; // last N shown

export const POOL_WEIGHTS = {
  problem: 0.55,
  learning: 0.35,
  review: 0.10,
};

/**
 * Classify a card into a pool for infinite training flow.
 */
export type CardPool = 'problem' | 'learning' | 'review' | 'new';

export function classifyCardPool(card: TrainerCard): CardPool {
  const { phase } = card.memory;
  const { shown, wrong, streak } = card.stats;

  // Problem: relearning, or high error rate in recent window
  if (phase === 'relearning') return 'problem';
  if (shown >= 3) {
    const recentErrorRate = wrong / shown;
    if (recentErrorRate > ERROR_RATE_PROBLEM_THRESHOLD && streak < 3) return 'problem';
  }

  // New: never seen
  if (phase === 'new') return 'new';

  // Learning
  if (phase === 'learning') return 'learning';

  // Review / Mastered
  return 'review';
}

/**
 * Get the adaptive new card ratio based on problem pool pressure.
 */
export function getNewCardRatio(problemPoolSize: number, totalActive: number): number {
  if (totalActive === 0) return 0.30;
  const problemRatio = problemPoolSize / totalActive;

  if (problemRatio > 0.3) return 0.10;
  if (problemRatio > 0.2) return 0.20;
  return 0.30;
}

/**
 * Main priority calculation.
 */
export function calculatePriority(card: TrainerCard): number {
  const now = Date.now();

  const urgency = calculateUrgency(card, now);
  const mistakeWeight = calculateMistakeWeight(card);
  const mixWeight = calculateMixWeight(card.frequencies);
  const trashSuppression = calculateTrashSuppression(card);
  const novelty = calculateNovelty(card);
  const speedFactor = calculateSpeedFactor(card);

  return urgency * mistakeWeight * mixWeight * trashSuppression * novelty * speedFactor;
}

function calculateUrgency(card: TrainerCard, now: number): number {
  const { phase, dueAt } = card.memory;

  if (phase === 'new') return 2;

  if (!dueAt) return 1;

  const overdueMs = now - dueAt;
  if (overdueMs <= 0) return 0.1;

  const overdueDays = overdueMs / 86_400_000;
  return Math.min(15, 1 + overdueDays * 3);
}

function calculateMistakeWeight(card: TrainerCard): number {
  const { shown, wrong, streak } = card.stats;
  if (shown === 0) return 1;

  const errorRate = wrong / shown;
  const streakDiscount = Math.max(0.5, 1 - streak * 0.05);
  return (1 + errorRate * 3) * streakDiscount;
}

function calculateMixWeight(frequencies: HandFrequencies): number {
  const nonZero = Object.values(frequencies).filter((v) => v > 0).length;
  if (nonZero <= 1) return 1;
  return 1 + nonZero * 0.4;
}

function calculateTrashSuppression(card: TrainerCard): number {
  const { frequencies } = card;
  const { streak, shown } = card.stats;

  if (frequencies.fold === 1 && frequencies.call === 0 && frequencies.raise === 0 && frequencies.jam === 0) {
    if (shown >= 3 && streak >= 3) return 0.01;
    if (shown >= 2 && streak >= 2) return 0.15;
    if (shown >= 1 && streak >= 1) return 0.4;
  }

  const maxFreq = Math.max(frequencies.fold, frequencies.call, frequencies.raise, frequencies.jam);
  if (maxFreq === 1 && streak >= 5 && shown >= 5) return 0.2;

  return 1;
}

function calculateNovelty(card: TrainerCard): number {
  if (card.memory.phase === 'new') return 1.1;
  if (card.memory.phase === 'learning') return 1.3;
  return 1;
}

function calculateSpeedFactor(card: TrainerCard): number {
  const { avgResponseMs, shown } = card.stats;
  if (shown === 0 || avgResponseMs === 0) return 1;

  if (avgResponseMs > 5000) return 1.5;
  if (avgResponseMs > 3000) return 1.3;
  return 1;
}

/**
 * Pick next card with anti-repeat and weighted randomization.
 */
export function pickNextCard(
  cards: TrainerCard[],
  recentHands: string[] = [],
  recentSpotIds: string[] = []
): TrainerCard | null {
  if (cards.length === 0) return null;

  const recentHandsSet = new Set(recentHands);
  const recentSpotIdsSet = new Set(recentSpotIds);

  const scored = cards.map((card) => {
    let score = calculatePriority(card);
    if (recentHandsSet.has(card.hand)) score *= RECENT_HAND_PENALTY;
    if (recentSpotIdsSet.has(card.spotId)) score *= RECENT_SPOT_PENALTY;
    return { card, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const topN = scored.slice(0, Math.min(TOP_N_POOL, scored.length));
  const totalScore = topN.reduce((sum, s) => sum + s.score, 0);

  if (totalScore === 0) return topN[0].card;

  let random = Math.random() * totalScore;
  for (const { card, score } of topN) {
    random -= score;
    if (random <= 0) return card;
  }

  return topN[0].card;
}

export function getRetryDelaySeconds(attempt: number, retryMinDelaySec: number): number {
  if (attempt <= 1) return Math.max(MIN_RETRY_DELAY_SEC, retryMinDelaySec);
  if (attempt === 2) return RETRY_DELAY_REPEAT_STEPS_SEC[0];
  return RETRY_DELAY_REPEAT_STEPS_SEC[1];
}

export function isSpotOnCooldown(spotId: string, recentSpotIds: string[], sameSpotCooldown: number): boolean {
  const lookback = Math.max(0, sameSpotCooldown - 1);
  if (lookback === 0) return false;
  return recentSpotIds.slice(-lookback).includes(spotId);
}
