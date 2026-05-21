import { GameFormat, HistoryEntry } from '@/domain/types';

type Props = {
  format: GameFormat;
  actingPosition: string;
  history: HistoryEntry[];
  effectiveStackBb: number;
};

type SeatLayout = {
  seat: [number, number];
  bet: [number, number];
  dealerButton?: [number, number];
};

const SEATS_3MAX: Record<string, SeatLayout> = {
  BTN: { seat: [50, 82], bet: [50, 60], dealerButton: [58, 79] },
  SB: { seat: [18, 26], bet: [36, 41] },
  BB: { seat: [82, 26], bet: [64, 41] },
};

const SEATS_HU: Record<string, SeatLayout> = {
  SB: { seat: [50, 82], bet: [50, 61], dealerButton: [58, 79] },
  BB: { seat: [50, 18], bet: [50, 39] },
};

const ACTION_LABELS: Record<string, string> = {
  call: 'Call',
  raise: 'Raise',
  jam: 'Jam',
  open: 'Open',
};

export default function PokerTable({ format, actingPosition, history, effectiveStackBb }: Props) {
  const positions = format === '3max' ? ['BTN', 'SB', 'BB'] : ['SB', 'BB'];
  const seatCoords = format === '3max' ? SEATS_3MAX : SEATS_HU;

  const positionActions = new Map<string, string>();
  for (const entry of history) {
    positionActions.set(entry.position, entry.action);
  }

  return (
    <div className="relative mx-auto h-[28vh] min-h-40 max-h-56 w-full max-w-sm" role="img" aria-label="Poker table">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-[72%] w-[84%] rounded-full border border-emerald-100 bg-emerald-50/40" />
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
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-gray-500"
                style={{
                  left: `${seat.bet[0]}%`,
                  top: `${seat.bet[1]}%`,
                }}
              >
                {ACTION_LABELS[action] ?? action}
              </div>
            )}

            <div
               className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-[11px] font-semibold ${
                  isActing
                    ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                    : 'bg-white text-gray-700 ring-1 ring-gray-200'
                }`}
                style={{ left: `${seat.seat[0]}%`, top: `${seat.seat[1]}%` }}
              >
                {pos}
              </div>

              <div
                className="absolute -translate-x-1/2 text-[10px] text-gray-500"
                style={{ left: `${seat.seat[0]}%`, top: `${seat.seat[1] + 8}%` }}
              >
                {effectiveStackBb}bb
              </div>

              {seat.dealerButton && pos === (format === '3max' ? 'BTN' : 'SB') && (
                <div
                  className="absolute flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-amber-100 text-[9px] font-bold text-amber-700"
                  style={{ left: `${seat.dealerButton[0]}%`, top: `${seat.dealerButton[1]}%` }}
                >
                  D
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
