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

const QUARTER_STEPS = [0, 25, 50, 75, 100];

// These classes must be explicit so Tailwind includes them
const ACTION_SELECTED_CLASS: Record<Action, string> = {
  fold: 'bg-fold text-white',
  call: 'bg-call text-white',
  raise: 'bg-raise text-white',
  jam: 'bg-jam text-white',
};

export default function FrequencyModal({ hand, frequencies, onSave, onClose }: Props) {
  // Work in integer percentages (0–100) for a clean quarter-step UX
  const [values, setValues] = useState<Record<Action, number>>({
    fold: Math.round(frequencies.fold * 100),
    call: Math.round(frequencies.call * 100),
    raise: Math.round(frequencies.raise * 100),
    jam: Math.round(frequencies.jam * 100),
  });

  const sum = values.fold + values.call + values.raise + values.jam;
  const remaining = 100 - sum;
  const isSumValid = sum === 100;

  function handleSet(action: Action, pct: number) {
    const sumWithout = sum - values[action];
    if (sumWithout + pct > 100) return;
    setValues({ ...values, [action]: pct });
  }

  function setPure(action: Action) {
    setValues({ fold: 0, call: 0, raise: 0, jam: 0, [action]: 100 });
  }

  function handleSave() {
    if (!isSumValid) {
      alert(`Frequencies must sum to 100% (currently ${sum}%)`);
      return;
    }
    onSave({
      fold: values.fold / 100,
      call: values.call / 100,
      raise: values.raise / 100,
      jam: values.jam / 100,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl p-4 w-full max-w-xs">
        <h3 className="text-lg font-bold mb-3">{hand}</h3>

        {/* Quick pure-action buttons */}
        <div className="flex gap-2 mb-4">
          {ACTIONS.map((a) => (
            <button
              key={a}
              onClick={() => setPure(a)}
              className={`flex-1 py-1 rounded text-xs font-medium ${ACTION_SELECTED_CLASS[a]} hover:brightness-125`}
            >
              {ACTION_LABELS[a]}
            </button>
          ))}
        </div>

        {/* Budget bar */}
        <div
          className={`text-xs mb-3 px-2 py-1.5 rounded ${
            sum > 100
              ? 'bg-red-900/30 text-red-400'
              : remaining === 0
              ? 'bg-green-900/30 text-green-400'
              : 'bg-gray-700/50 text-yellow-400'
          }`}
        >
          {sum}/100 used ·{' '}
          {remaining > 0 ? `${remaining} remaining` : remaining === 0 ? 'fully allocated' : 'over budget'}
        </div>

        {/* Quarter-step selectors for each action */}
        <div className="flex flex-col gap-3">
          {ACTIONS.map((a) => {
            const sumWithout = sum - values[a];
            return (
              <div key={a}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-300">{ACTION_LABELS[a]}</span>
                  <span className="text-xs text-gray-400">{values[a]}%</span>
                </div>
                <div className="flex gap-1">
                  {QUARTER_STEPS.map((step) => {
                    const wouldExceed = sumWithout + step > 100;
                    const isSelected = values[a] === step;
                    return (
                      <button
                        key={step}
                        onClick={() => handleSet(a, step)}
                        disabled={wouldExceed}
                        className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                          isSelected
                            ? ACTION_SELECTED_CLASS[a]
                            : wouldExceed
                            ? 'bg-gray-700/50 text-gray-600 cursor-not-allowed'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {step}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSave}
            disabled={!isSumValid}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              isSumValid ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
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

