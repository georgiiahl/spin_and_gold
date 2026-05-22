import { useMemo, useState } from 'react';
import { Action } from '@/domain/types';
import { HandVerdict } from '@/domain/hhReview';
import { MatchedSpot } from '@/domain/hhSpotMatcher';

type ReviewHandResult = {
  handId: string;
  matchedSpotId: string | null;
  hadChart: boolean;
  isCorrect: boolean;
  errorType: 'wrong_action' | null;
};

type Props = {
  matched: MatchedSpot;
  verdict: HandVerdict | null;
  onNext: (result: ReviewHandResult) => void;
};

const ACTIONS: Action[] = ['fold', 'call', 'raise', 'jam'];

export default function ReviewHand({ matched, verdict, onNext }: Props) {
  const [retryComplete, setRetryComplete] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [pickedRetryAction, setPickedRetryAction] = useState<Action | null>(null);
  const hand = matched.hand;
  const heroName = hand.seats.find((seat) => seat.isHero)?.name ?? 'Hero';
  const heroActionIndex = hand.preflopActions.findIndex((action) => action.player === heroName);
  const preHeroActions = heroActionIndex >= 0 ? hand.preflopActions.slice(0, heroActionIndex) : hand.preflopActions;

  const canProceed = !verdict || verdict.isCorrect || retryComplete;
  const heroCardsText = hand.heroCards ? hand.heroCards.join(' ') : 'N/A';

  const frequencyText = useMemo(() => {
    if (!verdict) return null;
    return ACTIONS
      .filter((action) => verdict.frequencies[action] > 0)
      .map((action) => `${action.toUpperCase()} ${(verdict.frequencies[action] * 100).toFixed(0)}%`)
      .join(' · ');
  }, [verdict]);

  function handleRetryPick(action: Action) {
    if (!verdict || verdict.isCorrect) return;
    setPickedRetryAction(action);
    if (verdict.correctActions.includes(action)) {
      setRetryComplete(true);
      setRetryError(null);
      return;
    }
    setRetryError('Try again: choose one of the chart actions.');
  }

  function handleNext() {
    onNext({
      handId: hand.handId,
      matchedSpotId: matched.matchedSpotId,
      hadChart: Boolean(verdict),
      isCorrect: verdict?.isCorrect ?? false,
      errorType: verdict && !verdict.isCorrect ? 'wrong_action' : null,
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-sm text-gray-500">Hand #{hand.handId}</div>
        <div className="mt-1 text-sm text-gray-700">
          Blinds: {hand.blinds.sb}/{hand.blinds.bb} · Spot: {matched.spotType} · Stack: {matched.effectiveStackBb}bb
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="font-semibold">Table</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {hand.seats.map((seat) => (
            <div
              key={`${seat.position}-${seat.name}`}
              className={`rounded-lg border p-2 text-sm ${seat.isHero ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}
            >
              <div className="font-semibold">{seat.position}</div>
              <div>{seat.name}{seat.isHero ? ' (Hero)' : ''}</div>
              <div className="text-gray-600">{seat.chips} chips</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="font-semibold">Preflop before Hero</h2>
        {preHeroActions.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No actions before Hero.</p>
        ) : (
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-700">
            {preHeroActions.map((action, index) => (
              <li key={`${action.player}-${index}`}>
                {formatAction(action)}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="font-semibold">Hero turn</h2>
        <div className="mt-2 text-sm text-gray-700">Cards: {heroCardsText}</div>
        <div className="mt-1 text-sm text-gray-700">
          Played: {hand.heroAction ? hand.heroAction.action.toUpperCase() : 'N/A'}
        </div>
      </div>

      <div className={`rounded-lg border p-4 ${!verdict ? 'border-yellow-200 bg-yellow-50' : verdict.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        {!verdict && (
          <p className="text-sm font-medium text-yellow-800">No chart available for this hand.</p>
        )}
        {verdict && verdict.isCorrect && (
          <p className="text-sm font-semibold text-green-700">✅ Correct decision.</p>
        )}
        {verdict && !verdict.isCorrect && (
          <div className="space-y-2 text-sm text-red-800">
            <p className="font-semibold">❌ Wrong decision.</p>
            <p>Hero did: {verdict.heroAction.toUpperCase()}</p>
            <p>Correct: {verdict.correctActions.map((action) => action.toUpperCase()).join(', ')}</p>
            {frequencyText && <p>Frequencies: {frequencyText}</p>}
          </div>
        )}
      </div>

      {verdict && !verdict.isCorrect && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="font-semibold">Retry</h3>
          <p className="mt-1 text-sm text-gray-600">
            Choose the correct action to continue.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ACTIONS.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => handleRetryPick(action)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                  pickedRetryAction === action ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-700'
                }`}
              >
                {action.toUpperCase()}
              </button>
            ))}
          </div>
          {retryError && <p className="mt-2 text-sm text-red-600">{retryError}</p>}
          {retryComplete && <p className="mt-2 text-sm text-green-600">Great. Retry accepted.</p>}
        </div>
      )}

      <button
        type="button"
        onClick={handleNext}
        disabled={!canProceed}
        className="w-full rounded-lg bg-gray-900 py-3 text-sm font-semibold text-white disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
  function formatAction(action: { position: string; player: string; action: string; amount?: number }) {
    const prefix = action.position ? `${action.position} ` : '';
    const amount = action.amount != null ? ` ${action.amount}` : '';
    return `${prefix}${action.player}: ${action.action}${amount}`;
  }
