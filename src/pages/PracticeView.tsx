import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import RangeMatrix from '@/components/RangeMatrix';
import { Spot, SpotRange, getSpotCategoryLabel, normalizeSpotCategory } from '@/domain/types';
import { getRange } from '@/storage/ranges';
import { getAllSpots, getSpotsByCategory } from '@/storage/spots';
import Card from '@/components/ui/Card';

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
      if (!category) {
        setLoading(true);
        const allSpots = await getAllSpots();
        if (cancelled) return;
        const grouped = new Map<string, number>();
        for (const spot of allSpots) {
          const categoryName = getSpotCategoryLabel(spot.category);
          grouped.set(categoryName, (grouped.get(categoryName) ?? 0) + 1);
        }
        setCategories(
          Array.from(grouped.entries())
            .map(([name, spotCount]) => ({ name, spotCount }))
            .sort((a, b) => b.spotCount - a.spotCount || a.name.localeCompare(b.name))
        );
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
    return <div className="flex min-h-[40vh] items-center justify-center text-slate-400">Loading...</div>;
  }

  if (!category) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Practice View</h1>
          <div className="text-sm text-slate-400">Choose a category to start practice.</div>
        </div>
        {categories.length === 0 ? (
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-sm text-slate-400">
            No categories found. Add spots first.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {categories.map((entry) => (
              <Card
                key={entry.name}
                role="button"
                tabIndex={0}
                aria-label={`Open practice category ${entry.name}`}
                onClick={() => navigate(`/practice/${encodeURIComponent(entry.name)}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/practice/${encodeURIComponent(entry.name)}`);
                  }
                }}
                className="cursor-pointer"
                hover
              >
                <div className="font-semibold text-slate-100">{entry.name}</div>
                <div className="text-sm text-slate-400">
                  {entry.spotCount} spot{entry.spotCount === 1 ? '' : 's'}
                </div>
              </Card>
            ))}
          </div>
        )}
        <Link to="/" className="inline-block text-sm text-gold-300">Back to dashboard</Link>
      </div>
    );
  }

  if (spotRanges.length === 0) {
    return (
      <div className="mx-auto flex min-h-[40vh] w-full max-w-4xl flex-col items-center justify-center gap-2">
        <p className="text-amber-300">No ranges found for this category.</p>
        <Link to="/" className="text-sm text-gold-300">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-100">Practice View</h1>
        <div className="text-sm text-slate-400">{category}</div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {spotRanges.map(({ spot, range }) => (
          <Card
            key={spot.id}
            role="button"
            tabIndex={0}
            aria-label={`Start training ${spot.title}`}
            onClick={() => navigate(`/train/${spot.id}`)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigate(`/train/${spot.id}`);
              }
            }}
            className="cursor-pointer p-3 text-left"
            hover
          >
            <div className="mb-2">
              <div className="text-sm font-semibold text-slate-100">{spot.effectiveStackBb}bb</div>
              <div className="truncate text-xs text-slate-400">{spot.title}</div>
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
          </Card>
        ))}
      </div>
    </div>
  );
}
