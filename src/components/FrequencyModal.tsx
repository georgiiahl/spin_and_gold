import { useState } from 'react';
import { Action, HandFrequencies } from '@/domain/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

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
    <Modal open onClose={onClose} title={hand}>
      <div className="w-full max-w-xs text-slate-100">

        {/* Quick pure-action buttons */}
        <div className="flex gap-2 mb-4">
          {ACTIONS.map((a) => (
            <button
              key={a}
              onClick={() => setPure(a)}
              className={`flex-1 rounded py-1 text-xs font-medium ${ACTION_SELECTED_CLASS[a]} hover:brightness-125`}
              aria-label={`Set ${ACTION_LABELS[a]} to 100 percent`}
            >
              {ACTION_LABELS[a]}
            </button>
          ))}
        </div>

        {/* Budget bar */}
        <div
          className={`text-xs mb-3 px-2 py-1.5 rounded ${
            sum > 100
             ? 'bg-red-500/20 text-red-300'
              : remaining === 0
             ? 'bg-emerald-500/20 text-emerald-300'
             : 'bg-slate-800 text-amber-300'
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
                  <span className="text-xs font-medium text-slate-300">{ACTION_LABELS[a]}</span>
                  <span className="text-xs text-slate-400">{values[a]}%</span>
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
                        aria-label={`Set ${ACTION_LABELS[a]} to ${step} percent`}
                        className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                          isSelected
                             ? ACTION_SELECTED_CLASS[a]
                          : wouldExceed
                           ? 'cursor-not-allowed bg-slate-800 text-slate-500'
                             : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
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

        <div className="mt-4 flex gap-2">
          <Button
            onClick={handleSave}
            disabled={!isSumValid}
            className="flex-1"
            aria-label="Save frequencies"
          >
            Save
          </Button>
          <Button
            onClick={onClose}
            variant="secondary"
            className="flex-1"
            aria-label="Cancel frequency editor"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
