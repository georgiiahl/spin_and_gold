import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg"
      role="alert"
    >
      <span>🔄 New version available</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="rounded-lg bg-blue-500 px-3 py-1 font-medium hover:bg-blue-400"
      >
        Update
      </button>
      <button
        onClick={() => updateServiceWorker(false)}
        className="text-gray-400 hover:text-gray-200"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
