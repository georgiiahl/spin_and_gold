import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Action, HandFrequencies, SpotRange, Spot } from '@/domain/types';
import { ALL_HANDS } from '@/domain/hands';
import { getSpot } from '@/storage/spots';
import { getRange, saveRange } from '@/storage/ranges';
import RangeMatrix from '@/components/RangeMatrix';
import FrequencyModal from '@/components/FrequencyModal';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

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
    return <div className="text-slate-400">Loading...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Card className="mb-3">
        <h1 className="text-lg font-bold">{spot.title}</h1>
        <div className="text-xs text-slate-400">
          {spot.format} · {spot.effectiveStackBb}bb · {spot.actingPosition}
        </div>
      </Card>

      {/* Mode toggle */}
      <div className="mb-3 flex gap-2">
        <Button
          onClick={() => setMode('simple')}
          variant={mode === 'simple' ? 'primary' : 'secondary'}
          aria-label="Simple mode"
        >
          Simple
        </Button>
        <Button
          onClick={() => setMode('frequency')}
          variant={mode === 'frequency' ? 'primary' : 'secondary'}
          aria-label="Frequency mode"
        >
          Frequency
        </Button>
      </div>

      {/* Action palette (simple mode) */}
      {mode === 'simple' && (
        <div className="flex gap-2 mb-3">
          {ACTIONS.map((a) => (
            <button
              key={a}
              onClick={() => setActiveAction(a)}
              aria-label={ACTION_LABELS[a]}
               className={`flex-1 rounded py-2 text-sm font-medium text-white transition ${ACTION_BUTTON_CLASSES[a]} ${
                 activeAction === a ? 'ring-2 ring-gold-300' : 'opacity-70'
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
        <span className="text-xs text-slate-400">{filled}/169 filled</span>
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            variant={saved ? 'secondary' : 'primary'}
            aria-label="Save chart"
          >
            {saved ? '✓ Saved' : 'Save'}
          </Button>
        </div>
      </div>

      {filled < 169 && filled > 0 && (
        <div className="mt-2 text-xs text-amber-300">
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

      <Link to="/admin/spots" className="mt-4 block text-sm text-slate-400 hover:text-gold-300">
        ← Back to spots
      </Link>
    </div>
  );
}
