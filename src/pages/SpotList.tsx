import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Spot, GameFormat } from '@/domain/types';
import { encodeSpotCategory, getSpotCategoryLabel } from '@/domain/spotCategories';
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

  const grouped = filtered.reduce<Record<string, Spot[]>>((groups, spot) => {
    const category = getSpotCategoryLabel(spot.category);
    groups[category] = [...(groups[category] ?? []), spot];
    return groups;
  }, {});

  const groupedEntries = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Spots</h1>
        <Link
          to="/spots/new"
          className="px-3 py-2 bg-blue-600 rounded-lg text-sm font-medium hover:bg-blue-500"
        >
          + New
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <select
          value={filterFormat}
          onChange={(e) => setFilterFormat(e.target.value as GameFormat | 'all')}
          className="bg-gray-800 rounded px-2 py-1 text-sm"
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
          className="bg-gray-800 rounded px-2 py-1 text-sm w-24"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-gray-500">No spots yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {groupedEntries.map(([category, categorySpots]) => (
            <div key={category} className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-semibold">{category}</div>
                  <div className="text-xs text-gray-400">{categorySpots.length} spot{categorySpots.length === 1 ? '' : 's'}</div>
                </div>
                <button
                  onClick={() => navigate(`/train/category/${encodeSpotCategory(category)}`)}
                  className="px-2 py-1 bg-blue-700 rounded text-xs hover:bg-blue-600"
                >
                  Train
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {categorySpots.map((spot) => (
                  <div key={spot.id} className="bg-gray-800 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className="cursor-pointer flex-1"
                        onClick={() => navigate(`/spots/${spot.id}/edit`)}
                      >
                        <div className="font-medium">{spot.title}</div>
                        <div className="text-xs text-gray-400">
                          {spot.format} · {spot.effectiveStackBb}bb · {spot.actingPosition}
                          {spot.history.length > 0 &&
                            ' · ' + spot.history.map((h) => `${h.position} ${h.action}`).join(' → ')}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDuplicate(spot)}
                          className="text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
                          title="Duplicate"
                        >
                          ⧉
                        </button>
                        <button
                          onClick={() => handleDelete(spot.id)}
                          className="text-xs px-2 py-1 bg-red-900/50 rounded hover:bg-red-800"
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2 text-xs">
                      <button
                        onClick={() => navigate(`/spots/${spot.id}/range`)}
                        className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
                      >
                        Chart
                      </button>
                      <button
                        onClick={() => navigate(`/study/${spot.id}`)}
                        className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
                      >
                        Study
                      </button>
                      <button
                        onClick={() => navigate(`/train/${spot.id}`)}
                        className="px-2 py-1 bg-blue-700 rounded hover:bg-blue-600"
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

      <Link to="/" className="block mt-6 text-sm text-gray-400 hover:text-white">
        ← Dashboard
      </Link>
    </div>
  );
}
