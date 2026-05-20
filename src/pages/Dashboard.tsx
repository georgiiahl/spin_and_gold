import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllSpots } from '@/storage/spots';
import { getAllSessions } from '@/storage/sessions';
import { getAllCards } from '@/storage/cards';
import { SessionAnswer, Spot, TrainerCard, getSpotCategoryLabel } from '@/domain/types';

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
    const groups = new Map<string, { name: string; spotCount: number; dueCards: number }>();

    for (const spot of spots) {
      const name = getSpotCategoryLabel(spot.category);
      groups.set(name, {
        name,
        spotCount: (groups.get(name)?.spotCount ?? 0) + 1,
        dueCards: groups.get(name)?.dueCards ?? 0,
      });
    }

    for (const [spotId, count] of dueCardsBySpot.entries()) {
      const spot = spotById.get(spotId);
      if (!spot) continue;
      const name = getSpotCategoryLabel(spot.category);
      const group = groups.get(name);
      if (!group) continue;
      group.dueCards += count;
    }

    return Array.from(groups.values()).sort(
      (a, b) => b.dueCards - a.dueCards || a.name.localeCompare(b.name)
    );
  }, [dueCardsBySpot, spots]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">Spin & Gold Trainer</h1>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400">Total spots</div>
          <div className="text-lg font-semibold">{spots.length}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400">Trained today</div>
          <div className="text-lg font-semibold">{todaySessions.length}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400">Accuracy today</div>
          <div className="text-lg font-semibold">{accuracyToday}%</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400">Due cards</div>
          <div className="text-lg font-semibold">{dueCardsCount}</div>
        </div>
      </div>

      {categoryCards.length > 0 && (
        <div className="mb-4">
          <div className="mb-2">
            <div className="font-semibold">Choose training category</div>
            <div className="text-sm text-gray-400">
              Train one spot group at a time instead of mixing unrelated stacks and spots.
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {categoryCards.map((category) => (
              <Link
                key={category.name}
                to={`/train?category=${encodeURIComponent(category.name)}`}
                className="block p-4 bg-blue-600 rounded-lg hover:bg-blue-500 transition"
              >
                <div className="font-semibold">{category.name}</div>
                <div className="text-sm text-blue-100">
                  {category.spotCount} spot{category.spotCount === 1 ? '' : 's'} · {category.dueCards} due card
                  {category.dueCards === 1 ? '' : 's'}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {categoryCards.length === 0 && (
        <div className="mb-4 rounded-lg border border-dashed border-gray-700 p-4 text-sm text-gray-400">
          Create your first spot category to start training from the dashboard.
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Link
          to="/spots"
          className="block p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
        >
          <div className="font-semibold">Spots</div>
          <div className="text-sm text-gray-400">Manage your preflop spots</div>
        </Link>
        <Link
          to="/stats"
          className="block p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
        >
          <div className="font-semibold">Stats</div>
          <div className="text-sm text-gray-400">Review training performance</div>
        </Link>
        <Link
          to="/settings"
          className="block p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
        >
          <div className="font-semibold">Settings</div>
          <div className="text-sm text-gray-400">Trainer and visual preferences</div>
        </Link>
        <Link
          to="/import-export"
          className="block p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
        >
          <div className="font-semibold">Import / Export</div>
          <div className="text-sm text-gray-400">Backup and restore your data</div>
        </Link>
      </div>
    </div>
  );
}
