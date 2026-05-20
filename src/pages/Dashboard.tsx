import { Link } from 'react-router-dom';

export default function Dashboard() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">Spin & Gold Trainer</h1>
      <div className="flex flex-col gap-3">
        <Link
          to="/spots"
          className="block p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
        >
          <div className="font-semibold">Spots</div>
          <div className="text-sm text-gray-400">Manage your preflop spots</div>
        </Link>
      </div>
    </div>
  );
}
