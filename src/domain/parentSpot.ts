import { Spot, SpotRange } from '@/domain/types';

const FREQUENCY_EPSILON = 0.0001;

export function isSecondAction(spot: Spot): boolean {
  return spot.history.some((entry) => entry.position === spot.actingPosition);
}

export function findParentSpot(spot: Spot, allSpots: Spot[]): Spot | null {
  const firstHeroActionIndex = spot.history.findIndex((entry) => entry.position === spot.actingPosition);
  if (firstHeroActionIndex < 0) return null;

  const parentHistory = spot.history.slice(0, firstHeroActionIndex);
  const candidates = allSpots.filter((candidate) =>
    candidate.id !== spot.id
    && candidate.format === spot.format
    && candidate.actingPosition === spot.actingPosition
    && isSameHistory(candidate.history, parentHistory)
  );

  if (candidates.length === 0) return null;

  return candidates.reduce((best, candidate) => {
    const candidateDiff = Math.abs(candidate.effectiveStackBb - spot.effectiveStackBb);
    const bestDiff = Math.abs(best.effectiveStackBb - spot.effectiveStackBb);
    return candidateDiff < bestDiff ? candidate : best;
  });
}

export function getAllowedHands(parentRange: SpotRange): string[] {
  return Object.entries(parentRange)
    .filter(([, frequencies]) =>
      (frequencies.call + frequencies.raise + frequencies.jam) > FREQUENCY_EPSILON
    )
    .map(([hand]) => hand);
}

function isSameHistory(left: Spot['history'], right: Spot['history']): boolean {
  if (left.length !== right.length) return false;
  return left.every((entry, index) =>
    entry.position === right[index]?.position && entry.action === right[index]?.action
  );
}
