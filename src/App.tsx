import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';
import SpotList from '@/pages/SpotList';
import SpotForm from '@/pages/SpotForm';
import ChartEditor from '@/pages/ChartEditor';
import Trainer from '@/pages/Trainer';
import FlashRange from '@/pages/FlashRange';
import MissingCells from '@/pages/MissingCells';
import BorderTrainer from '@/pages/BorderTrainer';
import SpotStats from '@/pages/SpotStats';
import GlobalStats from '@/pages/GlobalStats';
import StudyMode from '@/pages/StudyMode';
import ImportExport from '@/pages/ImportExport';
import Settings from '@/pages/Settings';
import Forecast from '@/pages/Forecast';
import ReviewPage from '@/pages/ReviewPage';
import PracticeView from '@/pages/PracticeView';
import ChipEvStats from '@/pages/ChipEvStats';
import DeltaTrainer from '@/pages/DeltaTrainer';
import { getAllSpots } from '@/storage/spots';
import { seedBundledCharts } from '@/storage/seedBundledCharts';
import { replaceAllData } from '@/storage/importExport';
import { SETTINGS_KEY } from '@/storage/settings';
import { decodeSyncPayload } from '@/storage/sync';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { InstallBanner } from '@/components/InstallBanner';
import Layout from '@/components/Layout';

export default function App() {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    getAllSpots().then((spots) => {
      if (!mounted || spots.length > 0) return;
      seedBundledCharts().then((result) => {
        if (!mounted) return;
        if (result.importedSpots > 0) {
          console.log(`[seedBundledCharts] Auto-imported ${result.importedSpots} spot(s) from ${result.importedFiles.length} file(s).`);
        }
      }).catch((err) => {
        if (!mounted) return;
        console.warn('[seedBundledCharts] Auto-seed failed:', err);
      });
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function importFromSyncHash() {
      const payload = decodeSyncPayload(window.location.hash);
      if (!payload) return;
      const confirmed = confirm('Import synced data from another device? This will replace your current data.');
      if (!confirmed) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        return;
      }
      try {
        await replaceAllData(payload.data.spots, payload.data.ranges, payload.data.cards, payload.data.sessions);
        if (payload.data.settings) {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload.data.settings));
        }
        if (!cancelled) {
          alert('Sync import completed successfully.');
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          navigate('/', { replace: true });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sync import failed.';
        alert(message);
      }
    }

    importFromSyncHash();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <ErrorBoundary>
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col">
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/spots" element={<SpotList />} />
            <Route path="/spots/new" element={<SpotForm />} />
            <Route path="/spots/:id/edit" element={<SpotForm />} />
            <Route path="/spots/:id/range" element={<ChartEditor />} />
            <Route path="/spots/:id/stats" element={<SpotStats />} />
            <Route path="/spots/:id/study" element={<StudyMode />} />
            <Route path="/study/:id" element={<StudyMode />} />
            <Route path="/train" element={<Trainer />} />
            <Route path="/train/:id" element={<Trainer />} />
            <Route path="/practice" element={<PracticeView />} />
            <Route path="/practice/:category" element={<PracticeView />} />
            <Route path="/delta-trainer" element={<DeltaTrainer />} />
            <Route path="/delta-trainer/:category" element={<DeltaTrainer />} />
            <Route path="/visual/flash/:id" element={<FlashRange />} />
            <Route path="/visual/missing/:id" element={<MissingCells />} />
            <Route path="/visual/border/:id" element={<BorderTrainer />} />
            <Route path="/stats" element={<GlobalStats />} />
            <Route path="/import-export" element={<ImportExport />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/chip-ev" element={<ChipEvStats />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/forecast" element={<Forecast />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <UpdatePrompt />
        <InstallBanner />
      </div>
    </ErrorBoundary>
  );
}
