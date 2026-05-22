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
};

type SeatRow = {
  seat: number;
  name: string;
  chips: number;
};

type ParsedAction = {
  player: string;
  action: 'fold' | 'call' | 'raise' | 'jam';
  amount?: number;
};

const HAND_SPLIT_REGEX = /\n{2,}(?=(?:GGPoker\s+)?Hand\s+#\d+)/g;

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
  const handId = handText.match(/Hand\s+#(\d+)/)?.[1];
  if (!handId) return null;

  const tournamentId = handText.match(/Tournament\s+#(\d+)/)?.[1] ?? '';
  const buttonSeat = parseSeatNumber(handText.match(/Seat\s+#?(\d+)\s+is\s+the\s+button/i)?.[1]);
  const seats = parseSeats(handText);
  if (seats.length < 2 || buttonSeat == null) return null;

  const format: ParsedHand['format'] = seats.length === 2 ? 'hu' : '3max';
  const positionsBySeat = buildSeatPositionMap(seats.map((seat) => seat.seat), buttonSeat);

  const dealt = handText.match(/^Dealt to (.+?) \[([2-9TJQKA][shdc]) ([2-9TJQKA][shdc])\]/im);
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

  const sbAmount = extractBlindAmount(handText, /^(.*?): posts small blind (\d+(?:\.\d+)?)/im);
  const bbAmount = extractBlindAmount(handText, /^(.*?): posts big blind (\d+(?:\.\d+)?)/im);
  if (bbAmount <= 0) return null;

  const preflopLines = extractPreflopLines(handText);
  const preflopActions = preflopLines
    .map(parsePreflopAction)
    .filter((action): action is ParsedAction => Boolean(action))
    .map((action) => ({
      player: action.player,
      position: parsedSeats.find((seat) => seat.name === action.player)?.position ?? '',
      action: action.action,
      amount: action.amount,
    }));

  const heroActionEntry = preflopActions.find((action) => action.player === heroName) ?? null;
  const heroAction = heroActionEntry ? { action: heroActionEntry.action, amount: heroActionEntry.amount } : null;

  const timestamp = handText.match(/(\d{4}[/-]\d{2}[/-]\d{2} \d{2}:\d{2}:\d{2})/)?.[1] ?? '';

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

function extractBlindAmount(handText: string, regex: RegExp): number {
  const match = handText.match(regex);
  if (!match) return 0;
  return Number(match[2]);
}

function extractPreflopLines(handText: string): string[] {
  const lines = handText.split('\n');
  const holeCardsIndex = lines.findIndex((line) => line.startsWith('*** HOLE CARDS ***'));
  if (holeCardsIndex === -1) return [];

  const endIndex = lines.findIndex(
    (line, index) => index > holeCardsIndex && line.startsWith('*** ') && line !== '*** HOLE CARDS ***'
  );

  const sliceEnd = endIndex === -1 ? lines.length : endIndex;
  return lines.slice(holeCardsIndex + 1, sliceEnd);
}

function parsePreflopAction(line: string): ParsedAction | null {
  const fold = line.match(/^(.+?): folds/i);
  if (fold) {
    return { player: fold[1].trim(), action: 'fold' };
  }

  const call = line.match(/^(.+?): calls (\d+(?:\.\d+)?)/i);
  if (call) {
    return { player: call[1].trim(), action: 'call', amount: Number(call[2]) };
  }

  const jam = line.match(/^(.+?): raises \d+(?:\.\d+)? to (\d+(?:\.\d+)?) and is all-in/i);
  if (jam) {
    return { player: jam[1].trim(), action: 'jam', amount: Number(jam[2]) };
  }

  const raise = line.match(/^(.+?): raises \d+(?:\.\d+)? to (\d+(?:\.\d+)?)/i);
  if (raise) {
    return { player: raise[1].trim(), action: 'raise', amount: Number(raise[2]) };
  }

  return null;
}

function parseSeatNumber(value?: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
