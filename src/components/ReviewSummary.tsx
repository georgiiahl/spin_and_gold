import { useMemo, useState } from 'react';

export type ReviewSummaryItem = {
  handId: string;
  matchedSpotId: string | null;
  hadChart: boolean;
  isCorrect: boolean;
  errorType: 'wrong_action' | null;
};

type Props = {
  items: ReviewSummaryItem[];
  onRestart: () => void;
};

export default function ReviewSummary({ items, onRestart }: Props) {
  const [selectedHandId, setSelectedHandId] = useState<string | null>(null);

  const scored = items.filter((item) => item.hadChart);
  const correct = scored.filter((item) => item.isCorrect).length;
  const wrong = scored.filter((item) => !item.isCorrect).length;
  const noChart = items.length - scored.length;

  const errors = useMemo(
    () => items.filter((item) => item.errorType !== null),
    [items]
  );
  const selected = errors.find((item) => item.handId === selectedHandId) ?? null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Review Summary</h2>
        <p className="mt-2 text-sm text-gray-700">
          Score: <span className="font-semibold">{correct}/{scored.length}</span>
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
        <h3 className="font-semibold">Error breakdown</h3>
        <div className="mt-2 space-y-1 text-gray-700">
          <p>Wrong action: {wrong}</p>
          <p>No chart available: {noChart}</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="font-semibold">Errors</h3>
        {errors.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No errors.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {errors.map((item) => (
              <button
                key={item.handId}
                type="button"
                onClick={() => setSelectedHandId(item.handId)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm text-gray-700"
              >
                Hand #{item.handId} · {item.errorType}
              </button>
            ))}
          </div>
        )}
        {selected && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Hand #{selected.handId} · {selected.errorType}
            {selected.matchedSpotId ? ` · Spot ${selected.matchedSpotId}` : ''}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onRestart}
        className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-500"
      >
        Start new review
      </button>
    </div>
  );
}
