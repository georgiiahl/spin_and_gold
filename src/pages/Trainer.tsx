import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Action, HandFrequencies, SpotRange, Spot, SessionAnswer } from '@/domain/types';
import { ALL_HANDS } from '@/domain/hands';
import { getSpot } from '@/storage/spots';
import { getRange } from '@/storage/ranges';
import { saveSession } from '@/storage/sessions';

const ACTION_LABELS: Record<Action, string> = {
  fold: 'Fold',
  call: 'Call',
  raise: 'Raise',
  jam: 'Jam',
};

const ACTIONS: Action[] = ['fold', 'call', 'raise', 'jam'];

type FeedbackState = {
  isCorrect: boolean;
  isMixedCorrect: boolean;
  selectedAction: Action;
  correctActions: Action[];
  primaryAction: Action;
  frequencies: HandFrequencies;
} | null;

export default function Trainer() {
  const { id } = useParams<{ id: string }>();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [range, setRange] = useState<SpotRange | null>(null);
  const [trainableHands, setTrainableHands] = useState<string[]>([]);
  const [currentHand, setCurrentHand] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!id) return;
    Promise.all([getSpot(id), getRange(id)]).then(([s, r]) => {
      if (s) setSpot(s);
      if (r) {
        setRange(r);
        // Only train hands that have at least one non-zero action
        const hands = ALL_HANDS.filter((h) => {
          const f = r[h];
          return f && (f.fold + f.call + f.raise + f.jam) > 0;
        });
        setTrainableHands(hands);
      }
    });
  }, [id]);

  useEffect(() => {
    if (trainableHands.length > 0 && !currentHand && !feedback) {
      pickNextHand();
    }
  }, [trainableHands]);

  function pickNextHand() {
    if (trainableHands.length === 0) return;
    // Simple random for now (priority engine comes in Étap 5)
    const idx = Math.floor(Math.random() * trainableHands.length);
    setCurrentHand(trainableHands[idx]);
    startTimeRef.current = Date.now();
    setFeedback(null);
  }

  const handleAnswer = useCallback(async (action: Action) => {
    if (!currentHand || !range || !id) return;
    const freq = range[currentHand];
    if (!freq) return;

    const responseTimeMs = Date.now() - startTimeRef.current;

    // Evaluate
    const correctActions = ACTIONS.filter((a) => freq[a] > 0);
    const primaryAction = ACTIONS.reduce((best, a) => (freq[a] > freq[best] ? a : best), 'fold' as Action);
    const isCorrect = freq[action] > 0;
    const isMixedCorrect = isCorrect && action !== primaryAction;

    setFeedback({
      isCorrect,
      isMixedCorrect,
      selectedAction: action,
      correctActions,
      primaryAction,
      frequencies: freq,
    });

    setSessionCount((c) => c + 1);
    if (isCorrect) setCorrectCount((c) => c + 1);

    // Save session answer
    const grade = !isCorrect ? 'again' : isMixedCorrect ? 'hard' : responseTimeMs > 5000 ? 'hard' : 'good';
    const answer: SessionAnswer = {
      spotId: id,
      hand: currentHand,
      selectedAction: action,
      correctActions,
      primaryAction,
      isCorrect,
      isMixedCorrect,
      responseTimeMs,
      grade,
      timestamp: Date.now(),
    };
    await saveSession(answer);
  }, [currentHand, range, id]);

  function handleNext() {
    pickNextHand();
  }

  if (!spot || !range) {
    return <div className="p-4 text-gray-400">Loading...</div>;
  }

  if (trainableHands.length === 0) {
    return (
      <div className="p-4">
        <p className="text-yellow-500">No hands in range. Fill the chart first.</p>
        <Link to={`/spots/${id}/range`} className="text-blue-400 text-sm mt-2 block">
          Open Chart Editor
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col min-h-screen">
      {/* Spot info */}
      <div className="mb-4">
        <div className="text-xs text-gray-400">
          {spot.format} · {spot.effectiveStackBb}bb · {spot.actingPosition}
          {spot.history.length > 0 &&
            ' · ' + spot.history.map((h) => `${h.position} ${h.action}`).join(' → ')}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Session: {correctCount}/{sessionCount}
          {sessionCount > 0 && ` (${Math.round((correctCount / sessionCount) * 100)}%)`}
        </div>
      </div>

      {/* Hand display */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {currentHand && !feedback && (
          <div className="text-center">
            <div className="text-5xl font-bold mb-8">{currentHand}</div>
            <div className="text-sm text-gray-400 mb-6">What's your action?</div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
              {ACTIONS.map((a) => (
                <button
                  key={a}
                  onClick={() => handleAnswer(a)}
                  className={`py-4 rounded-xl font-bold text-lg bg-${a} active:scale-95 transition-transform`}
                >
                  {ACTION_LABELS[a]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className="text-center w-full max-w-xs">
            <div className="text-4xl font-bold mb-2">{currentHand}</div>

            {/* Result badge */}
            <div
              className={`text-xl font-bold mb-4 ${
                feedback.isCorrect
                  ? feedback.isMixedCorrect
                    ? 'text-yellow-400'
                    : 'text-green-400'
                  : 'text-red-400'
              }`}
            >
              {feedback.isCorrect
                ? feedback.isMixedCorrect
                  ? '✓ Correct (mix)'
                  : '✓ Correct'
                : '✗ Wrong'}
            </div>

            {/* Details */}
            <div className="bg-gray-800 rounded-lg p-3 text-left text-sm mb-4">
              <div className="mb-2">
                <span className="text-gray-400">You chose: </span>
                <span className={`font-medium text-${feedback.selectedAction}`}>
                  {ACTION_LABELS[feedback.selectedAction]}
                </span>
              </div>
              <div className="mb-2">
                <span className="text-gray-400">Primary: </span>
                <span className="font-medium">{ACTION_LABELS[feedback.primaryAction]}</span>
              </div>
              <div>
                <span className="text-gray-400">Frequencies: </span>
                <div className="mt-1">
                  {ACTIONS.filter((a) => feedback.frequencies[a] > 0).map((a) => (
                    <span key={a} className={`inline-block mr-2 text-${a}`}>
                      {ACTION_LABELS[a]} {(feedback.frequencies[a] * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleNext}
              className="w-full py-4 bg-blue-600 rounded-xl font-bold text-lg hover:bg-blue-500 active:scale-95 transition-transform"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      <Link to="/spots" className="block mt-4 text-sm text-gray-400 hover:text-white text-center">
        ← End session
      </Link>
    </div>
  );
}
