import { GameFormat, HistoryEntry } from '@/domain/types';

type Props = {
  format: GameFormat;
  actingPosition: string;
  history: HistoryEntry[];
  effectiveStackBb: number;
  hand?: string;
};

type SeatMap = Record<string, [number, number]>;

type ParsedCard = {
  rank: string;
  suit: Suit;
};

type Suit = 'spade' | 'heart' | 'diamond' | 'club';

const SEATS_3MAX: SeatMap = {
  BTN: [50, 80],
  SB: [18, 26],
  BB: [82, 26],
};

const SEATS_HU: SeatMap = {
  SB: [20, 28],
  BB: [80, 28],
};

const SUIT_SYMBOLS: Record<Suit, string> = {
  spade: '♠',
  heart: '♥',
  diamond: '♦',
  club: '♣',
};

const SUIT_COLORS: Record<Suit, string> = {
  spade: '#111111',
  heart: '#ef4444',
  diamond: '#3b82f6',
  club: '#22c55e',
};

const SUITS: Suit[] = ['spade', 'heart', 'diamond', 'club'];

export default function PokerTable({ format, actingPosition, history, effectiveStackBb, hand }: Props) {
  const seatCoords = format === '3max' ? SEATS_3MAX : SEATS_HU;
  const positions = Object.keys(seatCoords);
  const dealerPosition = format === '3max' ? 'BTN' : 'SB';
  const actionAmounts = getActionAmounts(history, effectiveStackBb, format);
  const cards = hand ? parseHandCards(hand) : null;

  return (
    <div className="relative w-full" style={{ paddingBottom: '58%' }}>
      <div className="absolute inset-[10%_7%_18%_7%] rounded-full border-2 border-gray-500 bg-green-900" />

      {positions.map((position) => {
        const [left, top] = seatCoords[position];
        const isActing = position === actingPosition;
        const actionAmount = actionAmounts.get(position);
        const betPosition = getBetPosition(left, top);

        return (
          <div key={position}>
            {actionAmount && (
              <div
                className="absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-yellow-200 bg-yellow-600 text-[9px] font-semibold text-white"
                style={{ left: `${betPosition[0]}%`, top: `${betPosition[1]}%` }}
              >
                {actionAmount}
              </div>
            )}

            <div
              className="absolute"
              style={{ left: `${left}%`, top: `${top}%`, transform: 'translate(-50%, -50%)' }}
            >
              <div className="flex flex-col items-center gap-1">
                <div className="relative">
                  <div className={`min-w-[3rem] rounded-full border px-3 py-1 text-center text-[11px] font-semibold ${
                    isActing ? 'border-blue-300 bg-blue-700 text-white' : 'border-gray-500 bg-gray-800 text-gray-100'
                  }`}>
                    {position}
                  </div>
                  {position === dealerPosition && (
                    <div className="absolute -right-5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-gray-300 bg-white text-[10px] font-bold text-black">
                      D
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-gray-300">{effectiveStackBb}bb</div>
                {isActing && <div className="text-[10px] font-semibold text-blue-300">YOU</div>}

                {isActing && cards && (
                  <div className="mt-1 flex gap-1">
                    {cards.map((card, index) => (
                      <div
                        key={`${card.rank}-${card.suit}-${index}`}
                        className="flex h-8 w-6 flex-col justify-between rounded border border-gray-300 bg-white px-1 py-0.5 text-[10px] leading-none"
                      >
                        <span className="font-semibold text-black">{card.rank}</span>
                        <span className="self-end font-semibold" style={{ color: SUIT_COLORS[card.suit] }}>
                          {SUIT_SYMBOLS[card.suit]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getBetPosition(left: number, top: number): [number, number] {
  const centerLeft = 50 + (left - 50) * 0.42;
  const centerTop = 45 + (top - 45) * 0.42;

  return [centerLeft, centerTop];
}

function getActionAmounts(history: HistoryEntry[], effectiveStackBb: number, format: GameFormat): Map<string, string> {
  const contributions = new Map<string, number>();
  const blindPositions = format === 'hu' ? { SB: 0.5, BB: 1 } : { BTN: 0, SB: 0.5, BB: 1 };

  for (const [position, amount] of Object.entries(blindPositions)) {
    contributions.set(position, amount);
  }

  let currentPrice = 1;
  const actions = new Map<string, string>();

  for (const entry of history) {
    const previousContribution = contributions.get(entry.position) ?? 0;
    let amount = previousContribution;

    if (entry.action === 'open') {
      amount = Math.max(2, currentPrice * 2);
      currentPrice = amount;
    } else if (entry.action === 'raise') {
      amount = Math.min(effectiveStackBb, Math.max(currentPrice * 3, previousContribution + 1));
      currentPrice = amount;
    } else if (entry.action === 'call') {
      amount = currentPrice;
    } else if (entry.action === 'jam') {
      amount = effectiveStackBb;
      currentPrice = effectiveStackBb;
    }

    contributions.set(entry.position, amount);

    if (entry.action !== 'fold') {
      actions.set(entry.position, `${stripTrailingZeros(amount)}bb`);
    }
  }

  return actions;
}

function stripTrailingZeros(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1).replace(/\.0$/, '');
}

function parseHandCards(hand: string): [ParsedCard, ParsedCard] {
  const firstRank = hand[0] ?? 'A';
  const secondRank = hand[1] ?? firstRank;
  const modifier = hand[2];
  const seed = hand.split('').reduce((total, char, index) => total + (char.charCodeAt(0) * (index + 1)), 0);
  const firstSuit = SUITS[seed % SUITS.length];

  if (modifier === 's') {
    return [
      { rank: firstRank, suit: firstSuit },
      { rank: secondRank, suit: firstSuit },
    ];
  }

  const secondSuit = SUITS.find((suit) => suit !== firstSuit) ?? 'heart';
  return [
    { rank: firstRank, suit: firstSuit },
    { rank: secondRank, suit: modifier === 'o' || firstRank === secondRank ? secondSuit : firstSuit },
  ];
}
