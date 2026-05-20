import { GameFormat, HistoryEntry } from '@/domain/types';

type Props = {
  format: GameFormat;
  actingPosition: string;
  history: HistoryEntry[];
  effectiveStackBb: number;
  hand?: string;
};

type SeatLayout = {
  seat: [number, number];
  bet: [number, number];
  cards: [number, number];
  dealerButton?: [number, number];
};

const SEATS_3MAX: Record<string, SeatLayout> = {
  BTN: { seat: [50, 82], bet: [50, 64], cards: [50, 70], dealerButton: [58, 79] },
  SB: { seat: [18, 28], bet: [33, 42], cards: [30, 42] },
  BB: { seat: [82, 28], bet: [67, 42], cards: [70, 42] },
};

const SEATS_HU: Record<string, SeatLayout> = {
  SB: { seat: [50, 82], bet: [50, 63], cards: [50, 70], dealerButton: [58, 79] },
  BB: { seat: [50, 18], bet: [50, 37], cards: [50, 31] },
};

const ACTION_LABELS: Record<string, string> = {
  call: 'Call',
  raise: 'Raise',
  jam: 'Jam',
  open: 'Open',
};

export default function PokerTable({ format, actingPosition, history, effectiveStackBb, hand }: Props) {
  const positions = format === '3max' ? ['BTN', 'SB', 'BB'] : ['SB', 'BB'];
  const seatCoords = format === '3max' ? SEATS_3MAX : SEATS_HU;
  const cards = buildCards(hand);

  const positionActions = new Map<string, string>();
  for (const entry of history) {
    positionActions.set(entry.position, entry.action);
  }

  return (
    <div className="relative mx-auto aspect-[16/9] w-full max-w-4xl">
      <div className="absolute inset-0 flex items-center justify-center rounded-[2rem] bg-white/70 p-3 shadow-sm ring-1 ring-gray-200">
        <div className="h-[74%] w-[80%] rounded-full border border-emerald-950/20 bg-emerald-700 shadow-inner" />
      </div>

      {positions.map((pos) => {
        const seat = seatCoords[pos];
        const isActing = pos === actingPosition;
        const action = positionActions.get(pos);
        const showChip = action && action !== 'fold';

        return (
          <div key={pos}>
            {showChip && (
              <div
                className="absolute flex min-h-10 min-w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white px-2 text-[9px] font-semibold text-gray-900 shadow-sm"
                style={{
                  left: `${seat.bet[0]}%`,
                  top: `${seat.bet[1]}%`,
                }}
              >
                {ACTION_LABELS[action] ?? action}
              </div>
            )}

            <div
               className={`absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-xs font-bold shadow-sm ${
                 isActing
                   ? 'border-blue-500 bg-white text-blue-700'
                   : 'border-white/70 bg-gray-50 text-gray-700'
               }`}
               style={{ left: `${seat.seat[0]}%`, top: `${seat.seat[1]}%` }}
             >
              {pos}
            </div>

            <div
              className="absolute -translate-x-1/2 rounded-full border border-white/70 bg-white/95 px-2 py-0.5 text-[11px] font-medium text-gray-700 shadow-sm"
              style={{ left: `${seat.seat[0]}%`, top: `${seat.seat[1] + 10}%` }}
            >
              {effectiveStackBb}bb
            </div>

            {seat.dealerButton && pos === (format === '3max' ? 'BTN' : 'SB') && (
              <div
                className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-200 bg-amber-100 text-[10px] font-bold text-amber-700 shadow-sm"
                style={{ left: `${seat.dealerButton[0]}%`, top: `${seat.dealerButton[1]}%` }}
              >
                D
              </div>
            )}
          </div>
        );
      })}

      {cards && (
        <div
          className="absolute flex -translate-x-1/2 gap-1"
          style={{
            left: `${seatCoords[actingPosition]?.cards[0] ?? 50}%`,
            top: `${seatCoords[actingPosition]?.cards[1] ?? 90}%`,
          }}
        >
          {cards.map((card, index) => (
            <div
              key={`${card.rank}${card.suit}-${index}`}
              className={`flex h-12 w-9 flex-col items-center justify-center rounded-md border border-white/20 text-sm font-bold text-white shadow-md ${card.backgroundClass}`}
            >
              <span className="leading-none">{card.rank}</span>
              <span className="leading-none text-[12px]">{card.suit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type RenderCard = {
  rank: string;
  suit: string;
  backgroundClass: string;
};

const SUITS = [
  { symbol: '♠', backgroundClass: 'bg-gray-900' },
  { symbol: '♥', backgroundClass: 'bg-red-600' },
  { symbol: '♦', backgroundClass: 'bg-blue-600' },
  { symbol: '♣', backgroundClass: 'bg-green-700' },
];

function buildCards(hand?: string): RenderCard[] | null {
  if (!hand || hand.length < 2) return null;

  const [rankA, rankB, rawSuffix] = hand.toUpperCase().split('');
  const suffix = rawSuffix ?? '';
  const seed = hand.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  const firstSuitIndex = seed % SUITS.length;
  let secondSuitIndex = firstSuitIndex;

  if (rankA === rankB) {
    secondSuitIndex = (firstSuitIndex + 1) % SUITS.length;
  } else if (suffix !== 'S') {
    secondSuitIndex = (firstSuitIndex + 1 + (seed % (SUITS.length - 1))) % SUITS.length;
    if (secondSuitIndex === firstSuitIndex) {
      secondSuitIndex = (secondSuitIndex + 1) % SUITS.length;
    }
  }

  const firstSuit = SUITS[firstSuitIndex];
  const secondSuit = SUITS[secondSuitIndex];

  return [
    { rank: rankA, suit: firstSuit.symbol, backgroundClass: firstSuit.backgroundClass },
    { rank: rankB, suit: secondSuit.symbol, backgroundClass: secondSuit.backgroundClass },
  ];
}
