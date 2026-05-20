import { Routes, Route } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';
import SpotList from '@/pages/SpotList';
import SpotForm from '@/pages/SpotForm';

export default function App() {
  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/spots" element={<SpotList />} />
        <Route path="/spots/new" element={<SpotForm />} />
        <Route path="/spots/:id/edit" element={<SpotForm />} />
      </Routes>
    </div>
  );
}
