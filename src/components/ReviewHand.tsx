import { useMemo, useState } from 'react';
import { Action, HandFrequencies, SpotRange } from '@/domain/types';
import { HandVerdict } from '@/domain/hhReview';
import { MatchedSpot } from '@/domain/hhSpotMatcher';
import PokerTable, { SeatDetail } from '@/components/PokerTable';
import RangeMatrix from '@/components/RangeMatrix';

export type ReviewHandResult = {
  handId: string;
  matchedSpotId: string | null;
  hadChart: boolean;
  isCorrect: boolean;
  heroAction: Action | null;
  selectedAction: Action | null;
  errorType: 'wrong_action' | null;
};

type Props = {
  matched: MatchedSpot;
  verdict: HandVerdict | null;
  rangeForSpot: SpotRange | undefined;
  index: number;
  total: number;
  onNext: (result: ReviewHandResult) => void;
};

const ACTIONS: Action[] = ['fold', 'call', 'raise', 'jam'];

const ACTION_LABELS: Record<Action, string> = {
  fold: 'Fold',
  call: 'Call',
  raise: 'Raise',
  jam: 'Jam',
};

const ACTION_BUTTON_CLASSES: Record<Action, string> = {
  fold: 'bg-fold',
  call: 'bg-call',
  raise: 'bg-raise',
  jam: 'bg-jam',
};

const ACTION_BAR_COLORS: Record<Action, string> = {
  fold: 'bg-red-500',
  call: 'bg-blue-500',
  raise: 'bg-amber-500',
  jam: 'bg-violet-500',
};

const ACTION_TEXT_CLASSES: Record<Action, string> = {
  fold: 'text-red-300',
  call: 'text-blue-300',
  raise: 'text-amber-300',
  jam: 'text-violet-300',
};

type Phase = 'decide' | 'result';

