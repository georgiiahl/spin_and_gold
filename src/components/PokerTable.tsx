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
  BTN: { seat: [50, 80], bet: [50, 62], cards: [50, 92], dealerButton: [59, 77] },
  SB: { seat: [18, 24], bet: [34, 40], cards: [18, 36] },
  BB: { seat: [82, 24], bet: [66, 40], cards: [82, 36] },
};

const SEATS_HU: Record<string, SeatLayout> = {
  SB: { seat: [50, 80], bet: [50, 60], cards: [50, 92], dealerButton: [59, 77] },
  BB: { seat: [50, 16], bet: [50, 36], cards: [50, 28] },
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
    <div className="relative w-full" style={{ paddingBottom: '52%' }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-[72%] w-[78%] rounded-full border border-gray-500 bg-green-900" />
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
                className="absolute flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-gray-100 text-[9px] font-semibold text-gray-900"
                style={{
                  left: `${seat.bet[0]}%`,
                  top: `${seat.bet[1]}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {ACTION_LABELS[action] ?? action}
              </div>
            )}

            <div
              className={`absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-xs font-bold ${
                isActing
                  ? 'border-blue-300 bg-blue-700 text-white'
                  : 'border-gray-500 bg-gray-700 text-gray-100'
              }`}
              style={{ left: `${seat.seat[0]}%`, top: `${seat.seat[1]}%` }}
            >
              {pos}
            </div>

            <div
              className="absolute -translate-x-1/2 text-[11px] text-gray-300"
              style={{ left: `${seat.seat[0]}%`, top: `${seat.seat[1] + 10}%` }}
            >
              {effectiveStackBb}bb
            </div>

            {seat.dealerButton && pos === (format === '3max' ? 'BTN' : 'SB') && (
              <div
                className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-[10px] font-bold text-gray-900"
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
              className="flex h-10 w-7 items-center justify-center rounded border border-gray-300 bg-white text-xs font-bold text-gray-900"
            >
              <span>{card.rank}</span>
              <span className={card.colorClass}>{card.suit}</span>
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
  colorClass: string;
};

const SUITS = [
  { symbol: '♠', colorClass: 'text-black' },
  { symbol: '♥', colorClass: 'text-red-500' },
  { symbol: '♦', colorClass: 'text-sky-500' },
  { symbol: '♣', colorClass: 'text-green-500' },
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
    { rank: rankA, suit: firstSuit.symbol, colorClass: firstSuit.colorClass },
    { rank: rankB, suit: secondSuit.symbol, colorClass: secondSuit.colorClass },
  ];
}
