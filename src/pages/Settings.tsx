import { useMemo, useState } from 'react';
import { Switch } from '@headlessui/react';
import { AppSettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/storage/settings';

type Preset = {
  name: string;
  values: Pick<AppSettings, 'mixStrategy' | 'showMixButton' | 'focusOnMixedHands' | 'includeTrashHandsInTraining'>;
};

const PRESETS: Preset[] = [
  {
    name: 'Strict Frequencies',
    values: {
      mixStrategy: 'strict',
      showMixButton: true,
      focusOnMixedHands: true,
      includeTrashHandsInTraining: false,
    },
  },
  {
    name: 'Action Only',
    values: {
      mixStrategy: 'tolerant',
      showMixButton: false,
      focusOnMixedHands: false,
      includeTrashHandsInTraining: true,
    },
  },
  {
    name: 'Balanced',
    values: {
      mixStrategy: 'tolerant',
      showMixButton: true,
      focusOnMixedHands: false,
      includeTrashHandsInTraining: false,
    },
  },
];

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-gray-700">{label}</span>
      <Switch
        checked={checked}
        onChange={onChange}
        className={`group inline-flex min-h-[44px] w-14 items-center rounded-full p-1 transition ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
      >
        <span
          className={`h-6 w-6 rounded-full bg-white transition ${checked ? 'translate-x-6' : 'translate-x-0'}`}
        />
      </Switch>
    </label>
  );
}

export default function Settings() {
  const [savedSettings, setSavedSettings] = useState<AppSettings>(() => loadSettings());
  const [settings, setSettings] = useState<AppSettings>(savedSettings);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>('');
  const hasChanges = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [settings, savedSettings]
  );
  const conflictWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (settings.showMixButton && settings.mixStrategy === 'tolerant') {
      warnings.push('Mix button is enabled, but the tolerant strategy does not enforce exact mix frequencies.');
    }
    if (settings.focusOnMixedHands && settings.includeTrashHandsInTraining) {
      warnings.push('Focus on mixed hands conflicts with including trash hands in training.');
    }
    if (settings.focusOnMixedHands && settings.mixStrategy === 'tolerant') {
      warnings.push('Focusing mixed hands with tolerant strategy does not enforce strict mix accuracy.');
    }
    return warnings;
  }, [settings]);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSaved(false);
    setError('');
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function applyPreset(preset: Preset) {
    setSaved(false);
    setError('');
    setSettings((prev) => ({ ...prev, ...preset.values }));
  }

  function handleSave() {
    const normalized = {
      ...settings,
      flashDurationSec: Math.max(1, Math.min(10, Math.round(settings.flashDurationSec))),
      fastResponseMs: Math.max(200, Math.round(settings.fastResponseMs)),
      slowResponseMs: Math.max(1000, Math.round(settings.slowResponseMs)),
      mixThreshold: Math.max(0, Math.min(1, Number(settings.mixThreshold.toFixed(2)))),
      desiredRetention: Math.max(0.7, Math.min(0.99, Number(settings.desiredRetention.toFixed(2)))),
      retryMinDelaySec: Math.max(10, Math.round(settings.retryMinDelaySec)),
      sameSpotCooldown: Math.max(2, Math.round(settings.sameSpotCooldown)),
    };
    if (normalized.fastResponseMs >= normalized.slowResponseMs) {
      setError('Fast response threshold must be less than slow response threshold.');
      return;
    }
    setError('');
    saveSettings(normalized);
    setSavedSettings(normalized);
    setSettings(normalized);
    setSaved(true);
  }

  function resetDefaults() {
    setSettings(DEFAULT_SETTINGS);
    setSaved(false);
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="mb-4 text-xl font-bold">Settings</h1>

      <div className="space-y-4">
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Presets</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {preset.name}
              </button>
            ))}
          </div>
          {conflictWarnings.length > 0 && (
            <div className="space-y-2">
              {conflictWarnings.map((warning) => (
                <div key={warning} className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                  {warning}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Visual Mode</h2>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-700">Flash duration (seconds)</span>
            <input
              type="number"
              min={1}
              max={10}
              value={settings.flashDurationSec}
              onChange={(e) => update('flashDurationSec', Number(e.target.value))}
              className="w-24 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-gray-900"
            />
          </label>
        </section>

        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Grading Speed Thresholds</h2>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-700">Fast answer &lt; (ms)</span>
            <input
              type="number"
              min={200}
              value={settings.fastResponseMs}
              onChange={(e) => update('fastResponseMs', Number(e.target.value))}
              className="w-32 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-gray-900"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-700">Slow answer &gt; (ms)</span>
            <input
              type="number"
              min={1000}
              value={settings.slowResponseMs}
              onChange={(e) => update('slowResponseMs', Number(e.target.value))}
              className="w-32 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-gray-900"
            />
          </label>
        </section>

        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Trainer Behavior</h2>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-700">Mix strategy</span>
            <select
              value={settings.mixStrategy}
              onChange={(e) => update('mixStrategy', e.target.value as AppSettings['mixStrategy'])}
              className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-gray-900"
            >
              <option value="strict">Strict (primary only)</option>
              <option value="tolerant">Tolerant (any &gt; 0)</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-700">Strict mix threshold</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={settings.mixThreshold}
              onChange={(e) => update('mixThreshold', Number(e.target.value))}
              className="w-24 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-gray-900"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-700">Desired retention (FSRS)</span>
            <input
              type="number"
              min={0.7}
              max={0.99}
              step={0.01}
              value={settings.desiredRetention}
              onChange={(e) => update('desiredRetention', Number(e.target.value))}
              className="w-24 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-gray-900"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-700">Retry minimum delay (sec)</span>
            <input
              type="number"
              min={10}
              value={settings.retryMinDelaySec}
              onChange={(e) => update('retryMinDelaySec', Number(e.target.value))}
              className="w-24 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-gray-900"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-700">Same spot cooldown (cards)</span>
            <input
              type="number"
              min={2}
              value={settings.sameSpotCooldown}
              onChange={(e) => update('sameSpotCooldown', Number(e.target.value))}
              className="w-24 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-gray-900"
            />
          </label>
          <ToggleRow
            label="Show frequencies in feedback"
            checked={settings.showFrequenciesInFeedback}
            onChange={(checked) => update('showFrequenciesInFeedback', checked)}
          />
          <ToggleRow
            label="Include trash hands in training"
            checked={settings.includeTrashHandsInTraining}
            onChange={(checked) => update('includeTrashHandsInTraining', checked)}
          />
          <ToggleRow
            label="Focus on mixed hands"
            checked={settings.focusOnMixedHands}
            onChange={(checked) => update('focusOnMixedHands', checked)}
          />
          <p className="text-xs text-gray-500">
            Prioritizes 75/25, 50/50, and 25/75 hands, suppresses pure actions. Border hands always get priority boost.
          </p>
          <ToggleRow
            label="Show Mix button for mixed hands"
            checked={settings.showMixButton}
            onChange={(checked) => update('showMixButton', checked)}
          />
          <ToggleRow
            label="Feedback sounds"
            checked={settings.feedbackSounds}
            onChange={(checked) => update('feedbackSounds', checked)}
          />
          <ToggleRow
            label="Feedback vibration"
            checked={settings.feedbackVibration}
            onChange={(checked) => update('feedbackVibration', checked)}
          />
        </section>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
        >
          {saved ? '✓ Saved' : 'Save'}
        </button>
        <button
          onClick={resetDefaults}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Reset Defaults
        </button>
      </div>

      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
    </div>
  );
}
