export type ParsedHand = {
  handId: string;
  tournamentId: string;
  format: '3max' | 'hu';
  blinds: { sb: number; bb: number };
  seats: Array<{
    name: string;
    chips: number;
    position: 'BTN' | 'SB' | 'BB';
    isHero: boolean;
  }>;
  heroCards: [string, string] | null;
  preflopActions: Array<{
    player: string;
    position: string;
    action: 'fold' | 'call' | 'raise' | 'jam';
    amount?: number;
  }>;
  heroAction: { action: 'fold' | 'call' | 'raise' | 'jam'; amount?: number } | null;
  timestamp: string;
  board: string[];
  isAllInBeforeRiver: boolean;
  allInStreet: 'preflop' | 'flop' | 'turn' | null;
  opponentCards: [string, string] | null;
  potSize: number;
  heroChipsInvested: number;
  heroChipsCollected: number;
  netChips: number;
};

type SeatRow = {
  seat: number;
  name: string;
  chips: number;
};

type ParsedAction = {
  player: string;
  action: 'fold' | 'check' | 'call' | 'bet' | 'raise';
  amount?: number;
  street: 'preflop' | 'flop' | 'turn' | 'river';
  contributed: number;
  isAllIn: boolean;
  isForcedBet?: boolean;
};

type PreflopDecisionAction = 'fold' | 'call' | 'raise';

