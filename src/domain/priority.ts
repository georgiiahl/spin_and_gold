import { TrainerCard, HandFrequencies } from '@/domain/types';

/**
 * Smart Priority Engine
 * 
 * Calculates a priority score for each card to determine training order.
 * Higher score = shown sooner.
 * 
 * Factors:
 * 1. Memory urgency — overdue cards get high priority
 * 2. Mistake weight — frequently missed cards are prioritized
 * 3. Mix weight — mixed strategy hands are harder, boost priority
 * 4. Trash suppression — pure fold hands with good streak get deprioritized
 * 5. Novelty — new cards get a boost
 * 6. Speed factor — slow correct answers suggest shaky knowledge
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

  if (phase === 'new') return 3; // New cards have moderate priority

  if (!dueAt) return 1;

  const overdueMs = now - dueAt;
  if (overdueMs <= 0) {
    // Not yet due — low priority
    return 0.1;
  }

  // Overdue: scale from 1 to 10 based on how overdue
  const overdueDays = overdueMs / 86_400_000;
  return Math.min(10, 1 + overdueDays * 2);
}

function calculateMistakeWeight(card: TrainerCard): number {
  const { shown, wrong, streak } = card.stats;
  if (shown === 0) return 1;

  const errorRate = wrong / shown;
  // High error rate = much higher priority
  // Good streak reduces priority slightly
  const streakDiscount = Math.max(0.5, 1 - streak * 0.05);
  return (1 + errorRate * 3) * streakDiscount;
}

function calculateMixWeight(frequencies: HandFrequencies): number {
  const nonZero = Object.values(frequencies).filter((v) => v > 0).length;
  if (nonZero <= 1) return 1;
  // Mixed hands get 1.5-2x boost
  return 1 + nonZero * 0.3;
}

function calculateTrashSuppression(card: TrainerCard): number {
  const { frequencies } = card;
  const { streak, shown } = card.stats;

  // Is this a pure fold hand?
  if (frequencies.fold === 1 && frequencies.call === 0 && frequencies.raise === 0 && frequencies.jam === 0) {
    // After being shown a few times with good streak, heavily suppress
    if (shown >= 3 && streak >= 3) return 0.05;
    if (shown >= 2 && streak >= 2) return 0.2;
    if (shown >= 1 && streak >= 1) return 0.5;
  }

  // Pure obvious actions (e.g., AA = always jam) — slight suppression after mastery
  const maxFreq = Math.max(frequencies.fold, frequencies.call, frequencies.raise, frequencies.jam);
  if (maxFreq === 1 && streak >= 5 && shown >= 5) {
    return 0.3;
  }

  return 1;
}

function calculateNovelty(card: TrainerCard): number {
  if (card.memory.phase === 'new') return 1.3;
  if (card.memory.phase === 'learning') return 1.2;
  return 1;
}

function calculateSpeedFactor(card: TrainerCard): number {
  const { avgResponseMs, shown } = card.stats;
  if (shown === 0 || avgResponseMs === 0) return 1;

  // Slow answers (>5s average) suggest shaky knowledge
  if (avgResponseMs > 5000) return 1.3;
  if (avgResponseMs > 3000) return 1.1;
  return 1;
}

/**
 * Pick next card from a list sorted by priority (descending).
 * Adds slight randomization to avoid always showing the same card.
 */
export function pickNextCard(
  cards: TrainerCard[],
  recentHands: string[] = [],
  recentSpotIds: string[] = []
): TrainerCard | null {
  if (cards.length === 0) return null;

  const recentHandsSet = new Set(recentHands);
  const recentSpotIdsSet = new Set(recentSpotIds);

  // Score all cards
  const scored = cards.map((card) => {
    let score = calculatePriority(card);
    if (recentHandsSet.has(card.hand)) {
      score *= 0.1;
    }
    if (recentSpotIdsSet.has(card.spotId)) {
      score *= 0.5;
    }
    return { card, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Pick from the top candidates with weighted random to add variety
  const topN = scored.slice(0, Math.min(10, scored.length));
  const totalScore = topN.reduce((sum, s) => sum + s.score, 0);

  if (totalScore === 0) return topN[0].card;

  let random = Math.random() * totalScore;
  for (const { card, score } of topN) {
    random -= score;
    if (random <= 0) return card;
  }

  return topN[0].card;
}
