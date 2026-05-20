import { Routes, Route } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';

export default function App() {
  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col">
      <Routes>
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </div>
  );
}
