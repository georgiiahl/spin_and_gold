import { Action, HandFrequencies, SpotRange } from '@/domain/types';
import { MatchedSpot } from '@/domain/hhSpotMatcher';

export type HandVerdict = {
  matched: MatchedSpot;
  heroAction: Action;
  correctActions: Action[];
  primaryAction: Action;
  frequencies: HandFrequencies;
  isCorrect: boolean;
  isMixedCorrect: boolean;
};

const ACTIONS: Action[] = ['fold', 'call', 'raise', 'jam'];
const RANK_ORDER = 'AKQJT98765432';

export function buildHandVerdict(
  matched: MatchedSpot,
  rangesBySpot: Map<string, SpotRange>
): HandVerdict | null {
  const spotId = matched.matchedSpotId;
  const heroAction = matched.hand.heroAction?.action;
  const handKey = toChartHandKey(matched.hand.heroCards);
  if (!spotId || !heroAction || !handKey) return null;

  const frequencies = rangesBySpot.get(spotId)?.[handKey];
  if (!frequencies) return null;

  const correctActions = ACTIONS.filter((action) => frequencies[action] > 0);
  if (correctActions.length === 0) return null;

  const primaryAction = ACTIONS.reduce((best, action) => (
    frequencies[action] > frequencies[best] ? action : best
  ), 'fold' as Action);

  const isCorrect = correctActions.includes(heroAction);
  const isMixedCorrect = isCorrect && heroAction !== primaryAction && correctActions.length > 1;

  return {
    matched,
    heroAction,
    correctActions,
    primaryAction,
    frequencies,
    isCorrect,
    isMixedCorrect,
  };
}

export function toChartHandKey(cards: [string, string] | null): string | null {
  if (!cards) return null;

  const first = parseCard(cards[0]);
  const second = parseCard(cards[1]);
  if (!first || !second) return null;

  if (first.rank === second.rank) return `${first.rank}${second.rank}`;

  const ordered = [first, second].sort(
    (a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank)
  );
  const suited = ordered[0].suit === ordered[1].suit;

  return `${ordered[0].rank}${ordered[1].rank}${suited ? 's' : 'o'}`;
}

function parseCard(value: string): { rank: string; suit: string } | null {
  const match = value.trim().toUpperCase().match(/^([2-9TJQKA])([SHDC])$/);
  if (!match) return null;
  return { rank: match[1], suit: match[2] };
}