// Supports both formats:
//   "Poker Hand #SG3893499366: Tournament #286662086, Spin&Gold ..."
//   "GGPoker Hand #12345 ..."
//   "Hand #12345 ..."
const HAND_SPLIT_REGEX = /\n{2,}(?=(?:Poker|GGPoker)?\s*Hand\s+#)/g;

export function parseGgHandHistories(rawText: string): ParsedHand[] {
  const text = rawText.replace(/\r/g, '').trim();
  if (!text) return [];

  const hands = text
    .split(HAND_SPLIT_REGEX)
    .map((chunk) => parseSingleHand(chunk.trim()))
    .filter((hand): hand is ParsedHand => Boolean(hand));

  return hands.filter((hand) => hand.heroAction !== null);
}

function parseSingleHand(handText: string): ParsedHand | null {
  // Match alphanumeric hand IDs like SG3893499366 or numeric like 12345
  const handId = handText.match(/Hand\s+#([A-Za-z0-9]+)/)?.[1];
  if (!handId) return null;

  const tournamentId = handText.match(/Tournament\s+#(\d+)/)?.[1] ?? '';
  const buttonSeat = parseSeatNumber(handText.match(/Seat\s+#?(\d+)\s+is\s+the\s+button/i)?.[1]);
  const seats = parseSeats(handText);
  if (seats.length < 2 || buttonSeat == null) return null;

  const format: ParsedHand['format'] = seats.length === 2 ? 'hu' : '3max';
  const positionsBySeat = buildSeatPositionMap(seats.map((seat) => seat.seat), buttonSeat);

  const dealt = handText.match(/^Dealt to (.+?) \[([2-9TJQKA][shdcSHDC]) ([2-9TJQKA][shdcSHDC])\]/im);
  const heroName = dealt?.[1]?.trim() ?? '';
  const heroCards = dealt ? [dealt[2].toUpperCase(), dealt[3].toUpperCase()] as [string, string] : null;

  const parsedSeats: ParsedHand['seats'] = seats
    .map((seat) => {
      const position = positionsBySeat.get(seat.seat);
      if (!position) return null;
      return {
        name: seat.name,
        chips: seat.chips,
        position,
        isHero: heroName.length > 0 && seat.name === heroName,
      };
    })
    .filter((seat): seat is NonNullable<typeof seat> => Boolean(seat));

  if (parsedSeats.length < 2) return null;

  // Prefer extracting blinds from the header "Level5(40/80)" since posted
  // amounts can be less when a player is short-stacked.
  const { sb: headerSb, bb: headerBb } = extractBlindsFromHeader(handText);
  const sbAmount = headerSb > 0 ? headerSb : extractBlindAmount(handText, /^(.*?): posts small blind (\d+(?:\.\d+)?)/im);
  const bbAmount = headerBb > 0 ? headerBb : extractBlindAmount(handText, /^(.*?): posts big blind (\d+(?:\.\d+)?)/im);
  if (bbAmount <= 0) return null;

  const handState = parseHandState(handText);
  const preflopActions = handState.actions
    .filter((action) => action.street === 'preflop')
    .filter((action) => !action.isForcedBet)
    .filter((action): action is ParsedAction & { action: PreflopDecisionAction } => isPreflopDecisionAction(action.action))
    .map((action) => ({
     player: action.player,
     position: parsedSeats.find((seat) => seat.name === action.player)?.position ?? '',
     action: toPublicPreflopAction(action),
     amount: action.amount,
    }));

  const heroActionEntry = preflopActions.find((action) => action.player === heroName) ?? null;
  const heroAction = heroActionEntry ? { action: heroActionEntry.action, amount: heroActionEntry.amount } : null;

  const timestamp = handText.match(/(\d{4}[/-]\d{2}[/-]\d{2} \d{2}:\d{2}:\d{2})/)?.[1] ?? '';
  const shownCards = extractShownCards(handText);
  const shownOpponents = [...shownCards.entries()].filter(([player]) => player !== heroName);
  const opponentCards = shownOpponents.length === 1 ? shownOpponents[0][1] : null;
  const board = extractBoard(handText);
  const heroChipsInvested = heroName ? roundNumber(handState.investedByPlayer.get(heroName) ?? 0) : 0;
  const heroChipsCollected = roundNumber(extractCollectedAmount(handText, heroName));
  const potSize = roundNumber(extractTotalPot(handText) || extractTotalCollected(handText));
  const netChips = roundNumber(heroChipsCollected - heroChipsInvested);

  return {
    handId,
    tournamentId,
    format,
    blinds: { sb: sbAmount, bb: bbAmount },
    seats: parsedSeats,
    heroCards,
    preflopActions,
    heroAction,
    timestamp,
    board,
    isAllInBeforeRiver: handState.allInStreet !== null,
    allInStreet: handState.allInStreet,
    opponentCards,
    potSize,
    heroChipsInvested,
    heroChipsCollected,
    netChips,
  };
}

function parseSeats(handText: string): SeatRow[] {
  const lines = handText.split('\n');
  const seats: SeatRow[] = [];

  for (const line of lines) {
    const match = line.match(/^Seat (\d+): (.+?) \(([\d,.]+) in chips\)/);
    if (!match) continue;
    seats.push({
      seat: Number(match[1]),
      name: match[2].trim(),
      chips: Number(match[3].replace(/,/g, '')),
    });
  }

  return seats.sort((a, b) => a.seat - b.seat);
}

function buildSeatPositionMap(
  occupiedSeats: number[],
  buttonSeat: number
): Map<number, 'BTN' | 'SB' | 'BB'> {
  const sorted = [...occupiedSeats].sort((a, b) => a - b);
  const map = new Map<number, 'BTN' | 'SB' | 'BB'>();
  if (sorted.length < 2) return map;

  const buttonIndex = sorted.indexOf(buttonSeat);
  if (buttonIndex === -1) return map;

  const nextSeat = sorted[(buttonIndex + 1) % sorted.length];
  const thirdSeat = sorted[(buttonIndex + 2) % sorted.length];

  if (sorted.length === 2) {
    map.set(buttonSeat, 'SB');
    map.set(nextSeat, 'BB');
    return map;
  }

  map.set(buttonSeat, 'BTN');
  map.set(nextSeat, 'SB');
  map.set(thirdSeat, 'BB');
  return map;
}

/**
 * Extract blind levels from the header line, e.g.:
 *   "Level5(40/80)" → { sb: 40, bb: 80 }
 * This is more reliable than parsing posted amounts which can be short.
 */
function extractBlindsFromHeader(handText: string): { sb: number; bb: number } {
  const match = handText.match(/Level\d+\((\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)\)/i);
  if (!match) return { sb: 0, bb: 0 };
  return { sb: Number(match[1]), bb: Number(match[2]) };
}

function extractBlindAmount(handText: string, regex: RegExp): number {
  const match = handText.match(regex);
  if (!match) return 0;
  return Number(match[2]);
}

function parseHandState(handText: string): {
  actions: ParsedAction[];
  investedByPlayer: Map<string, number>;
  allInStreet: ParsedHand['allInStreet'];
} {
  const lines = handText.split('\n');
  const actions: ParsedAction[] = [];
  const investedByPlayer = new Map<string, number>();
  let street: ParsedAction['street'] | null = 'preflop';
  let currentStreetInvested = new Map<string, number>();
  let allInStreet: ParsedHand['allInStreet'] = null;

  for (const line of lines) {
    const nextStreet = parseStreetHeader(line);
    if (nextStreet) {
      street = nextStreet;
      if (nextStreet !== 'preflop') {
        currentStreetInvested = new Map();
      }
      continue;
    }

    if (line.startsWith('*** SHOW DOWN ***') || line.startsWith('*** SUMMARY ***')) {
      street = null;
      continue;
    }

    const returnedBet = parseReturnedBet(line);
    if (returnedBet) {
      investedByPlayer.set(
        returnedBet.player,
        roundNumber((investedByPlayer.get(returnedBet.player) ?? 0) - returnedBet.amount)
      );
      currentStreetInvested.set(
        returnedBet.player,
        Math.max(0, roundNumber((currentStreetInvested.get(returnedBet.player) ?? 0) - returnedBet.amount))
      );
      continue;
    }

    if (!street) continue;

    const action = parseBettingAction(line, street, currentStreetInvested.get(getActionPlayer(line)) ?? 0);
    if (!action) continue;

    if (action.contributed > 0) {
      investedByPlayer.set(
        action.player,
        roundNumber((investedByPlayer.get(action.player) ?? 0) + action.contributed)
      );
      currentStreetInvested.set(
        action.player,
        roundNumber((currentStreetInvested.get(action.player) ?? 0) + action.contributed)
      );
    }

    if (action.isAllIn && street !== 'river' && allInStreet === null) {
      allInStreet = street;
    }

    actions.push(action);
  }

  return { actions, investedByPlayer, allInStreet };
}

function parseStreetHeader(line: string): ParsedAction['street'] | null {
  if (line.startsWith('*** HOLE CARDS ***')) return 'preflop';
  if (line.startsWith('*** FLOP ***')) return 'flop';
  if (line.startsWith('*** TURN ***')) return 'turn';
  if (line.startsWith('*** RIVER ***')) return 'river';
  return null;
}

function parseBettingAction(
  line: string,
  street: ParsedAction['street'],
  currentStreetAmount: number
): ParsedAction | null {
  const fold = line.match(/^(.+?): folds/i);
  if (fold) {
    return { player: fold[1].trim(), action: 'fold', street, contributed: 0, isAllIn: false };
  }

  const check = line.match(/^(.+?): checks/i);
  if (check) {
    return { player: check[1].trim(), action: 'check', street, contributed: 0, isAllIn: false };
  }

  const postBlind = line.match(/^(.+?): posts (?:small|big) blind (\d+(?:\.\d+)?)( and is all-in)?/i);
  if (postBlind) {
    const amount = Number(postBlind[2]);
    return {
      player: postBlind[1].trim(),
      action: 'call',
      amount,
      street,
      contributed: amount,
      isAllIn: Boolean(postBlind[3]),
      isForcedBet: true,
    };
  }

  const postAnte = line.match(/^(.+?): posts ante (\d+(?:\.\d+)?)( and is all-in)?/i);
  if (postAnte) {
    const amount = Number(postAnte[2]);
    return {
      player: postAnte[1].trim(),
      action: 'call',
      amount,
      street,
      contributed: amount,
      isAllIn: Boolean(postAnte[3]),
      isForcedBet: true,
    };
  }

  const call = line.match(/^(.+?): calls (\d+(?:\.\d+)?)( and is all-in)?/i);
  if (call) {
    const amount = Number(call[2]);
    return {
      player: call[1].trim(),
      action: 'call',
      amount,
      street,
      contributed: amount,
      isAllIn: Boolean(call[3]),
    };
  }

  const jam = line.match(/^(.+?): raises \d+(?:\.\d+)? to (\d+(?:\.\d+)?)( and is all-in)?/i);
  if (jam) {
    const totalAmount = Number(jam[2]);
    const contributed = roundNumber(totalAmount - currentStreetAmount);
    if (contributed < 0) return null;
    return {
      player: jam[1].trim(),
      action: 'raise',
      amount: totalAmount,
      street,
      contributed,
      isAllIn: Boolean(jam[3]),
    };
  }

  const bet = line.match(/^(.+?): bets (\d+(?:\.\d+)?)( and is all-in)?/i);
  if (bet) {
    const amount = Number(bet[2]);
    return {
      player: bet[1].trim(),
      action: 'bet',
      amount,
      street,
      contributed: amount,
      isAllIn: Boolean(bet[3]),
    };
  }

  return null;
}

function parseReturnedBet(line: string): { player: string; amount: number } | null {
  const match = line.match(/^Uncalled bet \((\d+(?:\.\d+)?)\) returned to (.+)$/i);
  if (!match) return null;
  return {
    player: match[2].trim(),
    amount: Number(match[1]),
  };
}

function getActionPlayer(line: string): string {
  return line.match(/^(.+?):/)?.[1]?.trim() ?? '';
}

function extractBoard(handText: string): string[] {
  const cards: string[] = [];
  const flop = handText.match(/\*\*\* FLOP \*\*\* \[([^\]]+)\]/i);
  if (flop) cards.push(...parseCardList(flop[1]));

  const turn = handText.match(/\*\*\* TURN \*\*\* \[[^\]]+\] \[([^\]]+)\]/i);
  if (turn) cards.push(...parseCardList(turn[1]));

  const river = handText.match(/\*\*\* RIVER \*\*\* \[[^\]]+\] \[([^\]]+)\]/i);
  if (river) cards.push(...parseCardList(river[1]));

  if (cards.length > 0) return cards;

  const summaryBoard = handText.match(/^Board \[([^\]]+)\]/im);
  return summaryBoard ? parseCardList(summaryBoard[1]) : [];
}

