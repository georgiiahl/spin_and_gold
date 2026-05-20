import { Routes, Route } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';
import SpotList from '@/pages/SpotList';
import SpotForm from '@/pages/SpotForm';
import ChartEditor from '@/pages/ChartEditor';
import Trainer from '@/pages/Trainer';
import FlashRange from '@/pages/FlashRange';
import MissingCells from '@/pages/MissingCells';
import BorderTrainer from '@/pages/BorderTrainer';

export default function App() {
  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/spots" element={<SpotList />} />
        <Route path="/spots/new" element={<SpotForm />} />
        <Route path="/spots/:id/edit" element={<SpotForm />} />
        <Route path="/spots/:id/range" element={<ChartEditor />} />
        <Route path="/train/:id" element={<Trainer />} />
        <Route path="/visual/flash/:id" element={<FlashRange />} />
        <Route path="/visual/missing/:id" element={<MissingCells />} />
        <Route path="/visual/border/:id" element={<BorderTrainer />} />
      </Routes>
    </div>
  );
}
