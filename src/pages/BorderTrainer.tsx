import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Action, HandFrequencies, SpotRange, Spot } from '@/domain/types';
import { ALL_HANDS } from '@/domain/hands';
import { isBorderHand } from '@/domain/border';
import { getSpot } from '@/storage/spots';
import { getRange } from '@/storage/ranges';

const ACTIONS: Action[] = ['fold', 'call', 'raise', 'jam'];
const ACTION_KEYS: Record<string, Action> = {
  f: 'fold',
  '1': 'fold',
  c: 'call',
  '2': 'call',
  r: 'raise',
  '3': 'raise',
  j: 'jam',
  '4': 'jam',
};
const ACTION_LABELS: Record<Action, string> = { fold: 'Fold', call: 'Call', raise: 'Raise', jam: 'Jam' };
const ACTION_SHORTCUT_LABELS: Record<Action, string> = {
  fold: 'F · 1',
  call: 'C · 2',
  raise: 'R · 3',
  jam: 'J · 4',
};
const ACTION_BUTTON_CLASSES: Record<Action, string> = {
  fold: 'bg-fold',
  call: 'bg-call',
  raise: 'bg-raise',
  jam: 'bg-jam',
};
const ACTION_TEXT_CLASSES: Record<Action, string> = {
  fold: 'text-fold',
  call: 'text-call',
  raise: 'text-raise',
  jam: 'text-jam',
};

function getPrimaryAction(freq: HandFrequencies): Action {
  return ACTIONS.reduce((best, a) => (freq[a] > freq[best] ? a : best), 'fold' as Action);
}

/** Find border hands: hands whose neighbors have a different primary action */
function findBorderHands(range: SpotRange): string[] {
  return ALL_HANDS.filter((hand) => isBorderHand(hand, range));
}

export default function BorderTrainer() {
  const { id } = useParams<{ id: string }>();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [range, setRange] = useState<SpotRange>({});
  const [borderHands, setBorderHands] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean; action: Action } | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  useEffect(() => {
    if (!id) return;
    Promise.all([getSpot(id), getRange(id)]).then(([s, r]) => {
      if (s) setSpot(s);
      if (r) {
        setRange(r);
        const borders = findBorderHands(r);
        // Shuffle
        setBorderHands(borders.sort(() => Math.random() - 0.5));
      }
    });
  }, [id]);

  function handleAnswer(action: Action) {
    const hand = borderHands[currentIdx];
    const freq = range[hand];
    if (!freq) return;

    const isCorrect = freq[action] > 0;
    const primary = getPrimaryAction(freq);
    setFeedback({ correct: isCorrect, action: primary });
    setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
  }

  function next() {
    setFeedback(null);
    setCurrentIdx((i) => (i + 1) % borderHands.length);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTypingElement(event.target)) return;

      const key = event.key.toLowerCase();
      if (!feedback) {
        const action = ACTION_KEYS[key];
        if (action) {
          event.preventDefault();
          handleAnswer(action);
        }
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        next();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [feedback, currentIdx, borderHands, range]);

  if (!spot) return <div className="text-gray-500">Loading...</div>;

  if (borderHands.length === 0) {
    return (
      <div>
        <p className="text-yellow-600">No border hands found. Fill the chart first.</p>
        <Link to={`/spots/${id}/range`} className="mt-2 block text-sm text-blue-600">Open Chart Editor</Link>
      </div>
    );
  }

  const currentHand = borderHands[currentIdx];

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
      <div className="mb-4">
        <h1 className="text-lg font-bold">Border Trainer</h1>
        <div className="text-xs text-gray-500">{spot.title}</div>
        <div className="text-xs text-gray-500 mt-1">
          {borderHands.length} border hands \u00b7 Score: {score.correct}/{score.total}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {!feedback && (
          <div className="text-center">
            <div className="mb-2 text-xs text-yellow-600">BORDER HAND</div>
            <div className="text-5xl font-bold mb-8">{currentHand}</div>
            <div className="text-sm text-gray-500 mb-6">What's your action?</div>
            <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
              {ACTIONS.map((a) => (
                <button
                  key={a}
                  onClick={() => handleAnswer(a)}
                  className={`flex flex-col items-center rounded-xl ${ACTION_BUTTON_CLASSES[a]} py-3 text-lg font-bold text-white shadow-sm transition-transform active:scale-95`}
                >
                  <span>{ACTION_LABELS[a]}</span>
                  <span className="text-xs font-medium text-white/60">{ACTION_SHORTCUT_LABELS[a]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {feedback && (
          <div className="text-center">
            <div className="text-4xl font-bold mb-2">{currentHand}</div>
            <div className={`mb-4 text-xl font-bold ${feedback.correct ? 'text-green-600' : 'text-red-600'}`}>
              {feedback.correct ? '\u2713 Correct' : '\u2717 Wrong'}
            </div>
            <div className="text-sm text-gray-500 mb-6">
              Primary: <span className={`${ACTION_TEXT_CLASSES[feedback.action]} font-medium`}>{ACTION_LABELS[feedback.action]}</span>
            </div>
            <button
              onClick={next}
              className="w-full max-w-xs rounded-xl bg-blue-600 py-4 text-lg font-bold text-white hover:bg-blue-500"
            >
              Next \u2192
            </button>
          </div>
        )}
      </div>

      <Link to="/spots" className="block mt-4 text-sm text-gray-500 hover:text-gray-900 text-center">
        \u2190 Back
      </Link>
    </div>
  );
}

function isTypingElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
}
