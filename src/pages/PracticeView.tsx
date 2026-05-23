import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import RangeMatrix from '@/components/RangeMatrix';
import { Spot, SpotRange, normalizeSpotCategory } from '@/domain/types';
import { getRange } from '@/storage/ranges';
import { getSpotsByCategory } from '@/storage/spots';

type SpotWithRange = {
  spot: Spot;
  range: SpotRange;
};

export default function PracticeView() {
  const { category: categoryFromPath } = useParams<{ category?: string }>();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [spotRanges, setSpotRanges] = useState<SpotWithRange[]>([]);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  const category = useMemo(
    () => normalizeSpotCategory(categoryFromPath ?? searchParams.get('category') ?? undefined),
    [categoryFromPath, searchParams]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPracticeSpots() {
      if (!category) {
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
      setSpotRanges(nextSpotRanges);
      setLoading(false);
    }

    loadPracticeSpots();
    return () => {
      cancelled = true;
    };
  }, [category]);

  useEffect(() => {
    function handleResize() {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const gridLayout = useMemo(() => {
    const count = spotRanges.length;
    if (count === 0) return { columns: 1, chartSize: 0 };

    const gap = viewportSize.width < 640 ? 8 : 12;
    const labelHeight = 16;
    const availableHeight = Math.max(viewportSize.height - 120, 240);
    const availableWidth = Math.max(Math.min(viewportSize.width - 32, 1152), 320);
    const minCols = viewportSize.width < 640 ? 2 : 1;

    let bestColumns = minCols;
    let bestSize = 0;

    for (let columns = minCols; columns <= count; columns += 1) {
      const rows = Math.ceil(count / columns);
      const widthBased = (availableWidth - gap * (columns - 1)) / columns;
      const heightBased = (availableHeight - gap * (rows - 1) - labelHeight * rows) / rows;
      const size = Math.floor(Math.min(widthBased, heightBased));
      if (size > bestSize) {
        bestSize = size;
        bestColumns = columns;
      }
    }

    return { columns: bestColumns, chartSize: Math.max(bestSize, 40) };
  }, [spotRanges.length, viewportSize.height, viewportSize.width]);

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center text-gray-400">Loading...</div>;
  }

  if (!category) {
    return (
      <div className="mx-auto flex min-h-[40vh] w-full max-w-4xl flex-col items-center justify-center gap-2">
        <p className="text-red-600">Category not provided.</p>
        <Link to="/" className="text-sm text-blue-600">Back to dashboard</Link>
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
    <div className="mx-auto w-full max-w-6xl px-2 sm:px-3">
      <div className="mb-3">
        <h1 className="text-xl font-bold">Practice View</h1>
        <div className="text-sm text-gray-500">{category}</div>
      </div>

      <div
        className="grid h-[calc(100vh-120px)] gap-2 overflow-hidden sm:gap-3"
        style={{ gridTemplateColumns: `repeat(${gridLayout.columns}, minmax(0, 1fr))` }}
      >
        {spotRanges.map(({ spot, range }) => (
          <div
            key={spot.id}
            className="flex min-h-0 flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-sm"
          >
            <div className="text-[10px] font-semibold text-gray-700 sm:text-xs">{spot.effectiveStackBb}bb</div>
            <div style={{ width: `${gridLayout.chartSize}px` }} className="max-w-full">
              <RangeMatrix range={range} onCellAction={() => {}} activeAction="fold" mode="simple" readOnly compact />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
