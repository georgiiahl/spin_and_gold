import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Spot, SessionAnswer, TrainerCard } from '@/domain/types';
import { getSpot } from '@/storage/spots';
import { getCardsBySpot } from '@/storage/cards';
import { getSessionsBySpot } from '@/storage/sessions';
import { computeSpotStats, getErrorHeatmap, getHardestHands } from '@/domain/statistics';

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatResponseTime(value: number): string {
  return value > 0 ? `${(value / 1000).toFixed(1)}s` : '—';
}

export default function SpotStats() {
  const { id } = useParams<{ id: string }>();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [sessions, setSessions] = useState<SessionAnswer[]>([]);
  const [cards, setCards] = useState<TrainerCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    Promise.all([getSpot(id), getSessionsBySpot(id), getCardsBySpot(id)]).then(
      ([loadedSpot, loadedSessions, loadedCards]) => {
        setSpot(loadedSpot ?? null);
        setSessions(loadedSessions);
        setCards(loadedCards);
        setLoading(false);
      }
    );
  }, [id]);

  if (loading) return <div className="text-gray-500">Loading...</div>;

  if (!spot) {
    return (
      <div>
        <p className="text-red-600">Spot not found.</p>
        <Link to="/spots" className="text-blue-400 text-sm">Back to spots</Link>
      </div>
    );
  }

  const stats = computeSpotStats(sessions, cards);
  const hardestHands = getHardestHands(sessions);
  const errorHeatmap = [...getErrorHeatmap(sessions).entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Spot Statistics</h1>
        <div className="text-xs text-gray-500">{spot.title}</div>
      </div>

      <div className="grid gap-4">
        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-3">Overview</h2>
          <div className="text-sm text-gray-700 space-y-2">
            <div>Total cards: {cards.length}</div>
            <div>Total answers: {sessions.length}</div>
            <div>Average response time: {formatResponseTime(stats.avgResponseTimeMs)}</div>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-3">Card phases</h2>
          <div className="space-y-2 text-sm">
            {Object.entries(stats.phaseDistribution).map(([phase, count]) => (
              <div key={phase} className="flex items-center justify-between">
                <span className="capitalize text-gray-700">{phase}</span>
                <span>{count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-3">Accuracy by action</h2>
          <div className="space-y-2 text-sm">
            {Object.entries(stats.accuracyByAction).map(([action, actionStats]) => (
              <div key={action} className="flex items-center justify-between gap-3">
                <span className="capitalize text-gray-700">{action}</span>
                <span className="text-gray-500">{actionStats.correct}/{actionStats.attempts}</span>
                <span>{formatPercent(actionStats.accuracy)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-3">Hardest hands</h2>
          {hardestHands.length === 0 ? (
            <div className="text-sm text-gray-500">Need at least 3 attempts on a hand.</div>
          ) : (
            <div className="space-y-2 text-sm">
              {hardestHands.map((hand) => (
                <div key={hand.hand} className="flex items-center justify-between gap-3">
                  <span className="font-medium">{hand.hand}</span>
                  <span className="text-gray-500">{hand.correct}/{hand.attempts}</span>
                  <span>{formatPercent(hand.correctRate)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-3">Error heatmap</h2>
          {errorHeatmap.length === 0 ? (
            <div className="text-sm text-gray-500">No errors recorded yet.</div>
          ) : (
            <div className="space-y-2 text-sm">
              {errorHeatmap.slice(0, 10).map(([hand, errors]) => (
                <div key={hand} className="flex items-center justify-between">
                  <span className="font-medium">{hand}</span>
                  <span>{errors}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Link to="/spots" className="block mt-6 text-sm text-gray-500 hover:text-gray-900">
        ← Back to spots
      </Link>
    </div>
  );
}
