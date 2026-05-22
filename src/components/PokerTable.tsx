import { GameFormat, HistoryEntry } from '@/domain/types';

export type SeatDetail = {
  name: string;
  chips: number;
  stackBb: number;
  isHero?: boolean;
};

type Props = {
  format: GameFormat;
  actingPosition: string;
  history: HistoryEntry[];
  effectiveStackBb: number;
  /** Canonical hand like "AKo" — used in trainer mode */
  hand?: string;
  /** Exact cards like ["As", "6d"] — used in review mode, takes priority over `hand` */
  exactCards?: [string, string];
  /** Per-position seat info. If provided, renders names & bb stacks */
  seatDetails?: Partial<Record<string, SeatDetail>>;
  /** Level label like "Level5 (40/80)" shown above the table */
  levelLabel?: string;
  highlightStack?: boolean;
  highlightPosition?: boolean;
};

type SeatPosition = {
  x: number;
  y: number;
  dealerX?: number;
  dealerY?: number;
};

const SEATS_3MAX: Record<string, SeatPosition> = {
  BTN: { x: 50, y: 85, dealerX: 63, dealerY: 78 },
  SB: { x: 15, y: 30 },
  BB: { x: 85, y: 30 },
};

const SEATS_HU: Record<string, SeatPosition> = {
  SB: { x: 50, y: 85, dealerX: 63, dealerY: 78 },
  BB: { x: 50, y: 15 },
};

const BET_OFFSETS: Record<string, [number, number]> = {
  BTN: [50, 66],
  SB: [32, 42],
  BB: [68, 42],
};

const BET_OFFSETS_HU: Record<string, [number, number]> = {
  SB: [50, 66],
  BB: [50, 34],
};

const ACTION_LABELS: Record<string, string> = {
  call: 'Call',
  raise: 'R',
  jam: 'Jam',
  open: 'R',
};

export default function PokerTable({
  format,
  actingPosition,
  history,
  effectiveStackBb,
  hand,
  exactCards,
  seatDetails,
  levelLabel,
  highlightStack = false,
  highlightPosition = false,
}: Props) {
  const positions = format === '3max' ? ['BTN', 'SB', 'BB'] : ['SB', 'BB'];
  const seats = format === '3max' ? SEATS_3MAX : SEATS_HU;
  const betOffsets = format === '3max' ? BET_OFFSETS : BET_OFFSETS_HU;
  const cards = exactCards ? buildExactCards(exactCards) : buildCards(hand);

  const positionActions = new Map<string, string>();
  for (const entry of history) {
    positionActions.set(entry.position, entry.action);
  }

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[340px]">
      {/* Level label */}
      {levelLabel && (
        <div className="absolute left-1/2 top-1 -translate-x-1/2 rounded-full bg-gray-800/80 px-2.5 py-0.5 text-[10px] font-medium text-gray-200">
          {levelLabel}
        </div>
      )}

      {/* Table circle */}
      <div className="absolute inset-[14%] rounded-full border-2 border-gray-300" />

      {/* Cards in center */}
      {cards && (
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-2">
          {cards.map((card, index) => (
            <div
              key={`${card.rank}${card.suit}-${index}`}
              className={`flex h-[76px] w-[54px] flex-col items-center justify-center rounded-lg text-xl font-bold text-white shadow ${card.backgroundClass}`}
            >
              <span className="leading-tight">{card.rank}</span>
              <span className="text-base leading-tight">{card.suit}</span>
            </div>
          ))}
        </div>
      )}

      {/* Seat positions */}
      {positions.map((pos) => {
        const seat = seats[pos];
        const isActing = pos === actingPosition;
        const action = positionActions.get(pos);
        const showChip = action && action !== 'fold';
        const chip = betOffsets[pos];
        const detail = seatDetails?.[pos];

        return (
          <div key={pos}>
            {/* Position circle */}
            <div
              className={`absolute flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 transition-all duration-300 ${
                isActing
                  ? 'border-blue-500 bg-blue-500 shadow-md shadow-blue-200'
                  : detail?.isHero
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-300 bg-white'
              } ${highlightPosition && isActing ? 'ring-3 ring-blue-300 ring-offset-2' : ''}`}
              style={{ left: `${seat.x}%`, top: `${seat.y}%` }}
            >
              <span className={`text-xs font-bold ${isActing ? 'text-white' : 'text-gray-700'}`}>
                {pos}
              </span>
              {detail ? (
                <>
                  <span
                    className={`max-w-[56px] truncate text-[9px] leading-tight ${
                      isActing ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {detail.name}
                  </span>
                  <span
                    className={`text-[10px] font-semibold ${
                      highlightStack && isActing
                        ? 'text-amber-300'
                        : isActing
                          ? 'text-blue-100'
                          : 'text-gray-400'
                    }`}
                  >
                    {detail.stackBb}bb
                  </span>
                </>
              ) : (
                <span
                  className={`text-[11px] font-semibold transition-colors duration-500 ${
                    highlightStack && isActing
                      ? 'text-amber-300'
                      : isActing
                        ? 'text-blue-100'
                        : 'text-gray-400'
                  }`}
                >
                  {effectiveStackBb}bb
                </span>
              )}
            </div>

            {/* Dealer button */}
            {seat.dealerX != null && pos === (format === '3max' ? 'BTN' : 'SB') && (
              <div
                className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-white shadow-sm"
                style={{ left: `${seat.dealerX}%`, top: `${seat.dealerY}%` }}
              >
                D
              </div>
            )}

            {/* Bet chip */}
            {showChip && chip && (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-700 px-2 py-0.5 text-[10px] font-semibold text-white"
                style={{ left: `${chip[0]}%`, top: `${chip[1]}%` }}
              >
                {ACTION_LABELS[action] ?? action}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type RenderCard = {
  rank: string;
  suit: string;
  backgroundClass: string;
};

const SUIT_MAP: Record<string, { symbol: string; backgroundClass: string }> = {
  S: { symbol: '♠', backgroundClass: 'bg-gray-900' },
  H: { symbol: '♥', backgroundClass: 'bg-red-600' },
  D: { symbol: '♦', backgroundClass: 'bg-blue-600' },
  C: { symbol: '♣', backgroundClass: 'bg-green-700' },
};

const SUITS = [
  { symbol: '♠', backgroundClass: 'bg-gray-900' },
  { symbol: '♥', backgroundClass: 'bg-red-600' },
  { symbol: '♦', backgroundClass: 'bg-blue-600' },
  { symbol: '♣', backgroundClass: 'bg-green-700' },
];

function buildExactCards(cards: [string, string]): RenderCard[] {
  return cards.map((card) => {
    const rank = card[0].toUpperCase();
    const suitChar = card[1].toUpperCase();
    const suitInfo = SUIT_MAP[suitChar] ?? SUITS[0];
    return { rank, suit: suitInfo.symbol, backgroundClass: suitInfo.backgroundClass };
  });
}

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