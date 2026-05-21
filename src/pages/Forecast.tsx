import { Disclosure } from '@headlessui/react';
import { useEffect, useMemo, useState } from 'react';
import { getAllCards } from '@/storage/cards';
import { getAllRanges } from '@/storage/ranges';
import { getAllSpots } from '@/storage/spots';
import { loadSettings } from '@/storage/settings';
import { Spot, SpotRange, TrainerCard } from '@/domain/types';
import {
  computeForecast,
  estimateBacklogDays,
  OverallForecast,
  CategoryForecast,
  ForecastDay,
} from '@/domain/forecast';

const POOL_COLORS: Record<string, string> = {
  problem: 'bg-red-500',
  learning: 'bg-yellow-400',
  review: 'bg-blue-500',
  new: 'bg-gray-400',
  mastered: 'bg-emerald-500',
};

const POOL_LABELS: Record<string, string> = {
  problem: 'Problem',
  learning: 'Learning',
  review: 'Review',
  new: 'New',
  mastered: 'Mastered',
};

function PoolBar({ dist, total }: { dist: Record<string, number>; total: number }) {
  if (total === 0) return <div className="h-2 rounded-full bg-gray-100" />;
  const pools = ['problem', 'learning', 'review', 'mastered', 'new'] as const;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full">
      {pools.map((pool) => {
        const pct = (dist[pool] / total) * 100;
        if (pct === 0) return null;
        return (
          <div
            key={pool}
            className={POOL_COLORS[pool]}
            style={{ width: `${pct}%` }}
            title={`${POOL_LABELS[pool]}: ${dist[pool]}`}
          />
        );
      })}
    </div>
  );
}

function PoolLegend({ dist, total }: { dist: Record<string, number>; total: number }) {
  const pools = ['problem', 'learning', 'review', 'mastered', 'new'] as const;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
      {pools.map((pool) => (
        <span key={pool} className="flex items-center gap-1">
          <span className={`inline-block h-2 w-2 rounded-full ${POOL_COLORS[pool]}`} />
          {POOL_LABELS[pool]}: {dist[pool]}
          {total > 0 && (
            <span className="text-gray-400">({Math.round((dist[pool] / total) * 100)}%)</span>
          )}
        </span>
      ))}
    </div>
  );
}

