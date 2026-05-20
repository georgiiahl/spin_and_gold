import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Action, HandFrequencies, Spot, SessionAnswer, TrainerCard } from '@/domain/types';
import { ALL_HANDS } from '@/domain/hands';
import { decodeSpotCategory, getSpotCategoryLabel } from '@/domain/spotCategories';
import { getSpot, getSpotsByCategory } from '@/storage/spots';
import { getRange } from '@/storage/ranges';
import { saveSession } from '@/storage/sessions';
import { getCardsBySpot, saveCard, saveCards } from '@/storage/cards';
import { createNewCard, scheduleCard, determineGrade } from '@/domain/memory';
import { pickNextCard } from '@/domain/priority';
import { loadSettings } from '@/storage/settings';
import PokerTable from '@/components/PokerTable';

const ACTION_LABELS: Record<Action, string> = {
  fold: 'Fold',
  call: 'Call',
  raise: 'Raise',
  jam: 'Jam',
};

const ACTIONS: Action[] = ['fold', 'call', 'raise', 'jam'];

type FeedbackState = {
  isCorrect: boolean;
  isMixedCorrect: boolean;
  selectedAction: Action;
  correctActions: Action[];
  primaryAction: Action;
  frequencies: HandFrequencies;
} | null;

export default function Trainer() {
  const { id, category: categoryParam } = useParams<{ id?: string; category?: string }>();
  const categoryFilter = useMemo(() => decodeSpotCategory(categoryParam), [categoryParam]);
  const [spotsById, setSpotsById] = useState<Record<string, Spot>>({});
  const [fallbackSpot, setFallbackSpot] = useState<Spot | null>(null);
  const [cards, setCards] = useState<TrainerCard[]>([]);
  const [currentCard, setCurrentCard] = useState<TrainerCard | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const startTimeRef = useRef<number>(0);
  const settings = useMemo(() => loadSettings(), []);

  useEffect(() => {
    if (!id && !categoryFilter) return;
    initTrainer();
  }, [id, categoryFilter]);

  async function initTrainer() {
    if (!id && !categoryFilter) return;

    setLoading(true);
    setFeedback(null);
    setCurrentCard(null);
    setCards([]);
    setSessionCount(0);
    setCorrectCount(0);
    setSpotsById({});
    setFallbackSpot(null);

    const selectedSpots = id
      ? [await getSpot(id)].filter((spot): spot is Spot => Boolean(spot))
      : categoryFilter
        ? await getSpotsByCategory(categoryFilter)
        : [];

    if (selectedSpots.length === 0) {
      setLoading(false);
      return;
    }

    const nextSpotsById = Object.fromEntries(selectedSpots.map((spot) => [spot.id, spot]));
    setSpotsById(nextSpotsById);
    setFallbackSpot(selectedSpots[0]);

    const allCards: TrainerCard[] = [];
    const newCards: TrainerCard[] = [];

    for (const spot of selectedSpots) {
      const [range, existingCards] = await Promise.all([
        getRange(spot.id),
        getCardsBySpot(spot.id),
      ]);

      if (!range) continue;

      const cardMap = new Map(existingCards.map((card) => [card.hand, card]));

      for (const hand of ALL_HANDS) {
        const freq = range[hand];
        if (!freq || (freq.fold + freq.call + freq.raise + freq.jam) === 0) continue;

        const existing = cardMap.get(hand);
        if (existing) {
          existing.frequencies = freq;
          allCards.push(existing);
        } else {
          const card = createNewCard(spot.id, hand, freq);
          allCards.push(card);
          newCards.push(card);
        }
      }
    }

    if (newCards.length > 0) {
      await saveCards(newCards);
    }

    setCards(allCards);
    setLoading(false);

    const trainableCards = allCards.filter((card) => {
      if (!settings.includeTrashHandsInTraining) {
        return !isTrashHand(card);
      }
      return true;
    });
    const mixedCards = trainableCards.filter((card) => countNonZeroActions(card) > 1);
    const initialPool = settings.focusOnMixedHands && mixedCards.length > 0 ? mixedCards : trainableCards;
    const next = pickNextCard(initialPool.length > 0 ? initialPool : allCards);
    if (next) {
      setCurrentCard(next);
      startTimeRef.current = Date.now();
    }
  }

  function pickNext() {
    const pool = cards.filter((card) => {
      if (!settings.includeTrashHandsInTraining) {
        if (isTrashHand(card)) return false;
      }
      return true;
    });
    const mixedOnly = pool.filter((card) => countNonZeroActions(card) > 1);
    const candidates = settings.focusOnMixedHands && mixedOnly.length > 0 ? mixedOnly : pool;
    const next = pickNextCard(candidates.length > 0 ? candidates : cards);
    if (next) {
      setCurrentCard(next);
      startTimeRef.current = Date.now();
    }
    setFeedback(null);
  }

  const handleAnswer = useCallback(async (action: Action) => {
    if (!currentCard) return;
    const freq = currentCard.frequencies;
    const responseTimeMs = Date.now() - startTimeRef.current;

    // Evaluate
    const correctActions = ACTIONS.filter((a) => freq[a] > 0);
    const primaryAction = ACTIONS.reduce((best, a) => (freq[a] > freq[best] ? a : best), 'fold' as Action);
    const isCorrect = freq[action] > 0;
    const isMixedCorrect = isCorrect && action !== primaryAction;

    setFeedback({
      isCorrect,
      isMixedCorrect,
      selectedAction: action,
      correctActions,
      primaryAction,
      frequencies: freq,
    });

    setSessionCount((c) => c + 1);
    if (isCorrect) setCorrectCount((c) => c + 1);

    // Grade and schedule
    const grade = determineGrade(isCorrect, isMixedCorrect, responseTimeMs, {
      fastMs: settings.fastResponseMs,
      slowMs: settings.slowResponseMs,
    });
    const updatedCard = scheduleCard(currentCard, grade);

    // Update stats
    updatedCard.stats.shown += 1;
    if (isCorrect) {
      updatedCard.stats.correct += 1;
      updatedCard.stats.streak += 1;
    } else {
      updatedCard.stats.wrong += 1;
      updatedCard.stats.streak = 0;
    }
    // Running average response time
    const n = updatedCard.stats.shown;
    updatedCard.stats.avgResponseMs = Math.round(
      ((updatedCard.stats.avgResponseMs * (n - 1)) + responseTimeMs) / n
    );

    await saveCard(updatedCard);

    // Update in local state
    setCards((prev) => prev.map((c) => (c.id === updatedCard.id ? updatedCard : c)));

    // Save session
    const answer: SessionAnswer = {
      spotId: currentCard.spotId,
      hand: currentCard.hand,
      selectedAction: action,
      correctActions,
      primaryAction,
      isCorrect,
      isMixedCorrect,
      responseTimeMs,
      grade,
      timestamp: Date.now(),
    };
    await saveSession(answer);
  }, [currentCard, settings.fastResponseMs, settings.slowResponseMs]);

  const spot = currentCard ? spotsById[currentCard.spotId] ?? fallbackSpot : fallbackSpot;

  if (loading) {
    return <div className="p-4 text-gray-400">Loading...</div>;
  }

  if (!spot) {
    return (
      <div className="p-4">
        <p className="text-red-400">Spot not found.</p>
        <Link to="/spots" className="text-blue-400 text-sm">Back to spots</Link>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="p-4">
          <p className="text-yellow-500">
          {categoryFilter ? 'No hands in this category. Fill the charts first.' : 'No hands in range. Fill the chart first.'}
        </p>
        {id ? (
          <Link to={`/spots/${id}/range`} className="text-blue-400 text-sm mt-2 block">
            Open Chart Editor
          </Link>
        ) : (
          <Link to="/spots" className="text-blue-400 text-sm mt-2 block">
            Back to spots
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col min-h-screen">
      {/* Session stats */}
      <div className="mb-2 flex justify-between items-center">
        <span className="text-xs text-gray-500 text-left">
          {categoryFilter ? `${categoryFilter} · ` : ''}
          {spot.title}
        </span>
        <span className="text-xs text-gray-500">
          {correctCount}/{sessionCount}
          {sessionCount > 0 && ` (${Math.round((correctCount / sessionCount) * 100)}%)`}
        </span>
      </div>

      {/* Visual poker table */}
      <PokerTable
        format={spot.format}
        actingPosition={spot.actingPosition}
        history={spot.history}
        effectiveStackBb={spot.effectiveStackBb}
        hand={currentCard?.hand}
      />

      <div className="mt-3 text-center text-xs text-gray-400">
        {spot.format} · {getSpotCategoryLabel(spot.category)} · {spot.effectiveStackBb}bb · {spot.actingPosition}
      </div>

      {/* Action area */}
      <div className="flex-1 flex flex-col items-center justify-center mt-4">
        {currentCard && !feedback && (
          <div className="w-full max-w-xs">
            <div className="text-sm text-gray-400 text-center mb-4">What's your action?</div>
            <div className="grid grid-cols-2 gap-3">
              {ACTIONS.map((a) => (
                <button
                  key={a}
                  onClick={() => handleAnswer(a)}
                  className={`py-4 rounded-xl font-bold text-lg bg-${a} active:scale-95 transition-transform`}
                >
                  {ACTION_LABELS[a]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className="text-center w-full max-w-xs">
            <div
              className={`text-xl font-bold mb-3 ${
                feedback.isCorrect
                  ? feedback.isMixedCorrect
                    ? 'text-yellow-400'
                    : 'text-green-400'
                  : 'text-red-400'
              }`}
            >
              {feedback.isCorrect
                ? feedback.isMixedCorrect
                  ? '✓ Correct (mix)'
                  : '✓ Correct'
                : '✗ Wrong'}
            </div>

            <div className="bg-gray-800 rounded-lg p-3 text-left text-sm mb-4">
              <div className="mb-2">
                <span className="text-gray-400">You chose: </span>
                <span className={`font-medium text-${feedback.selectedAction}`}>
                  {ACTION_LABELS[feedback.selectedAction]}
                </span>
              </div>
              <div className="mb-2">
                <span className="text-gray-400">Primary: </span>
                <span className="font-medium">{ACTION_LABELS[feedback.primaryAction]}</span>
              </div>
              {settings.showFrequenciesInFeedback && (
                <div>
                  <span className="text-gray-400">Frequencies: </span>
                  <div className="mt-1">
                    {ACTIONS.filter((a) => feedback.frequencies[a] > 0).map((a) => (
                      <span key={a} className={`inline-block mr-2 text-${a}`}>
                        {ACTION_LABELS[a]} {(feedback.frequencies[a] * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={pickNext}
              className="w-full py-4 bg-blue-600 rounded-xl font-bold text-lg hover:bg-blue-500 active:scale-95 transition-transform"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      <Link to="/" className="block mt-4 text-sm text-gray-400 hover:text-white text-center">
        ← End session
      </Link>
    </div>
  );
}

function isTrashHand(card: TrainerCard): boolean {
  return (
    card.frequencies.fold === 1 &&
    card.frequencies.call === 0 &&
    card.frequencies.raise === 0 &&
    card.frequencies.jam === 0
  );
}

function countNonZeroActions(card: TrainerCard): number {
  return Object.values(card.frequencies).reduce((count, value) => count + (value > 0 ? 1 : 0), 0);
}
