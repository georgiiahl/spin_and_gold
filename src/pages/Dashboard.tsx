import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllSpots } from '@/storage/spots';
import { getAllSessions } from '@/storage/sessions';
import { getAllCards } from '@/storage/cards';
import { SessionAnswer, Spot, TrainerCard, getSpotCategoryLabel, normalizeSpotCategory } from '@/domain/types';
import { buildCategoryProgress } from '@/domain/progress';
import Card from '@/components/ui/Card';

export default function Dashboard() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [sessions, setSessions] = useState<SessionAnswer[]>([]);
  const [cards, setCards] = useState<TrainerCard[]>([]);

  useEffect(() => {
    Promise.all([getAllSpots(), getAllSessions(), getAllCards()]).then(
      ([loadedSpots, loadedSessions, loadedCards]) => {
        setSpots(loadedSpots);
        setSessions(loadedSessions);
        setCards(loadedCards);
      }
    );
  }, []);

  const todaySessions = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return sessions.filter((session) => session.timestamp >= start.getTime());
  }, [sessions]);

  const accuracyToday = todaySessions.length > 0
    ? Math.round((todaySessions.filter((session) => session.isCorrect).length / todaySessions.length) * 100)
    : 0;

  const dueCardsBySpot = useMemo(() => {
    const now = Date.now();
    const map = new Map<string, number>();
    for (const card of cards) {
      const isDue = !card.memory.dueAt || card.memory.dueAt <= now;
      if (!isDue) continue;
      map.set(card.spotId, (map.get(card.spotId) ?? 0) + 1);
    }
    return map;
  }, [cards]);

  const dueCardsCount = [...dueCardsBySpot.values()].reduce((sum, count) => sum + count, 0);
  const categoryCards = useMemo(() => {
    const spotById = new Map(spots.map((spot) => [spot.id, spot]));
    const groups = new Map<string, {
      key: string;
      name: string;
      spotCount: number;
      dueCards: number;
      maturePercent: number;
      level: number;
      recentAccuracyPercent: number;
    }>();
    const spotsByCategory = new Map<string, Spot[]>();

    for (const spot of spots) {
      const key = normalizeSpotCategory(spot.category) ?? '';
      const name = getSpotCategoryLabel(spot.category);
      groups.set(name, {
        key,
        name,
        spotCount: (groups.get(name)?.spotCount ?? 0) + 1,
        dueCards: groups.get(name)?.dueCards ?? 0,
        maturePercent: 0,
        level: 0,
        recentAccuracyPercent: 0,
      });
      spotsByCategory.set(key, [...(spotsByCategory.get(key) ?? []), spot]);
    }

    for (const [spotId, count] of dueCardsBySpot.entries()) {
      const spot = spotById.get(spotId);
      if (!spot) continue;
      const name = getSpotCategoryLabel(spot.category);
      const group = groups.get(name);
      if (!group) continue;
      group.dueCards += count;
    }

    for (const group of groups.values()) {
      const categorySpots = spotsByCategory.get(group.key) ?? [];
      const progress = buildCategoryProgress(group.name, categorySpots, cards, sessions);
      const mature = progress.totalCards > 0
        ? (progress.masteredCards + progress.reviewCards) / progress.totalCards
        : 0;
      group.maturePercent = Math.round(mature * 100);
      group.level = progress.level;
      group.recentAccuracyPercent = Math.round(progress.recentAccuracy * 100);
    }

    return Array.from(groups.values()).sort(
      (a, b) => b.dueCards - a.dueCards || a.name.localeCompare(b.name)
    );
  }, [cards, dueCardsBySpot, sessions, spots]);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Card>
          <div className="text-xs text-slate-400">Total spots</div>
          <div className="text-lg font-semibold">{spots.length}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-400">Trained today</div>
          <div className="text-lg font-semibold">{todaySessions.length}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-400">Accuracy today</div>
          <div className="text-lg font-semibold">{accuracyToday}%</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-400">Due cards</div>
          <div className="text-lg font-semibold">{dueCardsCount}</div>
        </Card>
      </div>

      {categoryCards.length > 0 && (
        <div className="mb-4">
          <div className="mb-2">
            <div className="font-semibold">Choose training category</div>
            <div className="text-sm text-slate-400">
              Train one spot group at a time instead of mixing unrelated stacks and spots.
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {categoryCards.map((category) => (
              <Link
                key={category.name}
                to={`/train?category=${encodeURIComponent(category.name)}`}
                className="flex min-h-[56px] flex-col justify-center rounded-lg border border-slate-700 bg-slate-800/60 p-4 text-slate-100 transition hover:bg-slate-800"
                aria-label={`Train category ${category.name}`}
              >
                <div className="font-semibold text-slate-100">{category.name}</div>
                <div className="mb-2 text-sm text-slate-400">
                  {category.spotCount} spot{category.spotCount === 1 ? '' : 's'} · {category.dueCards} due card
                  {category.dueCards === 1 ? '' : 's'}
                </div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                  <span>Level {category.level}</span>
                  <span>Recent accuracy {category.recentAccuracyPercent}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-700">
                  <div
                    className="h-2 rounded-full bg-amber-400"
                    style={{ width: `${category.maturePercent}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-slate-400">{category.maturePercent}% mature cards</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {categoryCards.length === 0 && (
        <div className="mb-4 rounded-lg border border-dashed border-slate-600 bg-slate-900/70 p-4 text-sm text-slate-400">
          Create your first spot category to start training from the dashboard.
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Link
          to="/practice"
          className="flex min-h-[56px] flex-col justify-center rounded-lg border border-slate-700 bg-slate-900/70 p-4 transition hover:bg-slate-800"
          aria-label="Open practice page"
        >
          <div className="font-semibold">Practice</div>
          <div className="text-sm text-slate-400">Train by category and compare range visuals</div>
        </Link>
        <Link
          to="/train"
          className="flex min-h-[56px] flex-col justify-center rounded-lg border border-slate-700 bg-slate-900/70 p-4 transition hover:bg-slate-800"
          aria-label="Open trainer"
        >
          <div className="font-semibold">Quick Train</div>
          <div className="text-sm text-slate-400">Start fast random training session</div>
        </Link>
        <Link
          to="/review"
          className="flex min-h-[56px] flex-col justify-center rounded-lg border border-slate-700 bg-slate-900/70 p-4 transition hover:bg-slate-800"
          aria-label="Open review mode"
        >
          <div className="font-semibold">Review Mode</div>
          <div className="text-sm text-slate-400">Import hand history and review decisions</div>
        </Link>
        <Link
          to="/settings"
          className="flex min-h-[56px] flex-col justify-center rounded-lg border border-slate-700 bg-slate-900/70 p-4 transition hover:bg-slate-800"
          aria-label="Open settings"
        >
          <div className="font-semibold">Settings</div>
          <div className="text-sm text-slate-400">Trainer and visual preferences</div>
        </Link>
      </div>
    </div>
  );
}
