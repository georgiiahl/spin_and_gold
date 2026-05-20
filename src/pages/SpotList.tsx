import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Spot, GameFormat, getSpotCategoryLabel } from '@/domain/types';
import { getAllSpots, deleteSpot, saveSpot } from '@/storage/spots';

export default function SpotList() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [filterFormat, setFilterFormat] = useState<GameFormat | 'all'>('all');
  const [filterStack, setFilterStack] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    loadSpots();
  }, []);

  async function loadSpots() {
    const all = await getAllSpots();
    setSpots(all.sort((a, b) => b.updatedAt - a.updatedAt));
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this spot?')) return;
    await deleteSpot(id);
    await loadSpots();
  }

  async function handleDuplicate(spot: Spot) {
    const copy: Spot = {
      ...spot,
      id: spot.id + '_copy_' + Date.now(),
      title: spot.title + ' (copy)',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveSpot(copy);
    await loadSpots();
  }

  const filtered = spots.filter((s) => {
    if (filterFormat !== 'all' && s.format !== filterFormat) return false;
    if (filterStack && s.effectiveStackBb !== Number(filterStack)) return false;
    return true;
  });

  const grouped = filtered.reduce<Map<string, Spot[]>>((groups, spot) => {
    const category = getSpotCategoryLabel(spot.category);
    groups.set(category, [...(groups.get(category) ?? []), spot]);
    return groups;
  }, new Map());

  const groupedEntries = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="mx-auto max-w-4xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Spots</h1>
        <Link
          to="/spots/new"
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          + New
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <select
          value={filterFormat}
          onChange={(e) => setFilterFormat(e.target.value as GameFormat | 'all')}
          className="bg-white border border-gray-200 rounded px-2 py-1 text-sm"
        >
          <option value="all">All formats</option>
          <option value="3max">3-max</option>
          <option value="hu">HU</option>
        </select>
        <input
          type="number"
          placeholder="Stack bb"
          value={filterStack}
          onChange={(e) => setFilterStack(e.target.value)}
          className="bg-white border border-gray-200 rounded px-2 py-1 text-sm w-24"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-gray-500">No spots yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {groupedEntries.map(([category, categorySpots]) => (
            <div key={category} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-semibold">{category}</div>
                <div className="text-xs text-gray-500">
                  {categorySpots.length} spot{categorySpots.length === 1 ? '' : 's'}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {categorySpots.map((spot) => (
                  <div key={spot.id} className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className="cursor-pointer flex-1"
                        onClick={() => navigate(`/spots/${spot.id}/edit`)}
                      >
                        <div className="font-medium">{spot.title}</div>
                        <div className="text-xs text-gray-500">
                          {spot.format} · {spot.effectiveStackBb}bb · {spot.actingPosition}
                          {spot.history.length > 0 &&
                            ' · ' + spot.history.map((h) => `${h.position} ${h.action}`).join(' → ')}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDuplicate(spot)}
                          className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                          title="Duplicate"
                        >
                          ⧉
                        </button>
                        <button
                          onClick={() => handleDelete(spot.id)}
                          className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2 text-xs">
                      <button
                        onClick={() => navigate(`/spots/${spot.id}/range`)}
                        className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-gray-700 hover:bg-gray-100"
                      >
                        Chart
                      </button>
                      <button
                        onClick={() => navigate(`/study/${spot.id}`)}
                        className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-gray-700 hover:bg-gray-100"
                      >
                        Study
                      </button>
                      <button
                        onClick={() => navigate(`/train/${spot.id}`)}
                        className="rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-500"
                      >
                        Train
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Link to="/" className="block mt-6 text-sm text-gray-500 hover:text-gray-900">
        ← Dashboard
      </Link>
    </div>
  );
}
