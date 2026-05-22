import { HistoryEntry, Spot } from '@/domain/types';
import { ParsedHand } from '@/domain/hhParser';

export type MatchedSpot = {
  hand: ParsedHand;
  spotType: 'open' | 'vs_open' | 'vs_3bet' | 'vs_jam';
  actingPosition: string;
  history: HistoryEntry[];
  effectiveStackBb: number;
  matchedSpotId: string | null;
};

type ActionBeforeHero = ParsedHand['preflopActions'][number];

export function matchHandToSpot(hand: ParsedHand, spots: Spot[]): MatchedSpot {
  const heroSeat = hand.seats.find((seat) => seat.isHero);
  const actingPosition = heroSeat?.position ?? '';
  const actionsBeforeHero = getActionsBeforeHero(hand);
  const history = buildHistory(actionsBeforeHero);
  const effectiveStackBb = calculateEffectiveStackBb(hand, actionsBeforeHero);
  const matchedSpotId = findClosestSpotId(spots, hand.format, actingPosition, history, effectiveStackBb);
  const spotType = detectSpotType(actionsBeforeHero);

  return {
    hand,
    spotType,
    actingPosition,
    history,
    effectiveStackBb,
    matchedSpotId,
  };
}

function getActionsBeforeHero(hand: ParsedHand): ActionBeforeHero[] {
  const heroName = hand.seats.find((seat) => seat.isHero)?.name;
  if (!heroName) return hand.preflopActions;

  const heroActionIndex = hand.preflopActions.findIndex((action) => action.player === heroName);
  if (heroActionIndex === -1) return hand.preflopActions;
  return hand.preflopActions.slice(0, heroActionIndex);
}

function buildHistory(actionsBeforeHero: ActionBeforeHero[]): HistoryEntry[] {
  let hasAggressiveAction = false;
  return actionsBeforeHero.map((action) => {
    const historyAction = determineHistoryAction(action.action, hasAggressiveAction);
    const isAggressive = action.action === 'raise' || action.action === 'jam';
    if (isAggressive) hasAggressiveAction = true;
    return {
      position: action.position,
      action: historyAction,
    };
  });
}

function determineHistoryAction(
  action: ActionBeforeHero['action'],
  hasAggressiveAction: boolean
): HistoryEntry['action'] {
  if (action === 'raise' && !hasAggressiveAction) {
    return 'open';
  }
  return action;
}

function detectSpotType(actionsBeforeHero: ActionBeforeHero[]): MatchedSpot['spotType'] {
  const aggressors = actionsBeforeHero.filter((action) => action.action === 'raise' || action.action === 'jam');
  if (aggressors.length === 0) return 'open';
  const lastAggressor = aggressors[aggressors.length - 1];
  if (lastAggressor?.action === 'jam') return 'vs_jam';
  if (aggressors.length >= 2) return 'vs_3bet';
  return 'vs_open';
}

function calculateEffectiveStackBb(hand: ParsedHand, actionsBeforeHero: ActionBeforeHero[]): number {
  const bb = hand.blinds.bb || 1;
  const hero = hand.seats.find((seat) => seat.isHero);
  if (!hero) return 0;

  const chipsByPosition = new Map(hand.seats.map((seat) => [seat.position, seat.chips]));
  const playerByName = new Map(hand.seats.map((seat) => [seat.name, seat]));
  const aggressors = actionsBeforeHero.filter((action) => action.action === 'raise' || action.action === 'jam');
  const lastAggressor = aggressors.length > 0 ? playerByName.get(aggressors[aggressors.length - 1].player) : null;
  const opener = aggressors.length > 0 ? playerByName.get(aggressors[0].player) : null;

  if (lastAggressor) {
    return roundStack(Math.min(hero.chips, lastAggressor.chips) / bb);
  }

  if (hand.format === '3max' && hero.position === 'BTN') {
    const sb = chipsByPosition.get('SB') ?? 0;
    const bbChips = chipsByPosition.get('BB') ?? 0;
    return roundStack(Math.min(hero.chips, Math.max(sb, bbChips)) / bb);
  }

  if (hero.position === 'SB') {
    const bbChips = chipsByPosition.get('BB') ?? 0;
    return roundStack(Math.min(hero.chips, bbChips) / bb);
  }

  if (hero.position === 'BB' && opener) {
    return roundStack(Math.min(hero.chips, opener.chips) / bb);
  }

  const opponents = hand.seats.filter((seat) => !seat.isHero);
  const maxOpponent = opponents.reduce((max, seat) => Math.max(max, seat.chips), 0);
  return roundStack(Math.min(hero.chips, maxOpponent) / bb);
}

function findClosestSpotId(
  spots: Spot[],
  format: ParsedHand['format'],
  actingPosition: string,
  history: HistoryEntry[],
  effectiveStackBb: number
): string | null {
  const candidates = spots.filter((spot) =>
    spot.format === format
      && spot.actingPosition === actingPosition
      && isSameHistoryPattern(spot.history, history)
  );

  if (candidates.length === 0) return null;

  const closest = candidates.reduce((best, current) => {
    const currentDiff = Math.abs(current.effectiveStackBb - effectiveStackBb);
    const bestDiff = Math.abs(best.effectiveStackBb - effectiveStackBb);
    return currentDiff < bestDiff ? current : best;
  });

  return closest.id;
}

function isSameHistoryPattern(left: HistoryEntry[], right: HistoryEntry[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((entry, index) =>
    entry.position === right[index]?.position && entry.action === right[index]?.action
  );
}

function roundStack(value: number): number {
  return Math.round(value * 10) / 10;
}