function DailyChart({ days }: { days: ForecastDay[] }) {
  const maxCount = Math.max(...days.map((d) => d.dueCount), 1);
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-0 items-end gap-2" style={{ minWidth: `${days.length * 48}px` }}>
        {days.map((day) => {
          const heightPct = (day.dueCount / maxCount) * 100;
          const label = day.date.slice(5);
          return (
            <div key={day.date} className="flex w-10 shrink-0 flex-col items-center gap-1">
              <div className="text-xs text-gray-500">{day.dueCount}</div>
              <div className="w-full" style={{ height: '88px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div className="w-full overflow-hidden rounded-t" style={{ height: `${heightPct}%`, minHeight: day.dueCount > 0 ? '6px' : '0' }}>
                  {day.dueCount > 0 && (
                    <div className="flex h-full flex-col-reverse">
                      {day.reviewDue > 0 && (
                        <div className="bg-blue-500" style={{ flex: day.reviewDue }} title={`Review: ${day.reviewDue}`} />
                      )}
                      {day.learningDue > 0 && (
                        <div className="bg-yellow-400" style={{ flex: day.learningDue }} title={`Learning: ${day.learningDue}`} />
                      )}
                      {day.problemDue > 0 && (
                        <div className="bg-red-500" style={{ flex: day.problemDue }} title={`Problem: ${day.problemDue}`} />
                      )}
                      {day.newAvailable > 0 && (
                        <div className="bg-gray-400" style={{ flex: day.newAvailable }} title={`New: ${day.newAvailable}`} />
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-400">{label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CategoryRow({ cat }: { cat: CategoryForecast }) {
  const healthColorClass = cat.dueToday <= 10
    ? 'border-emerald-400'
    : cat.dueToday <= 30
      ? 'border-yellow-400'
      : 'border-red-400';

  return (
    <Disclosure as="div" className={`rounded-lg border border-l-4 border-gray-200 bg-white shadow-sm ${healthColorClass}`}>
      {({ open }) => (
        <>
          <Disclosure.Button className="flex w-full items-center justify-between p-3 text-left">
            <div>
              <div className="font-medium">{cat.categoryName}</div>
              <div className="text-xs text-gray-500">
                {cat.spotCount} spot{cat.spotCount !== 1 ? 's' : ''} · {cat.totalCards} cards
              </div>
            </div>
            <div className="flex items-center gap-3 text-right">
              <div>
                <div className="text-sm font-semibold text-red-600">{cat.dueToday} today</div>
                <div className="text-xs text-gray-500">{cat.dueThisWeek} this week</div>
              </div>
              <span className="text-gray-400">{open ? '▲' : '▼'}</span>
            </div>
          </Disclosure.Button>
          <Disclosure.Panel className="border-t border-gray-100 p-3 text-sm">
            <div className="mb-2">
              <PoolBar dist={cat.poolDistribution} total={cat.totalCards} />
            </div>
            <PoolLegend dist={cat.poolDistribution} total={cat.totalCards} />
            <div className="mt-2 text-xs text-gray-500">
              Est. daily review load: <span className="font-medium text-gray-700">{cat.estimatedDailyLoad}</span> cards/day
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}

function WorkloadEstimator({ forecast }: { forecast: OverallForecast }) {
  const [dailyCapacity, setDailyCapacity] = useState(100);
  const dailyNewDue = Math.round(forecast.backlogEstimate.dailyGrowthRate);
  const backlog = forecast.backlogEstimate.currentBacklog;

  const days = estimateBacklogDays(backlog, dailyCapacity, dailyNewDue);
  const net = dailyCapacity - dailyNewDue;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
      <h3 className="mb-3 font-semibold text-blue-900">Workload Estimator</h3>
      <div className="mb-3 flex items-center gap-3">
        <label className="whitespace-nowrap text-sm text-blue-900">Cards per day:</label>
        <input
          type="number"
          min={1}
          max={10000}
          value={dailyCapacity}
          onChange={(e) => setDailyCapacity(Math.max(1, parseInt(e.target.value, 10) || 1))}
          className="w-24 rounded border border-blue-200 bg-white px-2 py-1 text-sm"
        />
      </div>
      <div className="space-y-1 text-sm">
        <div>
          <span className="text-blue-800">Est. daily reviews due: </span>
          <span className="font-medium">{dailyNewDue} cards/day</span>
        </div>
        <div>
          <span className="text-blue-800">Current backlog: </span>
          <span className="font-medium">{backlog} cards</span>
        </div>
        <div className={`font-medium ${net > 0 ? 'text-emerald-600' : net < 0 ? 'text-red-600' : 'text-gray-700'}`}>
          {net > 0
            ? `Backlog shrinks by ${net} cards/day`
            : net < 0
              ? `Backlog grows by ${Math.abs(net)} cards/day`
              : 'Backlog stays the same'}
        </div>
        {days !== null ? (
          <div className="text-emerald-700">
            Days to clear backlog: <span className="font-semibold">{days} days</span>
          </div>
        ) : (
          <div className="text-red-600">
            Capacity is less than daily due — backlog will grow indefinitely.
          </div>
        )}
      </div>
    </div>
  );
}

export default function Forecast() {
  const [cards, setCards] = useState<TrainerCard[]>([]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [rangesBySpot, setRangesBySpot] = useState<Map<string, SpotRange>>(new Map());
  const [loading, setLoading] = useState(true);

  const settings = useMemo(() => loadSettings(), []);

  useEffect(() => {
    Promise.all([getAllCards(), getAllSpots(), getAllRanges()]).then(([loadedCards, loadedSpots, loadedRanges]) => {
      setCards(loadedCards);
      setSpots(loadedSpots);
      setRangesBySpot(new Map(loadedRanges.map(({ spotId, range }) => [spotId, range])));
      setLoading(false);
    });
  }, []);

  const forecast = useMemo(
    () => (loading ? null : computeForecast(cards, spots, settings, rangesBySpot)),
    [cards, spots, settings, rangesBySpot, loading]
  );

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <div className="text-gray-500">Loading forecast…</div>
      </div>
    );
  }

  if (!forecast) return null;

  const totalActive = forecast.activeCards;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Forecast</h1>
        <p className="mt-1 text-sm text-gray-600">
          You have {forecast.dueToday} cards due today across {forecast.categories.length} categories.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold text-gray-700">Summary</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Total cards</div>
            <div className="text-lg font-semibold">{forecast.totalCards}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Active cards</div>
            <div className="text-lg font-semibold">{forecast.activeCards}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Due today</div>
            <div className="text-lg font-semibold text-red-600">{forecast.dueToday}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Due tomorrow</div>
            <div className="text-lg font-semibold">{forecast.dueTomorrow}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Due this week</div>
            <div className="text-lg font-semibold">{forecast.dueThisWeek}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Due this month</div>
            <div className="text-lg font-semibold">{forecast.dueThisMonth}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-700">Pool Distribution</h2>
        <div className="mb-2">
          <PoolBar dist={forecast.poolDistribution} total={totalActive} />
        </div>
        <PoolLegend dist={forecast.poolDistribution} total={totalActive} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 font-semibold text-gray-700">14-Day Forecast</h2>
        <p className="mb-3 text-xs text-gray-500">
          Expected cards due per day based on current scheduling data.
        </p>
        <DailyChart days={forecast.dailyForecast} />
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-blue-500" />Review</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />Learning</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" />Problem</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-gray-400" />New</span>
        </div>
      </div>

      <WorkloadEstimator forecast={forecast} />

      {forecast.categories.length > 0 && (
        <div>
          <h2 className="mb-2 font-semibold text-gray-700">
            Per-Category Breakdown
          </h2>
          <div className="space-y-2">
            {forecast.categories.map((cat) => (
              <CategoryRow key={cat.categoryKey} cat={cat} />
            ))}
          </div>
        </div>
      )}

      {forecast.categories.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
          No cards yet. Start training to see forecast data.
        </div>
      )}
    </div>
  );
}
