import { useState, useCallback, useRef, KeyboardEvent } from 'react';
import { HAND_MATRIX } from '@/domain/hands';
import { Action, HandFrequencies } from '@/domain/types';

type Props = {
  range: Record<string, HandFrequencies>;
  onCellAction: (hand: string, action: Action) => void;
  onCellClick?: (hand: string) => void;
  getCellClassName?: (hand: string, freq: HandFrequencies | undefined) => string;
  activeAction: Action;
  mode: 'simple' | 'frequency';
  readOnly?: boolean;
};

const ACTION_COLORS: Record<Action, string> = {
  fold: 'bg-fold',
  call: 'bg-call',
  raise: 'bg-raise',
  jam: 'bg-jam',
};

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
    fold: '#ef4444',
    call: '#3b82f6',
    raise: '#f59e0b',
    jam: '#8b5cf6',
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

export default function RangeMatrix({ range, onCellAction, onCellClick, getCellClassName, activeAction, mode, readOnly }: Props) {
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
      onCellAction(hand, activeAction);
    },
    [activeAction, mode, readOnly, onCellAction, onCellClick]
  );

  const handlePointerEnter = useCallback(
    (hand: string) => {
      if (readOnly || mode === 'frequency' || !isPainting) return;
      onCellAction(hand, activeAction);
    },
    [isPainting, activeAction, mode, readOnly, onCellAction]
  );

  const handlePointerUp = useCallback(() => {
    setIsPainting(false);
  }, []);

  const handleCellKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    const target = event.currentTarget;
    const row = Number(target.dataset.row);
    const col = Number(target.dataset.col);
    let nextRow = row;
    let nextCol = col;

    if (event.key === 'ArrowUp') nextRow = Math.max(0, row - 1);
    else if (event.key === 'ArrowDown') nextRow = Math.min(12, row + 1);
    else if (event.key === 'ArrowLeft') nextCol = Math.max(0, col - 1);
    else if (event.key === 'ArrowRight') nextCol = Math.min(12, col + 1);
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const hand = target.dataset.hand;
      if (!hand) return;
      if (readOnly || mode === 'frequency') {
        onCellClick?.(hand);
      } else {
        onCellAction(hand, activeAction);
      }
      return;
    } else {
      return;
    }

    event.preventDefault();
    const next = containerRef.current?.querySelector<HTMLButtonElement>(`button[data-row="${nextRow}"][data-col="${nextCol}"]`);
    next?.focus();
  }, [activeAction, mode, onCellAction, onCellClick, readOnly]);

  return (
    <div
      ref={containerRef}
      className="grid grid-cols-13 gap-[1px] select-none touch-none"
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {HAND_MATRIX.map((row, r) =>
        row.map((hand, c) => {
          const freq = range[hand];
          const baseColor = getCellColor(freq);
          const style = getCellStyle(freq);
          const hasMix = freq && Object.values(freq).filter((v) => v > 0).length > 1;

          return (
            <button
              type="button"
              key={`${r}-${c}`}
              className={`aspect-square flex items-center justify-center text-[8px] sm:text-[10px] font-medium rounded-[2px] cursor-pointer
                ${!style.background ? baseColor : ''}
                ${hasMix ? 'ring-1 ring-white/40' : ''}
                ${getCellClassName?.(hand, freq) ?? ''}
                hover:brightness-125 transition-all focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900`}
              style={style.background ? style : undefined}
              data-row={r}
              data-col={c}
              data-hand={hand}
              tabIndex={0}
              aria-disabled={readOnly && !onCellClick}
              aria-label={
                readOnly
                  ? `${hand} range cell`
                  : mode === 'frequency'
                    ? `Edit ${hand} frequencies`
                    : `Set ${hand} to ${activeAction}`
              }
              onPointerDown={() => handlePointerDown(hand)}
              onPointerEnter={() => handlePointerEnter(hand)}
              onKeyDown={handleCellKeyDown}
            >
              <span className={freq ? 'text-white' : 'text-gray-500'}>{hand}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
