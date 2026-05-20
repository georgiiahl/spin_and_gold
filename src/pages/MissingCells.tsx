import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Action, HandFrequencies, SpotRange, Spot } from '@/domain/types';
import { ALL_HANDS, HAND_MATRIX } from '@/domain/hands';
import { getSpot } from '@/storage/spots';
import { getRange } from '@/storage/ranges';

const ACTIONS: Action[] = ['fold', 'call', 'raise', 'jam'];
const ACTION_LABELS: Record<Action, string> = { fold: 'Fold', call: 'Call', raise: 'Raise', jam: 'Jam' };
const ACTION_COLORS: Record<Action, string> = { fold: 'bg-fold', call: 'bg-call', raise: 'bg-raise', jam: 'bg-jam' };

function getPrimaryAction(freq: HandFrequencies): Action {
  return ACTIONS.reduce((best, a) => (freq[a] > freq[best] ? a : best), 'fold' as Action);
}

export default function MissingCells() {
  const { id } = useParams<{ id: string }>();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [range, setRange] = useState<SpotRange>({});
  const [hiddenHands, setHiddenHands] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<Record<string, Action>>({});
  const [revealed, setRevealed] = useState(false);
  const [difficulty, setDifficulty] = useState(15); // number of hidden cells

  useEffect(() => {
    if (!id) return;
    Promise.all([getSpot(id), getRange(id)]).then(([s, r]) => {
      if (s) setSpot(s);
      if (r) setRange(r);
    });
  }, [id]);

  function startRound() {
    // Pick meaningful hands to hide (prefer non-fold, border)
    const meaningful = ALL_HANDS.filter((h) => {
      const f = range[h];
      if (!f || (f.fold + f.call + f.raise + f.jam) === 0) return false;
      // Prefer non-pure-fold or mixed
      const nonZero = Object.values(f).filter((v) => v > 0).length;
      return f.fold < 1 || nonZero > 1;
    });
    const foldHands = ALL_HANDS.filter((h) => {
      const f = range[h];
      return f && f.fold === 1;
    });

    // Mix: 70% meaningful, 30% fold
    const meaningfulCount = Math.min(Math.ceil(difficulty * 0.7), meaningful.length);
    const foldCount = Math.min(difficulty - meaningfulCount, foldHands.length);

    const shuffled = [...meaningful].sort(() => Math.random() - 0.5).slice(0, meaningfulCount);
    const shuffledFold = [...foldHands].sort(() => Math.random() - 0.5).slice(0, foldCount);

    setHiddenHands(new Set([...shuffled, ...shuffledFold]));
    setAnswers({});
    setRevealed(false);
  }

  function handleCellAnswer(hand: string, action: Action) {
    setAnswers((prev) => ({ ...prev, [hand]: action }));
  }

  function checkAnswers() {
    setRevealed(true);
  }

  const correctCount = Object.entries(answers).filter(([hand, action]) => {
    const f = range[hand];
    return f && f[action] > 0;
  }).length;

  if (!spot) return <div className="p-4 text-gray-400">Loading...</div>;

  const hasStarted = hiddenHands.size > 0;

  return (
    <div className="p-4">
      <div className="mb-3">
        <h1 className="text-lg font-bold">Missing Cells</h1>
        <div className="text-xs text-gray-400">{spot.title}</div>
      </div>

      {!hasStarted && (
        <div className="text-center mt-8">
          <div className="mb-4">
            <label className="text-sm text-gray-400">Cells to hide: </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              className="bg-gray-800 rounded px-2 py-1 text-sm ml-2"
            >
              {[5, 10, 15, 20, 30, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <button
            onClick={startRound}
            className="px-6 py-3 bg-blue-600 rounded-xl font-bold text-lg hover:bg-blue-500"
          >
            Start
          </button>
        </div>
      )}

      {hasStarted && (
        <>
          {/* Matrix with hidden cells */}
          <div className="grid grid-cols-13 gap-[1px] select-none mb-3">
            {HAND_MATRIX.map((row, r) =>
              row.map((hand, c) => {
                const freq = range[hand];
                const isHidden = hiddenHands.has(hand);
                const userAnswer = answers[hand];
                const primary = freq ? getPrimaryAction(freq) : 'fold';

                if (isHidden && !revealed) {
                  // Hidden cell — show answer buttons or user's pick
                  if (userAnswer) {
                    return (
                      <div
                        key={`${r}-${c}`}
                        onClick={() => handleCellAnswer(hand, ACTIONS[(ACTIONS.indexOf(userAnswer) + 1) % 4])}
                        className={`aspect-square flex items-center justify-center text-[7px] font-medium rounded-[2px] cursor-pointer ${ACTION_COLORS[userAnswer]} ring-1 ring-yellow-400`}
                      >
                        {hand}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={`${r}-${c}`}
                      onClick={() => handleCellAnswer(hand, 'raise')}
                      className="aspect-square flex items-center justify-center text-[7px] font-medium rounded-[2px] cursor-pointer bg-gray-600 ring-1 ring-yellow-400/50 hover:bg-gray-500"
                    >
                      ?
                    </div>
                  );
                }

                if (isHidden && revealed) {
                  // Revealed: show correct/wrong
                  const isCorrect = userAnswer && freq && freq[userAnswer] > 0;
                  return (
                    <div
                      key={`${r}-${c}`}
                      className={`aspect-square flex items-center justify-center text-[7px] font-medium rounded-[2px] ${ACTION_COLORS[primary]} ${isCorrect ? 'ring-1 ring-green-400' : 'ring-2 ring-red-500'}`}
                    >
                      {hand}
                    </div>
                  );
                }

                // Normal cell
                const color = freq && (freq.fold + freq.call + freq.raise + freq.jam) > 0
                  ? ACTION_COLORS[primary]
                  : 'bg-gray-700';
                return (
                  <div
                    key={`${r}-${c}`}
                    className={`aspect-square flex items-center justify-center text-[7px] font-medium rounded-[2px] ${color}`}
                  >
                    {hand}
                  </div>
                );
              })
            )}
          </div>

          {/* Controls */}
          {!revealed && (
            <div className="flex gap-2">
              <div className="text-xs text-gray-400 flex-1">
                Tap hidden cells to cycle actions. {Object.keys(answers).length}/{hiddenHands.size} answered
              </div>
              <button
                onClick={checkAnswers}
                disabled={Object.keys(answers).length < hiddenHands.size}
                className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-40"
              >
                Check
              </button>
            </div>
          )}

          {revealed && (
            <div className="text-center">
              <div className="text-lg font-bold mb-2">
                {correctCount}/{hiddenHands.size} correct
              </div>
              <button
                onClick={startRound}
                className="px-6 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500"
              >
                New Round
              </button>
            </div>
          )}
        </>
      )}

      <Link to="/spots" className="block mt-6 text-sm text-gray-400 hover:text-white text-center">
        \u2190 Back
      </Link>
    </div>
  );
}
