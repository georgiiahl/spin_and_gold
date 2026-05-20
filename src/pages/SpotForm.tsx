import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  GameFormat,
  HistoryEntry,
  HistoryAction,
  Spot,
  getPositions,
  normalizeSpotCategory,
} from '@/domain/types';
import { generateSpotId } from '@/domain/spotId';
import { getAllCategories, getSpot, saveSpot } from '@/storage/spots';

const HISTORY_ACTIONS: HistoryAction[] = ['fold', 'call', 'raise', 'jam', 'open'];

export default function SpotForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [format, setFormat] = useState<GameFormat>('3max');
  const [stackBb, setStackBb] = useState<string>('20');
  const [actingPosition, setActingPosition] = useState<string>('BTN');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [existingSpot, setExistingSpot] = useState<Spot | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  const positions = getPositions(format) as string[];

  useEffect(() => {
    getAllCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (id) {
      getSpot(id).then((spot) => {
        if (spot) {
          setExistingSpot(spot);
          setFormat(spot.format);
          setStackBb(String(spot.effectiveStackBb));
          setActingPosition(spot.actingPosition);
          setHistory(spot.history);
          setTitle(spot.title);
          setCategory(spot.category || '');
          setNotes(spot.notes || '');
        }
      });
    }
  }, [id]);

  // Auto-generate title
  useEffect(() => {
    if (!isEdit || !existingSpot) {
      const histStr = history.length > 0
        ? ' vs ' + history.map((h) => `${h.position} ${h.action}`).join(' ')
        : ' RFI';
      setTitle(`${format} ${stackBb}bb ${actingPosition}${histStr}`);
    }
  }, [format, stackBb, actingPosition, history, isEdit, existingSpot]);

  // Reset acting position if not in positions list
  useEffect(() => {
    if (!positions.includes(actingPosition)) {
      setActingPosition(positions[0]);
    }
  }, [format]);

  function addHistoryEntry() {
    setHistory([...history, { position: positions[0], action: 'open' }]);
  }

  function updateHistoryEntry(index: number, field: keyof HistoryEntry, value: string) {
    const updated = [...history];
    updated[index] = { ...updated[index], [field]: value };
    setHistory(updated);
  }

  function removeHistoryEntry(index: number) {
    setHistory(history.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const stack = parseFloat(stackBb);
    if (isNaN(stack) || stack <= 0) {
      alert('Invalid stack size');
      return;
    }

    const spotId = isEdit && existingSpot
      ? existingSpot.id
      : generateSpotId(format, stack, actingPosition, history);

    const spot: Spot = {
      id: spotId,
      title,
      format,
      category: normalizeSpotCategory(category),
      effectiveStackBb: stack,
      actingPosition,
      history,
      notes: notes || undefined,
      createdAt: existingSpot?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    await saveSpot(spot);
    navigate('/spots');
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">{isEdit ? 'Edit Spot' : 'New Spot'}</h1>

      <div className="flex flex-col gap-4">
        {/* Format */}
        <div>
          <label className="text-sm text-gray-400 block mb-1">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as GameFormat)}
            className="w-full bg-gray-800 rounded px-3 py-2"
          >
            <option value="3max">3-max</option>
            <option value="hu">Heads-up</option>
          </select>
        </div>

        {/* Stack */}
        <div>
          <label className="text-sm text-gray-400 block mb-1">Effective Stack (bb)</label>
          <input
            type="number"
            step="0.5"
            min="1"
            value={stackBb}
            onChange={(e) => setStackBb(e.target.value)}
            className="w-full bg-gray-800 rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 block mb-1">Category</label>
          <input
            type="text"
            list="spot-categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="BTN Open"
            className="w-full bg-gray-800 rounded px-3 py-2"
          />
          <datalist id="spot-categories">
            {categories.map((existingCategory) => (
              <option key={existingCategory} value={existingCategory} />
            ))}
          </datalist>
          <div className="mt-1 text-xs text-gray-500">Pick an existing category or type a new one.</div>
        </div>

        {/* Acting Position */}
        <div>
          <label className="text-sm text-gray-400 block mb-1">Acting Position</label>
          <select
            value={actingPosition}
            onChange={(e) => setActingPosition(e.target.value)}
            className="w-full bg-gray-800 rounded px-3 py-2"
          >
            {positions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* History */}
        <div>
          <label className="text-sm text-gray-400 block mb-1">Previous Actions</label>
          {history.map((entry, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <select
                value={entry.position}
                onChange={(e) => updateHistoryEntry(i, 'position', e.target.value)}
                className="bg-gray-800 rounded px-2 py-1 text-sm flex-1"
              >
                {positions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select
                value={entry.action}
                onChange={(e) => updateHistoryEntry(i, 'action', e.target.value)}
                className="bg-gray-800 rounded px-2 py-1 text-sm flex-1"
              >
                {HISTORY_ACTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <button
                onClick={() => removeHistoryEntry(i)}
                className="text-red-400 px-2 hover:text-red-300"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={addHistoryEntry}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            + Add action
          </button>
        </div>

        {/* Title */}
        <div>
          <label className="text-sm text-gray-400 block mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-gray-800 rounded px-3 py-2"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm text-gray-400 block mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-gray-800 rounded px-3 py-2 h-20 resize-none"
          />
        </div>

        {/* Generated ID preview */}
        <div className="text-xs text-gray-500">
          ID: {generateSpotId(format, parseFloat(stackBb) || 0, actingPosition, history)}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-2">
          <button
            onClick={handleSave}
            className="flex-1 py-3 bg-blue-600 rounded-lg font-medium hover:bg-blue-500"
          >
            {isEdit ? 'Save' : 'Create'}
          </button>
          <button
            onClick={() => navigate('/spots')}
            className="flex-1 py-3 bg-gray-700 rounded-lg font-medium hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
