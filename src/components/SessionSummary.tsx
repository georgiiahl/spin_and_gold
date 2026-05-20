import { Link } from 'react-router-dom';
import { Action } from '@/domain/types';

type MistakeItem = {
  id: string;
  hand: string;
  spotTitle: string;
  expectedAction: Action;
  errorType?: string;
};

type Props = {
  totalCardsReviewed: number;
  accuracyPercent: number;
  depthConfusions: number;
  wrongCount: number;
  avgResponseMs: number;
  levelBefore: number;
  levelAfter: number;
  mistakes: MistakeItem[];
  onStartFixMistakes: () => void;
  complete: boolean;
};

export default function SessionSummary({
  totalCardsReviewed,
  accuracyPercent,
  depthConfusions,
  wrongCount,
  avgResponseMs,
  levelBefore,
  levelAfter,
  mistakes,
  onStartFixMistakes,
  complete,
}: Props) {
  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-xl font-bold">Session Summary</h2>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>Total cards reviewed: {totalCardsReviewed}</div>
        <div>Accuracy: {accuracyPercent}%</div>
        <div>Depth confusions: {depthConfusions}</div>
        <div>Wrong: {wrongCount}</div>
        <div>Avg response: {(avgResponseMs / 1000).toFixed(1)}s</div>
        <div>Category level: {levelBefore} → {levelAfter}</div>
      </div>

      {mistakes.length > 0 && !complete && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="font-semibold">Fix Mistakes ({mistakes.length})</div>
          <ul className="mt-2 space-y-1 text-sm">
            {mistakes.map((mistake) => (
              <li key={mistake.id}>
                {mistake.hand} · {mistake.spotTitle} · {mistake.expectedAction}
                {mistake.errorType === 'depth_confusion' ? ' (depth confusion)' : ''}
              </li>
            ))}
          </ul>
          <button
            onClick={onStartFixMistakes}
            className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Fix Mistakes
          </button>
        </div>
      )}

      {complete && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">
          Session Complete ✓
        </div>
      )}

      <div className="mt-4 flex gap-3 text-sm">
        <Link to="/" className="text-blue-600 hover:text-blue-500">
          Back to dashboard
        </Link>
        {!complete && (
          <Link to="/" className="text-gray-500 hover:text-gray-700">
            Skip → Home
          </Link>
        )}
      </div>
    </div>
  );
}
