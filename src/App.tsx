import { Routes, Route } from 'react-router-dom';
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

export default function App() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col">
      <Routes>
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
        <Route path="/visual/flash/:id" element={<FlashRange />} />
        <Route path="/visual/missing/:id" element={<MissingCells />} />
        <Route path="/visual/border/:id" element={<BorderTrainer />} />
        <Route path="/stats" element={<GlobalStats />} />
        <Route path="/import-export" element={<ImportExport />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </div>
  );
}
