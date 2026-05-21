import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppSettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/storage/settings';

export default function Settings() {
  const [savedSettings, setSavedSettings] = useState<AppSettings>(() => loadSettings());
  const [settings, setSettings] = useState<AppSettings>(savedSettings);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>('');
  const hasChanges = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [settings, savedSettings]
  );

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSaved(false);
    setError('');
    setSettings((prev) => ({ ...prev, [key]: value }));
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
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="text-xl font-bold mb-4">Settings</h1>

      <div className="space-y-4">
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
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-700">Show frequencies in feedback</span>
            <input
              type="checkbox"
              checked={settings.showFrequenciesInFeedback}
              onChange={(e) => update('showFrequenciesInFeedback', e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-700">Include trash hands in training</span>
            <input
              type="checkbox"
              checked={settings.includeTrashHandsInTraining}
              onChange={(e) => update('includeTrashHandsInTraining', e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-700">Focus on mixed hands</span>
            <input
              type="checkbox"
              checked={settings.focusOnMixedHands}
              onChange={(e) => update('focusOnMixedHands', e.target.checked)}
            />
          </label>
          <p className="text-xs text-gray-500">
            Prioritizes 75/25 and 50/50 hands, suppresses pure actions. Border hands always get priority boost.
          </p>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-700">Show Mix button for mixed hands</span>
            <input
              type="checkbox"
              checked={settings.showMixButton}
              onChange={(e) => update('showMixButton', e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-700">Feedback sounds</span>
            <input
              type="checkbox"
              checked={settings.feedbackSounds}
              onChange={(e) => update('feedbackSounds', e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-700">Feedback vibration</span>
            <input
              type="checkbox"
              checked={settings.feedbackVibration}
              onChange={(e) => update('feedbackVibration', e.target.checked)}
            />
          </label>
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

      <Link to="/" className="block mt-6 text-sm text-gray-500 hover:text-gray-900">
        ← Dashboard
      </Link>
    </div>
  );
}
