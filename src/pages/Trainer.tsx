import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Action, HandFrequencies, Spot, SessionAnswer, TrainerCard } from '@/domain/types';
import { ALL_HANDS } from '@/domain/hands';
import { getSpot } from '@/storage/spots';
import { getRange } from '@/storage/ranges';
import { saveSession } from '@/storage/sessions';
import { getCardsBySpot, saveCard, saveCards } from '@/storage/cards';
import { createNewCard, scheduleCard, determineGrade } from '@/domain/memory';
import { pickNextCard } from '@/domain/priority';
import { loadSettings } from '@/storage/settings';

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
  const { id } = useParams<{ id: string }>();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [cards, setCards] = useState<TrainerCard[]>([]);
  const [currentCard, setCurrentCard] = useState<TrainerCard | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const startTimeRef = useRef<number>(0);
  const settings = loadSettings();

  useEffect(() => {
    if (!id) return;
    initTrainer();
  }, [id]);

  async function initTrainer() {
    if (!id) return;
    const [s, range, existingCards] = await Promise.all([
      getSpot(id),
      getRange(id),
      getCardsBySpot(id),
    ]);

    if (!s || !range) {
      setLoading(false);
      return;
    }
    setSpot(s);

    // Sync cards with range: create missing, update frequencies
    const cardMap = new Map(existingCards.map((c) => [c.hand, c]));
    const allCards: TrainerCard[] = [];
    const newCards: TrainerCard[] = [];

    for (const hand of ALL_HANDS) {
      const freq = range[hand];
      if (!freq || (freq.fold + freq.call + freq.raise + freq.jam) === 0) continue;

      const existing = cardMap.get(hand);
      if (existing) {
        // Update frequencies if changed
        existing.frequencies = freq;
        allCards.push(existing);
      } else {
        const card = createNewCard(id, hand, freq);
        allCards.push(card);
        newCards.push(card);
      }
    }

    if (newCards.length > 0) {
      await saveCards(newCards);
    }

    setCards(allCards);
    setLoading(false);

    // Pick first card
    const trainableCards = allCards.filter((card) => {
      if (!settings.includeTrashHandsInTraining) {
        return !(card.frequencies.fold === 1 && card.frequencies.call === 0 && card.frequencies.raise === 0 && card.frequencies.jam === 0);
      }
      return true;
    });
    const mixedCards = trainableCards.filter((card) => Object.values(card.frequencies).filter((v) => v > 0).length > 1);
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
        const onlyFold =
          card.frequencies.fold === 1 &&
          card.frequencies.call === 0 &&
          card.frequencies.raise === 0 &&
          card.frequencies.jam === 0;
        if (onlyFold) return false;
      }
      return true;
    });
    const mixedOnly = pool.filter((card) => Object.values(card.frequencies).filter((v) => v > 0).length > 1);
    const candidates = settings.focusOnMixedHands && mixedOnly.length > 0 ? mixedOnly : pool;
    const next = pickNextCard(candidates.length > 0 ? candidates : cards);
    if (next) {
      setCurrentCard(next);
      startTimeRef.current = Date.now();
    }
    setFeedback(null);
  }

  const handleAnswer = useCallback(async (action: Action) => {
    if (!currentCard || !id) return;
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
      spotId: id,
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
  }, [currentCard, id]);

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
        <p className="text-yellow-500">No hands in range. Fill the chart first.</p>
        <Link to={`/spots/${id}/range`} className="text-blue-400 text-sm mt-2 block">
          Open Chart Editor
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col min-h-screen">
      {/* Spot info */}
      <div className="mb-4">
        <div className="text-xs text-gray-400">
          {spot.format} · {spot.effectiveStackBb}bb · {spot.actingPosition}
          {spot.history.length > 0 &&
            ' · ' + spot.history.map((h) => `${h.position} ${h.action}`).join(' → ')}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Session: {correctCount}/{sessionCount}
          {sessionCount > 0 && ` (${Math.round((correctCount / sessionCount) * 100)}%)`}
        </div>
      </div>

      {/* Hand display */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {currentCard && !feedback && (
          <div className="text-center">
            <div className="text-5xl font-bold mb-8">{currentCard.hand}</div>
            <div className="text-sm text-gray-400 mb-6">What's your action?</div>

            <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
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
            <div className="text-4xl font-bold mb-2">{currentCard?.hand}</div>

            <div
              className={`text-xl font-bold mb-4 ${
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

      <Link to="/spots" className="block mt-4 text-sm text-gray-400 hover:text-white text-center">
        ← End session
      </Link>
    </div>
  );
}
