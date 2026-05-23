import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Spot, GameFormat, getSpotCategoryLabel } from '@/domain/types';
import { getAllSpots, deleteSpot, saveSpot } from '@/storage/spots';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

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
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Spots</h1>
        <Link to="/admin/spots/new">
          <Button aria-label="Create new spot">+ New</Button>
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
        <Input
          type="number"
          placeholder="Stack bb"
          value={filterStack}
          onChange={(e) => setFilterStack(e.target.value)}
          className="w-24"
          aria-label="Filter by stack"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-gray-500">No spots yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {groupedEntries.map(([category, categorySpots]) => (
            <Card key={category}>
              <div className="mb-2 flex items-center justify-between">
                <div className="font-semibold">{category}</div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/practice/${encodeURIComponent(category)}`}
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                  >
                    Practice
                  </Link>
                  <div className="text-xs text-slate-400">
                    {categorySpots.length} spot{categorySpots.length === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {categorySpots.map((spot) => (
                  <div key={spot.id} className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        aria-label={`Edit spot ${spot.title}`}
                        className="flex-1 text-left"
                        onClick={() => navigate(`/admin/spots/${spot.id}/edit`)}
                      >
                        <div className="font-medium">{spot.title}</div>
                        <div className="text-xs text-slate-400">
                          {spot.format} · {spot.effectiveStackBb}bb · {spot.actingPosition}
                          {spot.history.length > 0 &&
                            ' · ' + spot.history.map((h) => `${h.position} ${h.action}`).join(' → ')}
                        </div>
                      </button>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDuplicate(spot)}
                          className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                          title="Duplicate"
                          aria-label={`Duplicate spot ${spot.title}`}
                        >
                          ⧉
                        </button>
                        <button
                          onClick={() => handleDelete(spot.id)}
                          className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-300 hover:bg-red-500/30"
                          title="Delete"
                          aria-label={`Delete spot ${spot.title}`}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2 text-xs">
                      <button
                        onClick={() => navigate(`/admin/spots/${spot.id}/range`)}
                        className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-200 hover:bg-slate-700"
                        aria-label={`Open chart editor for ${spot.title}`}
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
                        className="rounded bg-gradient-to-r from-gold-500 to-amber-400 px-2 py-1 text-slate-950 hover:brightness-105"
                        aria-label={`Train spot ${spot.title}`}
                      >
                        Train
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

    </div>
  );
}
