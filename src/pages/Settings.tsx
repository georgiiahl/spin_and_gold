import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppSettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/storage/settings';

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [saved, setSaved] = useState(false);
  const hasChanges = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(loadSettings()),
    [settings]
  );

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSaved(false);
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    const normalized = {
      ...settings,
      flashDurationSec: Math.max(1, Math.min(10, Math.round(settings.flashDurationSec))),
      fastResponseMs: Math.max(200, Math.round(settings.fastResponseMs)),
      slowResponseMs: Math.max(1000, Math.round(settings.slowResponseMs)),
    };
    if (normalized.fastResponseMs >= normalized.slowResponseMs) {
      alert('Fast threshold must be lower than slow threshold.');
      return;
    }
    saveSettings(normalized);
    setSettings(normalized);
    setSaved(true);
  }

  function resetDefaults() {
    setSettings(DEFAULT_SETTINGS);
    setSaved(false);
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Settings</h1>

      <div className="space-y-4">
        <section className="bg-gray-800 rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Visual Mode</h2>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-300">Flash duration (seconds)</span>
            <input
              type="number"
              min={1}
              max={10}
              value={settings.flashDurationSec}
              onChange={(e) => update('flashDurationSec', Number(e.target.value))}
              className="bg-gray-700 rounded px-2 py-1 w-24"
            />
          </label>
        </section>

        <section className="bg-gray-800 rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Grading Speed Thresholds</h2>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-300">Fast answer &lt; (ms)</span>
            <input
              type="number"
              min={200}
              value={settings.fastResponseMs}
              onChange={(e) => update('fastResponseMs', Number(e.target.value))}
              className="bg-gray-700 rounded px-2 py-1 w-32"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-300">Slow answer &gt; (ms)</span>
            <input
              type="number"
              min={1000}
              value={settings.slowResponseMs}
              onChange={(e) => update('slowResponseMs', Number(e.target.value))}
              className="bg-gray-700 rounded px-2 py-1 w-32"
            />
          </label>
        </section>

        <section className="bg-gray-800 rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Trainer Behavior</h2>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-300">Show frequencies in feedback</span>
            <input
              type="checkbox"
              checked={settings.showFrequenciesInFeedback}
              onChange={(e) => update('showFrequenciesInFeedback', e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-300">Include trash hands in training</span>
            <input
              type="checkbox"
              checked={settings.includeTrashHandsInTraining}
              onChange={(e) => update('includeTrashHandsInTraining', e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-300">Focus on mixed hands</span>
            <input
              type="checkbox"
              checked={settings.focusOnMixedHands}
              onChange={(e) => update('focusOnMixedHands', e.target.checked)}
            />
          </label>
        </section>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-40"
        >
          {saved ? '✓ Saved' : 'Save'}
        </button>
        <button
          onClick={resetDefaults}
          className="px-4 py-2 bg-gray-700 rounded-lg text-sm font-medium hover:bg-gray-600"
        >
          Reset Defaults
        </button>
      </div>

      <Link to="/" className="block mt-6 text-sm text-gray-400 hover:text-white">
        ← Dashboard
      </Link>
    </div>
  );
}
