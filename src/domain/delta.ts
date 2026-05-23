import { ALL_HANDS } from '@/domain/hands';
import { isBorderHand } from '@/domain/border';
import { Action, HandFrequencies, SessionAnswer, Spot, SpotRange, TrainerCard } from '@/domain/types';

const ACTIONS: Action[] = ['fold', 'call', 'raise', 'jam'];
const SAME_RATIO = 0.3;
const EPSILON = 0.0001;

export type DeltaCard = {
  hand: string;
  anchorSpotId: string;
  targetSpotId: string;
  anchorAction: Action;
  targetAction: Action;
  isSame: boolean;
};

function hasAnyFrequency(freq?: HandFrequencies): freq is HandFrequencies {
  if (!freq) return false;
  return freq.fold + freq.call + freq.raise + freq.jam > 0;
}

function getPrimaryAction(freq: HandFrequencies): Action {
  return ACTIONS.reduce((best, action) => (freq[action] > freq[best] ? action : best), 'fold' as Action);
}

function isMixed(freq?: HandFrequencies): boolean {
  if (!freq) return false;
  const nonZero = ACTIONS.filter((action) => freq[action] > 0).length;
  return nonZero > 1;
}

function getMedianSpot(spots: Spot[]): Spot {
  const sorted = [...spots].sort((a, b) => a.effectiveStackBb - b.effectiveStackBb);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  const medianValue = (sorted[middle - 1].effectiveStackBb + sorted[middle].effectiveStackBb) / 2;
  return sorted.reduce((best, spot) => {
    const currentDistance = Math.abs(spot.effectiveStackBb - medianValue);
    const bestDistance = Math.abs(best.effectiveStackBb - medianValue);
    if (currentDistance !== bestDistance) return currentDistance < bestDistance ? spot : best;
    return spot.effectiveStackBb < best.effectiveStackBb ? spot : best;
  }, sorted[0]);
}

export function findAnchorSpot(spots: Spot[], cards: TrainerCard[]): Spot {
  if (spots.length === 0) {
    throw new Error('Cannot find anchor spot: spot list is empty. Ensure at least one spot is provided.');
  }

  const spotIds = new Set(spots.map((spot) => spot.id));
  const cardsBySpot = new Map<string, TrainerCard[]>();
  for (const card of cards) {
    if (!spotIds.has(card.spotId)) continue;
    cardsBySpot.set(card.spotId, [...(cardsBySpot.get(card.spotId) ?? []), card]);
  }

  const masteredBySpot = new Map<string, number>();
  let totalMastered = 0;
  for (const spot of spots) {
    const spotCards = cardsBySpot.get(spot.id) ?? [];
    const mastered = spotCards.filter((card) => card.memory.phase === 'mastered').length;
    masteredBySpot.set(spot.id, mastered);
    totalMastered += mastered;
  }

  if (totalMastered === 0) {
    return getMedianSpot(spots);
  }

  const medianSpot = getMedianSpot(spots);
  const scored = spots.map((spot) => {
    const spotCards = cardsBySpot.get(spot.id) ?? [];
    const mastered = masteredBySpot.get(spot.id) ?? 0;
    const masteryPercent = spotCards.length > 0 ? mastered / spotCards.length : 0;
    return { spot, masteryPercent, mastered };
  });

  scored.sort((a, b) => {
    const masteryDiff = b.masteryPercent - a.masteryPercent;
    if (Math.abs(masteryDiff) > EPSILON) return masteryDiff;
    if (b.mastered !== a.mastered) return b.mastered - a.mastered;
    const distanceA = Math.abs(a.spot.effectiveStackBb - medianSpot.effectiveStackBb);
    const distanceB = Math.abs(b.spot.effectiveStackBb - medianSpot.effectiveStackBb);
    if (distanceA !== distanceB) return distanceA - distanceB;
    return a.spot.effectiveStackBb - b.spot.effectiveStackBb;
  });

  return scored[0].spot;
}

export function computeDeltas(anchor: SpotRange, target: SpotRange, anchorSpotId = '', targetSpotId = ''): DeltaCard[] {
  return ALL_HANDS.flatMap((hand) => {
    const anchorFreq = anchor[hand];
    const targetFreq = target[hand];
    if (!hasAnyFrequency(anchorFreq) || !hasAnyFrequency(targetFreq)) return [];
    const anchorAction = getPrimaryAction(anchorFreq);
    const targetAction = getPrimaryAction(targetFreq);
    return [{
      hand,
      anchorSpotId,
      targetSpotId,
      anchorAction,
      targetAction,
      isSame: anchorAction === targetAction,
    }];
  });
}

export function buildDeltaDrillQueue(
  deltas: DeltaCard[],
  sessions: SessionAnswer[],
  anchorRange: SpotRange,
  targetRange: SpotRange
): DeltaCard[] {
  if (deltas.length === 0) return [];

  const deltaHands = new Set(deltas.map((delta) => delta.hand));
  const depthConfusionHands = new Set(
    sessions
      .filter((session) => session.errorType === 'depth_confusion' && deltaHands.has(session.hand))
      .map((session) => session.hand)
  );

  const borderHands = new Set(
    ALL_HANDS.filter((hand) => isBorderHand(hand, anchorRange) || isBorderHand(hand, targetRange))
  );
  const mixedHands = new Set(
    ALL_HANDS.filter((hand) => isMixed(anchorRange[hand]) || isMixed(targetRange[hand]))
  );

  const different = deltas.filter((delta) => !delta.isSame);
  const same = deltas.filter((delta) => delta.isSame);

  const priority1 = different.filter((delta) => depthConfusionHands.has(delta.hand));
  const priority2 = different.filter((delta) => !depthConfusionHands.has(delta.hand) && borderHands.has(delta.hand));
  const priority3 = different.filter((delta) =>
    !depthConfusionHands.has(delta.hand) && !borderHands.has(delta.hand) && mixedHands.has(delta.hand)
  );
  const priority4 = different.filter((delta) =>
    !depthConfusionHands.has(delta.hand) && !borderHands.has(delta.hand) && !mixedHands.has(delta.hand)
  );
  const orderedDifferent = [
    ...priority1,
    ...priority2,
    ...priority3,
    ...shuffle(priority4),
  ];

  const trickySame = same.filter((delta) => borderHands.has(delta.hand) || mixedHands.has(delta.hand));
  const trickySameSet = new Set(trickySame);
  const otherSame = same.filter((delta) => !trickySameSet.has(delta));

  const sameCount = Math.min(same.length, Math.max(0, Math.round(orderedDifferent.length * SAME_RATIO)));
  const selectedSame = [...trickySame, ...shuffle(otherSame)].slice(0, sameCount);

  if (orderedDifferent.length === 0) return selectedSame;
  if (selectedSame.length === 0) return orderedDifferent;

  const result: DeltaCard[] = [];
  const sameEvery = Math.max(1, Math.round(orderedDifferent.length / selectedSame.length));
  let sameIndex = 0;
  for (let i = 0; i < orderedDifferent.length; i += 1) {
    result.push(orderedDifferent[i]);
    const shouldInsertSame = (i + 1) % sameEvery === 0;
    if (shouldInsertSame && sameIndex < selectedSame.length) {
      result.push(selectedSame[sameIndex]);
      sameIndex += 1;
    }
  }
  while (sameIndex < selectedSame.length) {
    result.push(selectedSame[sameIndex]);
    sameIndex += 1;
  }

  return result;
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
