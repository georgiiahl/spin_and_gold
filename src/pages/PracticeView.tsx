import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import RangeMatrix from '@/components/RangeMatrix';
import { Spot, SpotRange, getSpotCategoryLabel, normalizeSpotCategory } from '@/domain/types';
import { getRange } from '@/storage/ranges';
import { getAllSpots, getSpotsByCategory } from '@/storage/spots';

type SpotWithRange = {
  spot: Spot;
  range: SpotRange;
};

type PracticeCategory = {
  name: string;
  spotCount: number;
};

export default function PracticeView() {
  const navigate = useNavigate();
  const { category: categoryFromPath } = useParams<{ category?: string }>();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [spotRanges, setSpotRanges] = useState<SpotWithRange[]>([]);
  const [categories, setCategories] = useState<PracticeCategory[]>([]);

  const category = useMemo(
    () => normalizeSpotCategory(categoryFromPath ?? searchParams.get('category') ?? undefined),
    [categoryFromPath, searchParams]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPracticeSpots() {
      setLoading(true);
      if (!category) {
        const allSpots = await getAllSpots();
        const categoryMap = allSpots.reduce<Map<string, PracticeCategory>>((map, spot) => {
          const name = getSpotCategoryLabel(spot.category);
          map.set(name, {
            name,
            spotCount: (map.get(name)?.spotCount ?? 0) + 1,
          });
          return map;
        }, new Map());
        const categoryList = Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        if (cancelled) return;
        setCategories(categoryList);
        setSpotRanges([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const spots = await getSpotsByCategory(category);
      const sortedSpots = [...spots].sort((a, b) => a.effectiveStackBb - b.effectiveStackBb);
      const ranges = await Promise.all(sortedSpots.map((spot) => getRange(spot.id)));

      if (cancelled) return;

      const nextSpotRanges = sortedSpots
        .map((spot, index) => ({ spot, range: ranges[index] }))
        .filter((entry): entry is SpotWithRange => Boolean(entry.range));
      setCategories([]);
      setSpotRanges(nextSpotRanges);
      setLoading(false);
    }

    loadPracticeSpots();
    return () => {
      cancelled = true;
    };
  }, [category]);

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center text-gray-400">Loading...</div>;
  }

  if (!category) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold">Practice</h1>
          <div className="text-sm text-gray-500">Select category</div>
        </div>
        {categories.length === 0 ? (
          <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2">
            <p className="text-yellow-600">No categories found.</p>
            <Link to="/" className="text-sm text-blue-600">Back to dashboard</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {categories.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => navigate(`/practice/${encodeURIComponent(item.name)}`)}
                className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:bg-gray-50"
              >
                <div className="font-semibold text-gray-900">{item.name}</div>
                <div className="text-sm text-gray-500">
                  {item.spotCount} spot{item.spotCount === 1 ? '' : 's'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (spotRanges.length === 0) {
    return (
      <div className="mx-auto flex min-h-[40vh] w-full max-w-4xl flex-col items-center justify-center gap-2">
        <p className="text-yellow-600">No ranges found for this category.</p>
        <Link to="/" className="text-sm text-blue-600">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Practice View</h1>
        <div className="text-sm text-gray-500">{category}</div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {spotRanges.map(({ spot, range }) => (
          <button
            key={spot.id}
            type="button"
            onClick={() => navigate(`/train/${spot.id}`)}
            className="rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:bg-gray-50"
          >
            <div className="mb-2">
              <div className="text-sm font-semibold text-gray-900">{spot.effectiveStackBb}bb</div>
              <div className="truncate text-xs text-gray-500">{spot.title}</div>
            </div>
            <div className="mx-auto w-[170px] max-w-full">
              <RangeMatrix
                range={range}
                onCellAction={() => {}}
                activeAction="fold"
                mode="simple"
                readOnly
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
