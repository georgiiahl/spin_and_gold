import { Action, HandFrequencies, SessionAnswer, Spot, SpotRange, TrainerCard } from '@/domain/types';

function getPrimaryAction(freq: HandFrequencies): Action {
  const actions: Action[] = ['fold', 'call', 'raise', 'jam'];
  return actions.reduce((best, action) => (freq[action] > freq[best] ? action : best), 'fold' as Action);
}

function clampDifficulty(value: number): number {
  return Math.min(10, Math.max(1, Number(value.toFixed(3))));
}

function calculateEntropy(freq: HandFrequencies): number {
  const values = [freq.fold, freq.call, freq.raise, freq.jam].filter((v) => v > 0);
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return 0;
  return values.reduce((entropy, value) => {
    const p = value / total;
    return entropy - p * Math.log2(p);
  }, 0);
}

export function estimateInitialDifficulty(
  hand: string,
  freq: HandFrequencies,
  spot: Spot,
  siblingSpots: Spot[],
  siblingRanges: Map<string, SpotRange>
): number {
  let difficulty = 5;

  const maxFreq = Math.max(freq.fold, freq.call, freq.raise, freq.jam);
  if (maxFreq < 0.65) difficulty += 2;
  else if (maxFreq < 0.85) difficulty += 1;

  const myPrimary = getPrimaryAction(freq);
  let depthConfusionBonus = 0;
  for (const sibling of siblingSpots) {
    if (sibling.id === spot.id) continue;
    const siblingFreq = siblingRanges.get(sibling.id)?.[hand];
    if (!siblingFreq) continue;

    const siblingPrimary = getPrimaryAction(siblingFreq);
    if (siblingPrimary === myPrimary) continue;

    const distance = Math.abs(sibling.effectiveStackBb - spot.effectiveStackBb);
    if (distance <= 2) depthConfusionBonus = Math.max(depthConfusionBonus, 2);
    else if (distance <= 4) depthConfusionBonus = Math.max(depthConfusionBonus, 1);
  }
  difficulty += depthConfusionBonus;

  const nonZeroActions = [freq.fold, freq.call, freq.raise, freq.jam].filter((v) => v > 0).length;
  if (nonZeroActions >= 3) difficulty += 1;

  const entropy = calculateEntropy(freq);
  difficulty += entropy;

  return clampDifficulty(difficulty);
}

export function recalibrateCardDifficulty(
  card: TrainerCard,
  sessions: SessionAnswer[],
  structuralDifficulty: number
): number {
  const cardSessions = sessions.filter((s) => s.spotId === card.spotId && s.hand === card.hand);
  if (cardSessions.length < 20) return structuralDifficulty;

  const accuracy = cardSessions.filter((s) => s.isCorrect).length / cardSessions.length;
  const observedDifficulty = (1 - accuracy) * 10;
  const weight = Math.min(1, cardSessions.length / 100);

  return clampDifficulty(structuralDifficulty * (1 - weight) + observedDifficulty * weight);
}
