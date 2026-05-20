import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Action, HandFrequencies, SpotRange, Spot } from '@/domain/types';
import { ALL_HANDS, HAND_MATRIX } from '@/domain/hands';
import { getSpot } from '@/storage/spots';
import { getRange } from '@/storage/ranges';
import RangeMatrix from '@/components/RangeMatrix';

const ACTIONS: Action[] = ['fold', 'call', 'raise', 'jam'];
const ACTION_LABELS: Record<Action, string> = { fold: 'Fold', call: 'Call', raise: 'Raise', jam: 'Jam' };

type Phase = 'ready' | 'showing' | 'question' | 'answer';
type Question = { hand: string; correctAction: Action };

export default function FlashRange() {
  const { id } = useParams<{ id: string }>();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [range, setRange] = useState<SpotRange>({});
  const [phase, setPhase] = useState<Phase>('ready');
  const [flashDuration, setFlashDuration] = useState(3);
  const [question, setQuestion] = useState<Question | null>(null);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!id) return;
    Promise.all([getSpot(id), getRange(id)]).then(([s, r]) => {
      if (s) setSpot(s);
      if (r) setRange(r);
    });
  }, [id]);

  function startFlash() {
    setPhase('showing');
    setResult(null);
    timerRef.current = setTimeout(() => {
      setPhase('question');
      generateQuestion();
    }, flashDuration * 1000);
  }

  function generateQuestion() {
    // Pick a random non-trivial hand
    const hands = ALL_HANDS.filter((h) => {
      const f = range[h];
      return f && (f.fold + f.call + f.raise + f.jam) > 0;
    });
    if (hands.length === 0) return;
    const hand = hands[Math.floor(Math.random() * hands.length)];
    const freq = range[hand];
    const primary = ACTIONS.reduce((best, a) => (freq[a] > freq[best] ? a : best), 'fold' as Action);
    setQuestion({ hand, correctAction: primary });
  }

  function handleAnswer(action: Action) {
    if (!question) return;
    const isCorrect = action === question.correctAction;
    setResult(isCorrect ? 'correct' : 'wrong');
    setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
    setPhase('answer');
  }

  function nextRound() {
    setPhase('ready');
    setQuestion(null);
    setResult(null);
  }

  if (!spot) return <div className="p-4 text-gray-400">Loading...</div>;

  return (
    <div className="p-4">
      <div className="mb-3">
        <h1 className="text-lg font-bold">Flash Range</h1>
        <div className="text-xs text-gray-400">{spot.title}</div>
      </div>

      {phase === 'ready' && (
        <div className="text-center mt-8">
          <div className="mb-4">
            <label className="text-sm text-gray-400">Flash duration: </label>
            <select
              value={flashDuration}
              onChange={(e) => setFlashDuration(Number(e.target.value))}
              className="bg-gray-800 rounded px-2 py-1 text-sm ml-2"
            >
              {[1, 2, 3, 5, 7].map((n) => (
                <option key={n} value={n}>{n}s</option>
              ))}
            </select>
          </div>
          <button
            onClick={startFlash}
            className="px-6 py-3 bg-blue-600 rounded-xl font-bold text-lg hover:bg-blue-500"
          >
            Show Range
          </button>
          {score.total > 0 && (
            <div className="text-sm text-gray-400 mt-4">
              Score: {score.correct}/{score.total}
            </div>
          )}
        </div>
      )}

      {phase === 'showing' && (
        <div>
          <div className="text-xs text-center text-yellow-400 mb-2">Memorize! ({flashDuration}s)</div>
          <RangeMatrix
            range={range}
            onCellAction={() => {}}
            activeAction="fold"
            mode="simple"
            readOnly
          />
        </div>
      )}

      {phase === 'question' && question && (
        <div className="text-center mt-8">
          <div className="text-3xl font-bold mb-4">{question.hand}</div>
          <div className="text-sm text-gray-400 mb-6">What's the primary action?</div>
          <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
            {ACTIONS.map((a) => (
              <button
                key={a}
                onClick={() => handleAnswer(a)}
                className={`py-3 rounded-xl font-bold bg-${a} active:scale-95 transition-transform`}
              >
                {ACTION_LABELS[a]}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'answer' && question && (
        <div className="text-center mt-8">
          <div className="text-3xl font-bold mb-2">{question.hand}</div>
          <div className={`text-xl font-bold mb-4 ${result === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
            {result === 'correct' ? '\u2713 Correct' : '\u2717 Wrong'}
          </div>
          <div className="text-sm text-gray-400 mb-6">
            Correct: <span className={`text-${question.correctAction} font-medium`}>{ACTION_LABELS[question.correctAction]}</span>
          </div>
          <button
            onClick={nextRound}
            className="px-6 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500"
          >
            Next Round
          </button>
        </div>
      )}

      <Link to="/spots" className="block mt-6 text-sm text-gray-400 hover:text-white text-center">
        \u2190 Back
      </Link>
    </div>
  );
}
