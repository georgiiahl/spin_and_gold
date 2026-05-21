import { useEffect, useState } from 'react';

const IOS_DISMISSED_KEY = 'spin-gold-ios-install-dismissed';
const ANDROID_DISMISSED_KEY = 'spin-gold-android-install-dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isStandalone =
    'standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone;
  return isIos && !isStandalone;
}

export function InstallBanner() {
  const [showIos, setShowIos] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroid, setShowAndroid] = useState(false);

  useEffect(() => {
    // iOS detection
    if (isIosSafari() && !localStorage.getItem(IOS_DISMISSED_KEY)) {
      setShowIos(true);
    }

    // Android install prompt
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      const prompt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(prompt);
      if (!localStorage.getItem(ANDROID_DISMISSED_KEY)) {
        setShowAndroid(true);
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  function dismissIos() {
    localStorage.setItem(IOS_DISMISSED_KEY, '1');
    setShowIos(false);
  }

  async function handleAndroidInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem(ANDROID_DISMISSED_KEY, '1');
    }
    setShowAndroid(false);
    setDeferredPrompt(null);
  }

  function dismissAndroid() {
    localStorage.setItem(ANDROID_DISMISSED_KEY, '1');
    setShowAndroid(false);
  }

  if (showIos) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 flex items-start gap-3 bg-blue-50 border-t border-blue-200 px-4 py-3 text-sm shadow-lg">
        <span className="text-2xl leading-none">📲</span>
        <div className="flex-1">
          <p className="font-semibold text-blue-900">Install to Home Screen</p>
          <p className="text-blue-700 text-xs mt-0.5">
            Safari may erase your data after 7 days. Tap{' '}
            <span className="font-semibold">Share → Add to Home Screen</span> to keep your progress
            safe.
          </p>
        </div>
        <button
          onClick={dismissIos}
          className="text-blue-400 hover:text-blue-600 text-lg leading-none"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    );
  }

  if (showAndroid) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 flex items-start gap-3 bg-blue-50 border-t border-blue-200 px-4 py-3 text-sm shadow-lg">
        <span className="text-2xl leading-none">📲</span>
        <div className="flex-1">
          <p className="font-semibold text-blue-900">Install App</p>
          <p className="text-blue-700 text-xs mt-0.5">
            Add Spin &amp; Gold Trainer to your home screen for offline access and easy reopening.
          </p>
        </div>
        <button
          onClick={handleAndroidInstall}
          className="rounded-lg bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-500 whitespace-nowrap"
        >
          Install
        </button>
        <button
          onClick={dismissAndroid}
          className="text-blue-400 hover:text-blue-600 text-lg leading-none"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    );
  }

  return null;
}
