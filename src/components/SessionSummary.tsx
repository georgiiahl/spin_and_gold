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
  onTrainAgain: () => void;
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
  onTrainAgain,
  complete,
}: Props) {
  const hasNoCards = totalCardsReviewed === 0;
  const levelChanged = levelBefore !== levelAfter;

  // Empty session — no due cards were available
  if (hasNoCards && complete) {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-xl font-bold">All caught up ✓</h2>
        <p className="mb-4 text-sm text-gray-600">
          No cards are due right now. You can train all cards anyway to keep sharp.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onTrainAgain}
            className="w-full rounded-xl bg-blue-600 py-4 text-lg font-bold text-white transition-transform hover:bg-blue-500 active:scale-95"
          >
            Train anyway (all cards)
          </button>
          <Link to="/" className="block text-center text-sm text-gray-500 hover:text-gray-900">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-xl font-bold">Session Summary</h2>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>Cards reviewed: <span className="font-semibold">{totalCardsReviewed}</span></div>
        <div>Accuracy: <span className="font-semibold">{accuracyPercent}%</span></div>
        <div>Depth confusions: <span className="font-semibold">{depthConfusions}</span></div>
        <div>Wrong: <span className="font-semibold">{wrongCount}</span></div>
        <div>Avg response: <span className="font-semibold">{(avgResponseMs / 1000).toFixed(1)}s</span></div>
        <div>
          Level:{' '}
          <span className="font-semibold">
            {levelChanged ? (
              <>{levelBefore} → {levelAfter} {levelAfter > levelBefore ? '🎉' : ''}</>
            ) : (
              <>{levelBefore} (no change)</>
            )}
          </span>
        </div>
      </div>

      {mistakes.length > 0 && !complete && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="font-semibold">Fix Mistakes ({mistakes.length})</div>
          <ul className="mt-2 space-y-1 text-sm">
            {mistakes.map((mistake) => (
              <li key={mistake.id}>
                <span className="font-medium">{mistake.hand}</span> · {mistake.spotTitle} → {mistake.expectedAction}
                {mistake.errorType === 'depth_confusion' && (
                  <span className="ml-1 rounded bg-amber-200 px-1 text-xs text-amber-800">depth</span>
                )}
              </li>
            ))}
          </ul>
          <button
            onClick={onStartFixMistakes}
            className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Fix Mistakes →
          </button>
        </div>
      )}

      {complete && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center text-emerald-700 font-semibold">
          Session Complete ✓
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <button
          onClick={onTrainAgain}
          className="w-full rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition"
        >
          Train again (all cards)
        </button>
        <div className="flex justify-center gap-3 text-sm">
          <Link to="/" className="text-blue-600 hover:text-blue-500">
            Back to dashboard
          </Link>
          {!complete && mistakes.length > 0 && (
            <Link to="/" className="text-gray-400 hover:text-gray-600">
              Skip mistakes → Home
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
