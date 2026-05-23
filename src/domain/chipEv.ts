import { calculateEquity } from '@/domain/equity';
import { ParsedHand } from '@/domain/hhParser';

export type HandChipEvResult = {
  handId: string;
  tournamentId: string;
  netChipsActual: number;
  netChipsAdjusted: number;
  isAllInAdjusted: boolean;
  bbSize: number;
};

export type ChipEvSummary = {
  totalTournaments: number;
  totalHands: number;
  chipEvPerTournament: number;
  chipEvBbPer100: number;
  allInHandsCount: number;
  adjustedHands: number;
};

type SummaryInput = HandChipEvResult & {
  wasAllInBeforeRiver?: boolean;
};

export function buildHandChipEvResult(hand: ParsedHand): HandChipEvResult {
  const actual = hand.netChips;
  const canAdjust =
    hand.isAllInBeforeRiver
    && Boolean(hand.heroCards)
    && Boolean(hand.opponentCards)
    && hand.potSize > 0;

  if (!canAdjust || !hand.heroCards || !hand.opponentCards) {
    return {
      handId: hand.handId,
      tournamentId: hand.tournamentId,
      netChipsActual: actual,
      netChipsAdjusted: actual,
      isAllInAdjusted: false,
      bbSize: hand.blinds.bb,
    };
  }

  const boardAtAllIn = getBoardAtAllIn(hand);
  const equity = calculateEquity(hand.heroCards, hand.opponentCards, boardAtAllIn);
  const adjusted = roundNumber(equity * hand.potSize - hand.heroChipsInvested);

  return {
    handId: hand.handId,
    tournamentId: hand.tournamentId,
    netChipsActual: actual,
    netChipsAdjusted: adjusted,
    isAllInAdjusted: true,
    bbSize: hand.blinds.bb,
  };
}

export function summarizeChipEv(results: SummaryInput[]): ChipEvSummary {
  const totalAdjustedChips = results.reduce((sum, hand) => sum + hand.netChipsAdjusted, 0);
  const totalAdjustedBb = results.reduce((sum, hand) => sum + (hand.bbSize > 0 ? hand.netChipsAdjusted / hand.bbSize : 0), 0);
  const tournamentIds = new Set(results.map((hand) => hand.tournamentId).filter(Boolean));

  return {
    totalTournaments: tournamentIds.size,
    totalHands: results.length,
    chipEvPerTournament: tournamentIds.size > 0 ? roundNumber(totalAdjustedChips / tournamentIds.size) : 0,
    chipEvBbPer100: results.length > 0 ? roundNumber((totalAdjustedBb / results.length) * 100) : 0,
    allInHandsCount: results.filter((hand) => hand.wasAllInBeforeRiver).length,
    adjustedHands: results.filter((hand) => hand.isAllInAdjusted).length,
  };
}

function getBoardAtAllIn(hand: ParsedHand): string[] {
  switch (hand.allInStreet) {
    case 'preflop':
      return [];
    case 'flop':
      return hand.board.slice(0, 3);
    case 'turn':
      return hand.board.slice(0, 4);
    default:
      return hand.board.slice(0, Math.min(5, hand.board.length));
  }
}

function roundNumber(value: number): number {
  return Math.round(value * 100) / 100;
}
