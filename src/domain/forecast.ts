import { TrainerCard, Spot, getSpotCategoryLabel, normalizeSpotCategory } from '@/domain/types';
import { classifyCardPool } from '@/domain/priority';

export type ForecastDay = {
  date: string; // YYYY-MM-DD
  dueCount: number;
  newAvailable: number;
  reviewDue: number;
  learningDue: number;
  problemDue: number;
};

export type CategoryForecast = {
  categoryKey: string;
  categoryName: string;
  spotCount: number;
  totalCards: number;
  dueToday: number;
  dueThisWeek: number;
  poolDistribution: Record<'problem' | 'learning' | 'review' | 'new' | 'mastered', number>;
  estimatedDailyLoad: number;
};

export type OverallForecast = {
  totalCards: number;
  activeCards: number;
  dueToday: number;
  dueTomorrow: number;
  dueThisWeek: number;
  dueThisMonth: number;
  poolDistribution: Record<'problem' | 'learning' | 'review' | 'new' | 'mastered', number>;
  dailyForecast: ForecastDay[]; // next 14 days
  categories: CategoryForecast[];
  backlogEstimate: { currentBacklog: number; dailyGrowthRate: number };
};

function toDateString(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfDay(offsetDays: number, now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.getTime();
}

function endOfDay(offsetDays: number, now: number): number {
  return startOfDay(offsetDays + 1, now) - 1;
}

function cardPoolToKey(card: TrainerCard): 'problem' | 'learning' | 'review' | 'new' | 'mastered' {
  if (card.memory.phase === 'mastered') return 'mastered';
  return classifyCardPool(card);
}

/**
 * Estimate how many reviews per day are expected from a set of cards.
 */
export function estimatedDailyLoadForCategory(cards: TrainerCard[]): number {
  let load = 0;
  for (const card of cards) {
    const pool = cardPoolToKey(card);
    if (pool === 'review' || pool === 'mastered') {
      const interval = card.memory.intervalDays > 0 ? card.memory.intervalDays : 1;
      load += 1 / interval;
    } else if (pool === 'learning') {
      // Learning cards typically see ~3 reviews per day (short-interval steps)
      load += 3;
    } else if (pool === 'problem') {
      // Problem cards are shown more aggressively, ~5 reviews per day
      load += 5;
    }
    // new cards don't contribute to daily review load estimate
  }
  return Math.round(load * 10) / 10;
}

/**
 * Estimate days to clear backlog.
 * Returns null if capacity <= dailyNewDue (backlog grows forever).
 */
export function estimateBacklogDays(
  backlog: number,
  dailyCapacity: number,
  dailyNewDue: number
): number | null {
  const netCapacity = dailyCapacity - dailyNewDue;
  if (netCapacity <= 0) return null;
  return Math.ceil(backlog / netCapacity);
}

/**
 * Compute full forecast from all cards and spots.
 */
export function computeForecast(
  cards: TrainerCard[],
  spots: Spot[],
  settings: { includeTrashHandsInTraining: boolean; focusOnMixedHands: boolean }
): OverallForecast {
  const now = Date.now();

  // Filter active cards (based on settings)
  const activeCards = settings.includeTrashHandsInTraining
    ? cards
    : cards.filter((card) => !(card.frequencies.fold === 1 && card.frequencies.call === 0 && card.frequencies.raise === 0 && card.frequencies.jam === 0));

  // Pool classification
  const poolDistribution: Record<'problem' | 'learning' | 'review' | 'new' | 'mastered', number> = {
    problem: 0,
    learning: 0,
    review: 0,
    new: 0,
    mastered: 0,
  };
  for (const card of activeCards) {
    poolDistribution[cardPoolToKey(card)]++;
  }

  // Due counts
  const todayEnd = endOfDay(0, now);
  const tomorrowEnd = endOfDay(1, now);
  const weekEnd = endOfDay(6, now);
  const monthEnd = endOfDay(29, now);

  let dueToday = 0;
  let dueTomorrow = 0;
  let dueThisWeek = 0;
  let dueThisMonth = 0;

  for (const card of activeCards) {
    const due = card.memory.dueAt ?? 0;
    if (due <= todayEnd) dueToday++;
    if (due <= tomorrowEnd) dueTomorrow++;
    if (due <= weekEnd) dueThisWeek++;
    if (due <= monthEnd) dueThisMonth++;
  }

  // Daily forecast for next 14 days
  const dailyForecast: ForecastDay[] = [];
  for (let i = 0; i < 14; i++) {
    const dayStart = startOfDay(i, now);
    const dayEnd = endOfDay(i, now);
    const dateStr = toDateString(dayStart);

    let reviewDue = 0;
    let learningDue = 0;
    let problemDue = 0;
    let newAvailable = 0;

    for (const card of activeCards) {
      const dueAt = card.memory.dueAt;
      // A card belongs to day i if:
      //   - day 0: no dueAt (new) or dueAt <= dayEnd (past-due or due today)
      //   - day 1+: dueAt falls within [dayStart, dayEnd]
      const belongsToDay =
        i === 0
          ? !dueAt || dueAt <= dayEnd
          : dueAt !== undefined && dueAt >= dayStart && dueAt <= dayEnd;
      if (!belongsToDay) continue;

      const pool = cardPoolToKey(card);
      if (pool === 'review' || pool === 'mastered') reviewDue++;
      else if (pool === 'learning') learningDue++;
      else if (pool === 'problem') problemDue++;
      else if (pool === 'new') newAvailable++;
    }

    dailyForecast.push({
      date: dateStr,
      dueCount: reviewDue + learningDue + problemDue + newAvailable,
      newAvailable,
      reviewDue,
      learningDue,
      problemDue,
    });
  }

  // Per-category forecasts
  const spotById = new Map(spots.map((s) => [s.id, s]));
  const cardsByCategory = new Map<string, TrainerCard[]>();
  const spotsByCategory = new Map<string, Set<string>>();

  for (const card of activeCards) {
    const spot = spotById.get(card.spotId);
    const categoryKey = normalizeSpotCategory(spot?.category) ?? '';
    const categoryCards = cardsByCategory.get(categoryKey) ?? [];
    categoryCards.push(card);
    cardsByCategory.set(categoryKey, categoryCards);
    const spotSet = spotsByCategory.get(categoryKey) ?? new Set<string>();
    spotSet.add(card.spotId);
    spotsByCategory.set(categoryKey, spotSet);
  }

  const categories: CategoryForecast[] = [];
  for (const [categoryKey, catCards] of cardsByCategory.entries()) {
    const sampleCard = catCards[0];
    const spot = sampleCard ? spotById.get(sampleCard.spotId) : undefined;
    const categoryName = getSpotCategoryLabel(spot?.category);

    const catPoolDist: Record<'problem' | 'learning' | 'review' | 'new' | 'mastered', number> = {
      problem: 0,
      learning: 0,
      review: 0,
      new: 0,
      mastered: 0,
    };
    let catDueToday = 0;
    let catDueThisWeek = 0;

    for (const card of catCards) {
      catPoolDist[cardPoolToKey(card)]++;
      const due = card.memory.dueAt ?? 0;
      if (due <= todayEnd) catDueToday++;
      if (due <= weekEnd) catDueThisWeek++;
    }

    const catSpots = spots.filter((s) => (normalizeSpotCategory(s.category) ?? '') === categoryKey);
    const spotCount = catSpots.length || (spotsByCategory.get(categoryKey)?.size ?? 0);

    categories.push({
      categoryKey,
      categoryName,
      spotCount,
      totalCards: catCards.length,
      dueToday: catDueToday,
      dueThisWeek: catDueThisWeek,
      poolDistribution: catPoolDist,
      estimatedDailyLoad: estimatedDailyLoadForCategory(catCards),
    });
  }

  categories.sort((a, b) => b.dueToday - a.dueToday || a.categoryName.localeCompare(b.categoryName));

  // Backlog estimate
  const estimatedDailyDue = estimatedDailyLoadForCategory(activeCards);
  const currentBacklog = dueToday;
  const dailyGrowthRate = estimatedDailyDue;

  return {
    totalCards: cards.length,
    activeCards: activeCards.length,
    dueToday,
    dueTomorrow,
    dueThisWeek,
    dueThisMonth,
    poolDistribution,
    dailyForecast,
    categories,
    backlogEstimate: { currentBacklog, dailyGrowthRate },
  };
}
