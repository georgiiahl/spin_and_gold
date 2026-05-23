import { useState, useCallback, useRef } from 'react';
import { HAND_MATRIX } from '@/domain/hands';
import { Action, HandFrequencies } from '@/domain/types';

type Props = {
  range: Record<string, HandFrequencies>;
  onCellAction?: (hand: string, action: Action) => void;
  onCellClick?: (hand: string) => void;
  getCellClassName?: (hand: string, freq: HandFrequencies | undefined) => string;
  activeAction: Action;
  mode: 'simple' | 'frequency';
  readOnly?: boolean;
  compact?: boolean;
};

const ACTION_COLORS: Record<Action, string> = {
  fold: 'bg-fold',
  call: 'bg-call',
  raise: 'bg-raise',
  jam: 'bg-jam',
};
const DEFAULT_CELL_TEXT_CLASS = 'text-[8px] sm:text-[10px]';
const COMPACT_CELL_TEXT_CLASS = 'text-[7px] sm:text-[8px]';

function getCellColor(freq: HandFrequencies | undefined): string {
  if (!freq) return 'bg-gray-100';
  // Find dominant action
  const entries: [Action, number][] = [
    ['fold', freq.fold],
    ['call', freq.call],
    ['raise', freq.raise],
    ['jam', freq.jam],
  ];
  const max = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  if (max[1] === 0) return 'bg-gray-100';

  // Check if mixed
  const nonZero = entries.filter(([, v]) => v > 0);
  if (nonZero.length > 1) {
    // Gradient-like: use dominant color with reduced opacity via lighter variant
    return ACTION_COLORS[max[0]] + '/70';
  }
  return ACTION_COLORS[max[0]];
}

function getCellStyle(freq: HandFrequencies | undefined): React.CSSProperties {
  if (!freq) return {};
  const entries: [Action, number][] = [
    ['fold', freq.fold],
    ['call', freq.call],
    ['raise', freq.raise],
    ['jam', freq.jam],
  ];
  const nonZero = entries.filter(([, v]) => v > 0);
  if (nonZero.length <= 1) return {};

  // Multi-color: create linear gradient
  const colorMap: Record<Action, string> = {
    fold: '#6b7280',
    call: '#22c55e',
    raise: '#ef4444',
    jam: '#a855f7',
  };
  let offset = 0;
  const stops: string[] = [];
  for (const [action, pct] of nonZero) {
    const end = offset + pct * 100;
    stops.push(`${colorMap[action]} ${offset}% ${end}%`);
    offset = end;
  }
  return { background: `linear-gradient(135deg, ${stops.join(', ')})` };
}

export default function RangeMatrix({
  range,
  onCellAction,
  onCellClick,
  getCellClassName,
  activeAction,
  mode,
  readOnly,
  compact = false,
}: Props) {
  const [isPainting, setIsPainting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback(
    (hand: string) => {
      if (readOnly) {
        onCellClick?.(hand);
        return;
      }
      if (mode === 'frequency') {
        onCellClick?.(hand);
        return;
      }
      setIsPainting(true);
      onCellAction?.(hand, activeAction);
    },
    [activeAction, mode, readOnly, onCellAction, onCellClick]
  );

  const handlePointerEnter = useCallback(
    (hand: string) => {
      if (readOnly || mode === 'frequency' || !isPainting) return;
      onCellAction?.(hand, activeAction);
    },
    [isPainting, activeAction, mode, readOnly, onCellAction]
  );

  const handlePointerUp = useCallback(() => {
    setIsPainting(false);
  }, []);

  return (
    <div
      className="aspect-square w-full max-w-full"
    >
      <div
        ref={containerRef}
        className="grid h-full w-full grid-cols-13 gap-[1px] select-none touch-none"
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {HAND_MATRIX.map((row, r) =>
          row.map((hand, c) => {
            const freq = range[hand];
            const baseColor = getCellColor(freq);
            const style = getCellStyle(freq);
            const hasMix = freq && Object.values(freq).filter((v) => v > 0).length > 1;
            const shouldHandlePointerDown = !readOnly || Boolean(onCellClick);

            return (
              <div
                key={`${r}-${c}`}
                className={`aspect-square flex items-center justify-center ${compact ? COMPACT_CELL_TEXT_CLASS : DEFAULT_CELL_TEXT_CLASS} font-medium rounded-[2px]
                ${readOnly ? 'cursor-default' : 'cursor-pointer'}
                ${!style.background ? baseColor : ''}
                ${hasMix ? 'ring-1 ring-white/40' : ''}
                ${getCellClassName?.(hand, freq) ?? ''}
                ${readOnly ? '' : 'hover:brightness-125'} transition-all`}
                style={style.background ? style : undefined}
                onPointerDown={shouldHandlePointerDown ? () => handlePointerDown(hand) : undefined}
                onPointerEnter={readOnly ? undefined : () => handlePointerEnter(hand)}
              >
                <span className={freq ? 'text-white' : 'text-gray-500'}>{hand}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