function extractShownCards(handText: string): Map<string, [string, string]> {
  const shown = new Map<string, [string, string]>();
  const regex = /^(.+?): show(?:s|ed) \[([2-9TJQKA][shdcSHDC]) ([2-9TJQKA][shdcSHDC])\]/gim;

  for (const match of handText.matchAll(regex)) {
    shown.set(match[1].trim(), [normalizeCard(match[2]), normalizeCard(match[3])]);
  }

  return shown;
}

function extractCollectedAmount(handText: string, heroName: string): number {
  if (!heroName) return 0;

  let total = 0;
  for (const match of handText.matchAll(/^(.+?) collected (\d+(?:\.\d+)?) from pot/igm)) {
    if (match[1].trim() === heroName) {
      total += Number(match[2]);
    }
  }

  if (total > 0) return total;

  const escapedHero = escapeRegex(heroName);
  const summaryWin = handText.match(new RegExp(`Seat \\d+: ${escapedHero} .* won \\(([\\d,.]+)\\)`, 'i'));
  return summaryWin ? Number(summaryWin[1].replace(/,/g, '')) : 0;
}

function extractTotalCollected(handText: string): number {
  let total = 0;
  for (const match of handText.matchAll(/^.+? collected (\d+(?:\.\d+)?) from pot/igm)) {
    total += Number(match[1]);
  }
  return total;
}

function extractTotalPot(handText: string): number {
  const match = handText.match(/^Total pot (\d+(?:\.\d+)?)/im);
  return match ? Number(match[1]) : 0;
}

function parseCardList(value: string): string[] {
  return value
    .trim()
    .split(/\s+/)
    .map(normalizeCard)
    .filter((card) => card.length === 2);
}

function normalizeCard(value: string): string {
  const match = value.trim().match(/^([2-9TJQKA])([shdcSHDC])$/);
  if (!match) return value.trim().toUpperCase();
  return `${match[1].toUpperCase()}${match[2].toUpperCase()}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function roundNumber(value: number): number {
  return Math.round(value * 100) / 100;
}

function isPreflopDecisionAction(action: ParsedAction['action']): action is PreflopDecisionAction {
  return (['fold', 'call', 'raise'] as const).includes(action as PreflopDecisionAction);
}

function toPublicPreflopAction(action: ParsedAction): 'fold' | 'call' | 'raise' | 'jam' {
  if (action.action === 'raise' && action.isAllIn) return 'jam';
  if (action.action === 'fold' || action.action === 'call' || action.action === 'raise') return action.action;
  throw new Error(`Unexpected preflop action: ${action.action}`);
}

function parseSeatNumber(value?: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}