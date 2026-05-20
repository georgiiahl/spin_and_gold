import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Action, HandFrequencies, SpotRange, Spot } from '@/domain/types';
import { ALL_HANDS, HAND_MATRIX, getHandPosition } from '@/domain/hands';
import { getSpot } from '@/storage/spots';
import { getRange } from '@/storage/ranges';

const ACTIONS: Action[] = ['fold', 'call', 'raise', 'jam'];
const ACTION_LABELS: Record<Action, string> = { fold: 'Fold', call: 'Call', raise: 'Raise', jam: 'Jam' };

function getPrimaryAction(freq: HandFrequencies): Action {
  return ACTIONS.reduce((best, a) => (freq[a] > freq[best] ? a : best), 'fold' as Action);
}

/** Find border hands: hands whose neighbors have a different primary action */
function findBorderHands(range: SpotRange): string[] {
  const borders: string[] = [];

  for (const hand of ALL_HANDS) {
    const freq = range[hand];
    if (!freq || (freq.fold + freq.call + freq.raise + freq.jam) === 0) continue;

    const pos = getHandPosition(hand);
    if (!pos) continue;

    const myAction = getPrimaryAction(freq);
    const neighbors = [
      [pos.row - 1, pos.col],
      [pos.row + 1, pos.col],
      [pos.row, pos.col - 1],
      [pos.row, pos.col + 1],
    ];

    let isBorder = false;
    for (const [r, c] of neighbors) {
      if (r < 0 || r >= 13 || c < 0 || c >= 13) continue;
      // Get hand at that position
      const neighborHand = getHandAt(r, c);
      if (!neighborHand) continue;
      const nFreq = range[neighborHand];
      if (!nFreq || (nFreq.fold + nFreq.call + nFreq.raise + nFreq.jam) === 0) continue;
      const nAction = getPrimaryAction(nFreq);
      if (nAction !== myAction) {
        isBorder = true;
        break;
      }
    }

    // Also include mixed hands
    const nonZero = Object.values(freq).filter((v) => v > 0).length;
    if (isBorder || nonZero > 1) {
      borders.push(hand);
    }
  }

  return borders;
}

function getHandAt(row: number, col: number): string | null {
  if (row < 0 || row >= 13 || col < 0 || col >= 13) return null;
  return HAND_MATRIX[row][col];
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

  if (!spot) return <div className="p-4 text-gray-400">Loading...</div>;

  if (borderHands.length === 0) {
    return (
      <div className="p-4">
        <p className="text-yellow-500">No border hands found. Fill the chart first.</p>
        <Link to={`/spots/${id}/range`} className="text-blue-400 text-sm mt-2 block">Open Chart Editor</Link>
      </div>
    );
  }

  const currentHand = borderHands[currentIdx];

  return (
    <div className="p-4 flex flex-col min-h-screen">
      <div className="mb-4">
        <h1 className="text-lg font-bold">Border Trainer</h1>
        <div className="text-xs text-gray-400">{spot.title}</div>
        <div className="text-xs text-gray-500 mt-1">
          {borderHands.length} border hands \u00b7 Score: {score.correct}/{score.total}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {!feedback && (
          <div className="text-center">
            <div className="text-xs text-yellow-400 mb-2">BORDER HAND</div>
            <div className="text-5xl font-bold mb-8">{currentHand}</div>
            <div className="text-sm text-gray-400 mb-6">What's your action?</div>
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

        {feedback && (
          <div className="text-center">
            <div className="text-4xl font-bold mb-2">{currentHand}</div>
            <div className={`text-xl font-bold mb-4 ${feedback.correct ? 'text-green-400' : 'text-red-400'}`}>
              {feedback.correct ? '\u2713 Correct' : '\u2717 Wrong'}
            </div>
            <div className="text-sm text-gray-400 mb-6">
              Primary: <span className={`text-${feedback.action} font-medium`}>{ACTION_LABELS[feedback.action]}</span>
            </div>
            <button
              onClick={next}
              className="w-full max-w-xs py-4 bg-blue-600 rounded-xl font-bold text-lg hover:bg-blue-500"
            >
              Next \u2192
            </button>
          </div>
        )}
      </div>

      <Link to="/spots" className="block mt-4 text-sm text-gray-400 hover:text-white text-center">
        \u2190 Back
      </Link>
    </div>
  );
}