export default function ReviewHand({ matched, verdict, rangeForSpot, index, total, onNext }: Props) {
  const [phase, setPhase] = useState<Phase>('decide');
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [showChart, setShowChart] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const hand = matched.hand;

  const seatDetails = useMemo<Partial<Record<string, SeatDetail>>>(() => {
    const bb = hand.blinds.bb || 1;
    const details: Partial<Record<string, SeatDetail>> = {};
    for (const seat of hand.seats) {
      details[seat.position] = {
        name: seat.isHero ? 'Hero' : seat.name.slice(0, 8),
        chips: seat.chips,
        stackBb: Math.round((seat.chips / bb) * 10) / 10,
        isHero: seat.isHero,
      };
    }
    return details;
  }, [hand.seats, hand.blinds.bb]);

  const levelLabel = `Level ${hand.blinds.sb}/${hand.blinds.bb}`;

  // Determine correctness of the selected action
  const isSelectedCorrect = useMemo(() => {
    if (!selectedAction || !verdict) return false;
    return verdict.correctActions.includes(selectedAction);
  }, [selectedAction, verdict]);

  // What hero actually played in the hand
  const heroPlayedAction = hand.heroAction?.action ?? null;

  function handleActionPick(action: Action) {
    if (phase !== 'decide') return;
    setSelectedAction(action);
    setPhase('result');
  }

  function handleRetry() {
    setPhase('decide');
    setSelectedAction(null);
    setRetryCount((c) => c + 1);
  }

  function handleShowHint() {
    if (!verdict) return;
    // Pick the primary action as hint
    setSelectedAction(verdict.primaryAction);
    setPhase('result');
  }

  function handleNext() {
    onNext({
      handId: hand.handId,
      matchedSpotId: matched.matchedSpotId,
      hadChart: Boolean(verdict),
      isCorrect: isSelectedCorrect,
      heroAction: heroPlayedAction,
      selectedAction,
      errorType: verdict && !isSelectedCorrect ? 'wrong_action' : null,
    });
    // Reset for next hand (component will be re-rendered with new props anyway)
    setPhase('decide');
    setSelectedAction(null);
    setShowChart(false);
    setRetryCount(0);
  }

  const progressPct = total > 0 ? ((index + 1) / total) * 100 : 0;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col pb-[env(safe-area-inset-bottom)]">
      {/* Progress bar */}
      <div className="py-2">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>{index + 1}/{total}</span>
          <span>{matched.spotType.replace('_', ' ')} · {matched.effectiveStackBb}bb</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <PokerTable
          format={hand.format}
          actingPosition={matched.actingPosition}
          history={matched.history}
          effectiveStackBb={matched.effectiveStackBb}
          exactCards={hand.heroCards ?? undefined}
          seatDetails={seatDetails}
          levelLabel={levelLabel}
        />

        {/* Frequency bar — revealed only after answer */}
        <div className="mt-4 w-full">
          <div className="relative h-6 w-full overflow-hidden rounded-full bg-gray-100 ring-1 ring-gray-200">
            {verdict && phase === 'result' && (
              <div className="absolute inset-0 flex">
                {ACTIONS.filter((a) => verdict.frequencies[a] > 0).map((a) => (
                  <div
                    key={a}
                    className={`${ACTION_BAR_COLORS[a]} h-full transition-all duration-700 ease-out`}
                    style={{ width: `${verdict.frequencies[a] * 100}%` }}
                  />
                ))}
              </div>
            )}
            {verdict && phase === 'result' && selectedAction && (
              <div
                className="absolute top-0 h-full w-0.5 bg-white shadow transition-all duration-500"
                style={{ left: `${getBarPosition(verdict.frequencies, selectedAction)}%` }}
              >
                <div className={`absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full ring-2 ring-white ${isSelectedCorrect ? 'bg-green-500' : 'bg-red-500'}`} />
                <div className={`absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full ring-2 ring-white ${isSelectedCorrect ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
            )}
          </div>
          {verdict && phase === 'result' && (
            <div className="mt-1 flex justify-between text-[10px]">
              {ACTIONS.filter((a) => verdict.frequencies[a] > 0).map((a) => (
                <span key={a} className={`${ACTION_TEXT_CLASSES[a]} font-medium`}>
                  {ACTION_LABELS[a]} {(verdict.frequencies[a] * 100).toFixed(0)}%
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action / Feedback area */}
        <div className="mt-4 min-h-[130px] w-full">
          {/* DECIDE phase: player picks action */}
          {phase === 'decide' && (
            <div className="flex h-full flex-col justify-center">
              {!verdict ? (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-center text-sm text-yellow-800">
                  No chart for this spot. 
                  <button
                    onClick={handleNext}
                    className="ml-2 font-semibold text-yellow-900 underline"
                  >
                    Skip →
                  </button>
                </div>
              ) : (
                <>
                  {retryCount > 0 && (
                    <p className="mb-2 text-center text-xs text-gray-500">Try again:</p>
                  )}
                  <div className="flex gap-3" role="group" aria-label="Action buttons">
                    {ACTIONS.map((action) => (
                      <button
                        key={action}
                        onClick={() => handleActionPick(action)}
                        aria-label={ACTION_LABELS[action]}
                        className={`flex-1 rounded-xl ${ACTION_BUTTON_CLASSES[action]} py-4 text-base font-bold text-white active:scale-95`}
                      >
                        {ACTION_LABELS[action]}
                      </button>
                    ))}
                  </div>
                  {retryCount === 0 && (
                    <button
                      onClick={handleShowHint}
                      aria-label="Show answer"
                      className="mt-3 w-full text-center text-xs text-gray-400 hover:text-gray-600"
                    >
                      Show answer
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* RESULT phase */}
          {phase === 'result' && verdict && (
            <div className="flex h-full flex-col justify-center space-y-3">
              {/* Verdict indicator */}
              <div className="flex items-center justify-center gap-2">
                <span className={`text-xl font-bold ${isSelectedCorrect ? 'text-green-600' : 'text-red-600'}`}>
                  {isSelectedCorrect ? '✓' : '✗'}
                </span>
                {selectedAction && (
                  <span className={`text-sm font-semibold ${isSelectedCorrect ? 'text-green-700' : 'text-red-700'}`}>
                    {ACTION_LABELS[selectedAction]}
                  </span>
                )}
              </div>

              {/* What hero actually played vs what we picked */}
              {heroPlayedAction && heroPlayedAction !== selectedAction && (
                <div className="text-center text-xs text-gray-500">
                  In game Hero played: <span className="font-semibold">{ACTION_LABELS[heroPlayedAction]}</span>
                </div>
              )}

              {/* Retry / Chart / Next buttons */}
              <div className="flex gap-2">
                {!isSelectedCorrect && (
                  <button
                    onClick={handleRetry}
                    aria-label="Retry hand"
                    className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 active:scale-95"
                  >
                    Retry
                  </button>
                )}
                <button
                  onClick={() => setShowChart(!showChart)}
                  aria-label={showChart ? 'Hide chart' : 'Show chart'}
                  className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 active:scale-95"
                >
                  {showChart ? 'Hide chart' : 'Chart'}
                </button>
                <button
                  onClick={handleNext}
                  aria-label="Next hand"
                  className="flex-1 rounded-xl bg-gray-900 py-3 text-sm font-bold text-white active:scale-95"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart modal — shown inline below */}
      {showChart && rangeForSpot && (
        <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-500 mb-2">Full range chart for this spot</div>
          <RangeMatrix
            range={rangeForSpot}
            onCellAction={() => {}}
            activeAction="fold"
            mode="simple"
            readOnly
          />
        </div>
      )}
    </div>
  );
}

function getBarPosition(freq: HandFrequencies, action: Action): number {
  let position = 0;
  for (const a of ACTIONS) {
    if (freq[a] <= 0) continue;
    if (a === action) return position + (freq[a] * 100) / 2;
    position += freq[a] * 100;
  }
  return position;
}