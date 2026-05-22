import { useMemo } from 'react';
import { Action } from '@/domain/types';
import { ReviewHandResult } from '@/components/ReviewHand';

type Props = {
  items: ReviewHandResult[];
  onRestart: () => void;
};

const ACTION_LABELS: Record<Action, string> = {
  fold: 'Fold',
  call: 'Call',
  raise: 'Raise',
  jam: 'Jam',
};

export default function ReviewSummary({ items, onRestart }: Props) {
  const scored = items.filter((item) => item.hadChart);
  const correct = scored.filter((item) => item.isCorrect).length;
  const total = scored.length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const noChart = items.length - scored.length;

  const errors = useMemo(
    () => scored.filter((item) => !item.isCorrect),
    [scored]
  );

  const gradeColor = accuracy >= 80 ? 'text-green-600' : accuracy >= 50 ? 'text-amber-600' : 'text-red-600';
  const gradeLabel = accuracy >= 80 ? 'Great' : accuracy >= 50 ? 'Okay' : 'Needs work';

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center pb-[env(safe-area-inset-bottom)]">
      {/* Score circle */}
      <div className="flex flex-col items-center gap-2">
        <div className={`text-5xl font-bold ${gradeColor}`}>
          {accuracy}%
        </div>
        <div className={`text-sm font-semibold ${gradeColor}`}>{gradeLabel}</div>
        <div className="text-xs text-gray-500">
          {correct}/{total} correct · {noChart} skipped (no chart)
        </div>
      </div>

      {/* Error list */}
      {errors.length > 0 && (
        <div className="mt-6 w-full rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Mistakes ({errors.length})</h3>
          <div className="max-h-60 space-y-2 overflow-auto">
            {errors.map((item) => (
              <div
                key={item.handId}
                className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm"
              >
                <span className="text-gray-700">#{item.handId}</span>
                <div className="flex items-center gap-2 text-xs">
                  {item.selectedAction && (
                    <span className="text-red-600 font-medium">
                      {ACTION_LABELS[item.selectedAction]}
                    </span>
                  )}
                  {item.heroAction && item.heroAction !== item.selectedAction && (
                    <span className="text-gray-400">
                      (played {ACTION_LABELS[item.heroAction]})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats breakdown */}
      <div className="mt-4 w-full rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-green-600">{correct}</div>
            <div className="text-[10px] text-gray-500">Correct</div>
          </div>
          <div>
            <div className="text-lg font-bold text-red-600">{errors.length}</div>
            <div className="text-[10px] text-gray-500">Wrong</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-400">{noChart}</div>
            <div className="text-[10px] text-gray-500">No chart</div>
          </div>
        </div>
      </div>

      {/* Restart */}
      <button
        type="button"
        onClick={onRestart}
        className="mt-6 w-full rounded-xl bg-gray-900 py-3.5 text-base font-bold text-white active:scale-95"
      >
        New Review
      </button>
    </div>
  );
}