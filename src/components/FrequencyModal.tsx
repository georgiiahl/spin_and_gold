import { useState } from 'react';
import { Action, HandFrequencies } from '@/domain/types';

type Props = {
  hand: string;
  frequencies: HandFrequencies;
  onSave: (freq: HandFrequencies) => void;
  onClose: () => void;
};

const ACTIONS: Action[] = ['fold', 'call', 'raise', 'jam'];
const ACTION_LABELS: Record<Action, string> = {
  fold: 'Fold',
  call: 'Call',
  raise: 'Raise',
  jam: 'Jam',
};

export default function FrequencyModal({ hand, frequencies, onSave, onClose }: Props) {
  const [values, setValues] = useState<HandFrequencies>({ ...frequencies });

  const sum = values.fold + values.call + values.raise + values.jam;

  function handleChange(action: Action, val: string) {
    const num = Math.max(0, Math.min(1, parseFloat(val) || 0));
    setValues({ ...values, [action]: num });
  }

  function handleSave() {
    if (Math.abs(sum - 1) > 0.01) {
      alert('Frequencies must sum to 1');
      return;
    }
    onSave(values);
  }

  function setPure(action: Action) {
    const freq: HandFrequencies = { fold: 0, call: 0, raise: 0, jam: 0 };
    freq[action] = 1;
    setValues(freq);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl p-4 w-full max-w-xs">
        <h3 className="text-lg font-bold mb-3">{hand}</h3>

        {/* Quick pure buttons */}
        <div className="flex gap-2 mb-4">
          {ACTIONS.map((a) => (
            <button
              key={a}
              onClick={() => setPure(a)}
              className={`flex-1 py-1 rounded text-xs font-medium bg-${a} hover:brightness-125`}
            >
              {ACTION_LABELS[a]}
            </button>
          ))}
        </div>

        {/* Sliders */}
        <div className="flex flex-col gap-3">
          {ACTIONS.map((a) => (
            <div key={a} className="flex items-center gap-2">
              <span className="text-xs w-10 text-gray-400">{ACTION_LABELS[a]}</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={values[a]}
                onChange={(e) => handleChange(a, e.target.value)}
                className="flex-1"
              />
              <span className="text-xs w-8 text-right">{(values[a] * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>

        <div className={`text-xs mt-2 ${Math.abs(sum - 1) > 0.01 ? 'text-red-400' : 'text-green-400'}`}>
          Sum: {(sum * 100).toFixed(0)}%
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSave}
            className="flex-1 py-2 bg-blue-600 rounded-lg font-medium hover:bg-blue-500"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-700 rounded-lg font-medium hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
