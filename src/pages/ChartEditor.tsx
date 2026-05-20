import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Action, HandFrequencies, SpotRange, Spot } from '@/domain/types';
import { ALL_HANDS } from '@/domain/hands';
import { getSpot } from '@/storage/spots';
import { getRange, saveRange } from '@/storage/ranges';
import RangeMatrix from '@/components/RangeMatrix';
import FrequencyModal from '@/components/FrequencyModal';

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

const EMPTY_FREQ: HandFrequencies = { fold: 0, call: 0, raise: 0, jam: 0 };

export default function ChartEditor() {
  const { id } = useParams<{ id: string }>();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [range, setRange] = useState<SpotRange>({});
  const [activeAction, setActiveAction] = useState<Action>('raise');
  const [mode, setMode] = useState<'simple' | 'frequency'>('simple');
  const [modalHand, setModalHand] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    getSpot(id).then((s) => s && setSpot(s));
    getRange(id).then((r) => r && setRange(r));
  }, [id]);

  const handleCellAction = useCallback((hand: string, action: Action) => {
    setRange((prev) => {
      const freq: HandFrequencies = { fold: 0, call: 0, raise: 0, jam: 0 };
      freq[action] = 1;
      return { ...prev, [hand]: freq };
    });
    setSaved(false);
  }, []);

  const handleCellClick = useCallback((hand: string) => {
    setModalHand(hand);
  }, []);

  const handleFreqSave = useCallback((freq: HandFrequencies) => {
    if (!modalHand) return;
    setRange((prev) => ({ ...prev, [modalHand]: freq }));
    setModalHand(null);
    setSaved(false);
  }, [modalHand]);

  async function handleSave() {
    if (!id) return;
    await saveRange(id, range);
    setSaved(true);
  }

  // Stats
  const filled = ALL_HANDS.filter((h) => {
    const f = range[h];
    return f && (f.fold + f.call + f.raise + f.jam) > 0;
  }).length;

  if (!spot) {
    return <div className="p-4 text-gray-500">Loading...</div>;
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-3">
        <h1 className="text-lg font-bold">{spot.title}</h1>
        <div className="text-xs text-gray-500">
          {spot.format} · {spot.effectiveStackBb}bb · {spot.actingPosition}
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setMode('simple')}
          className={`px-3 py-1 rounded text-sm font-medium ${
            mode === 'simple' ? 'bg-blue-600 text-white' : 'bg-gray-50 border border-gray-200 text-gray-700'
          }`}
        >
          Simple
        </button>
        <button
          onClick={() => setMode('frequency')}
          className={`px-3 py-1 rounded text-sm font-medium ${
            mode === 'frequency' ? 'bg-blue-600 text-white' : 'bg-gray-50 border border-gray-200 text-gray-700'
          }`}
        >
          Frequency
        </button>
      </div>

      {/* Action palette (simple mode) */}
      {mode === 'simple' && (
        <div className="flex gap-2 mb-3">
          {ACTIONS.map((a) => (
            <button
              key={a}
              onClick={() => setActiveAction(a)}
               className={`flex-1 rounded py-2 text-sm font-medium text-white ${ACTION_BUTTON_CLASSES[a]} ${
                 activeAction === a ? 'ring-2 ring-white' : 'opacity-60'
               }`}
            >
              {ACTION_LABELS[a]}
            </button>
          ))}
        </div>
      )}

      {/* Matrix */}
      <RangeMatrix
        range={range}
        onCellAction={handleCellAction}
        onCellClick={handleCellClick}
        activeAction={activeAction}
        mode={mode}
      />

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-500">{filled}/169 filled</span>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className={`px-4 py-2 rounded-lg font-medium text-sm ${
              saved ? 'bg-green-700 text-white' : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>

      {filled < 169 && filled > 0 && (
        <div className="mt-2 text-xs text-yellow-500">
          ⚠ {169 - filled} hands not filled. Complete before training.
        </div>
      )}

      {/* Modal */}
      {modalHand && (
        <FrequencyModal
          hand={modalHand}
          frequencies={range[modalHand] || EMPTY_FREQ}
          onSave={handleFreqSave}
          onClose={() => setModalHand(null)}
        />
      )}

      <Link to="/spots" className="block mt-4 text-sm text-gray-500 hover:text-gray-900">
        ← Back to spots
      </Link>
    </div>
  );
}
