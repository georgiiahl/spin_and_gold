import { GameFormat, HistoryEntry } from '@/domain/types';

type Props = {
  format: GameFormat;
  actingPosition: string;
  history: HistoryEntry[];
  effectiveStackBb: number;
  hand?: string;
};

// [left%, top%] relative to container
const SEATS_3MAX: Record<string, [number, number]> = {
  BTN: [50, 84],
  SB: [12, 22],
  BB: [88, 22],
};

const SEATS_HU: Record<string, [number, number]> = {
  SB: [50, 84],
  BB: [50, 10],
};

const ACTION_BADGE_BG: Record<string, string> = {
  fold: 'bg-fold',
  call: 'bg-call',
  raise: 'bg-raise',
  jam: 'bg-jam',
  open: 'bg-raise',
};

export default function PokerTable({ format, actingPosition, history, effectiveStackBb, hand }: Props) {
  const positions = format === '3max' ? ['BTN', 'SB', 'BB'] : ['SB', 'BB'];
  const seatCoords = format === '3max' ? SEATS_3MAX : SEATS_HU;

  // Build position → last action map from history
  const positionActions = new Map<string, string>();
  for (const entry of history) {
    positionActions.set(entry.position, entry.action);
  }

  return (
    <div className="relative w-full" style={{ paddingBottom: '52%' }}>
      {/* Felt surface */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[72%] h-[70%] bg-green-900/80 border-4 border-yellow-700/50 rounded-full shadow-inner" />
      </div>

      {/* Center info: stack depth + hand */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <div className="text-xs text-gray-400 font-medium leading-none">{effectiveStackBb}bb</div>
          {hand && (
            <div className="text-3xl font-bold text-white mt-0.5 leading-tight drop-shadow">{hand}</div>
          )}
        </div>
      </div>

      {/* Seats */}
      {positions.map((pos) => {
        const [left, top] = seatCoords[pos];
        const isActing = pos === actingPosition;
        const action = positionActions.get(pos);

        return (
          <div
            key={pos}
            className="absolute flex flex-col items-center gap-0.5"
            style={{ left: `${left}%`, top: `${top}%`, transform: 'translate(-50%, -50%)' }}
          >
            {/* Action chip (shown above seat) */}
            {action && (
              <div
                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase text-white ${ACTION_BADGE_BG[action] ?? 'bg-gray-600'}`}
              >
                {action}
              </div>
            )}

            {/* Seat circle */}
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 select-none ${
                isActing
                  ? 'bg-blue-600 border-blue-300 text-white ring-2 ring-blue-400/40'
                  : 'bg-gray-700 border-gray-500 text-gray-200'
              }`}
            >
              {pos}
            </div>

            {/* "YOU" label under acting seat */}
            {isActing && (
              <div className="text-[10px] text-blue-400 font-semibold tracking-wide">YOU</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
