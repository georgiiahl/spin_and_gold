import { useEffect, useMemo, useRef, useState } from 'react';
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

const VIEWPORT_RESERVED_HEIGHT = 120;
const MIN_GRID_HEIGHT = 240;
const MIN_GRID_WIDTH = 320;
const MAX_GRID_WIDTH = 1152;
const MIN_CHART_SIZE = 40;

export default function PracticeView() {
  const navigate = useNavigate();
  const { category: categoryFromPath } = useParams<{ category?: string }>();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [spotRanges, setSpotRanges] = useState<SpotWithRange[]>([]);
  const [categories, setCategories] = useState<PracticeCategory[]>([]);
  const resizeRafRef = useRef<number | null>(null);
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

  useEffect(() => {
    function handleResize() {
      if (resizeRafRef.current !== null) {
        cancelAnimationFrame(resizeRafRef.current);
      }
      resizeRafRef.current = requestAnimationFrame(() => {
        setViewportSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
        resizeRafRef.current = null;
      });
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeRafRef.current !== null) {
        cancelAnimationFrame(resizeRafRef.current);
      }
    };
  }, []);

  const gridLayout = useMemo(() => {
    const count = spotRanges.length;
    if (count === 0) return { columns: 1, chartSize: 0 };

    const gap = viewportSize.width < 640 ? 8 : 12;
    const labelHeight = 16;
    const availableHeight = Math.max(viewportSize.height - VIEWPORT_RESERVED_HEIGHT, MIN_GRID_HEIGHT);
    const availableWidth = Math.max(Math.min(viewportSize.width - 32, MAX_GRID_WIDTH), MIN_GRID_WIDTH);
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

    return { columns: bestColumns, chartSize: Math.max(bestSize, MIN_CHART_SIZE) };
  }, [spotRanges.length, viewportSize.height, viewportSize.width]);

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
    <div className="mx-auto w-full max-w-6xl px-2 sm:px-3">
      <div className="mb-3">
        <h1 className="text-xl font-bold">Practice View</h1>
        <div className="text-sm text-gray-500">{category}</div>
      </div>

      <div
        className="grid gap-2 overflow-hidden sm:gap-3"
        style={{
          height: `calc(100vh - ${VIEWPORT_RESERVED_HEIGHT}px)`,
          gridTemplateColumns: `repeat(${gridLayout.columns}, minmax(0, 1fr))`,
        }}
      >
        {spotRanges.map(({ spot, range }) => (
          <div
            key={spot.id}
            className="flex min-h-0 flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-sm"
          >
            <div className="text-[10px] font-semibold text-gray-700 sm:text-xs">{spot.effectiveStackBb}bb</div>
            <div style={{ width: `${gridLayout.chartSize}px` }} className="max-w-full">
              <RangeMatrix range={range} activeAction="fold" mode="simple" readOnly compact />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
