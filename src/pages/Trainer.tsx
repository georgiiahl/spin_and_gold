import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Action,
  HandFrequencies,
  SessionAnswer,
  Spot,
  SpotRange,
  TrainerCard,
  getSpotCategoryLabel,
  normalizeSpotCategory,
} from '@/domain/types';
import { ALL_HANDS } from '@/domain/hands';
import { getSpot, getSpotsByCategory } from '@/storage/spots';
import { getRange } from '@/storage/ranges';
import { saveSession } from '@/storage/sessions';
import { getCardsBySpot, saveCard, saveCards } from '@/storage/cards';
import { createNewCard, determineGrade, scheduleCard } from '@/domain/memory';
import {
  pickNextCard,
  classifyCardPool,
  getNewCardRatio,
  RETRY_DELAY_CARDS,
  REVIEW_SAMPLE_EVERY_N,
} from '@/domain/priority';
import { loadSettings, AppSettings } from '@/storage/settings';
import PokerTable from '@/components/PokerTable';
import { FeedbackKind, triggerFeedback } from '@/domain/feedback';

const ACTION_LABELS: Record<Action, string> = {
  fold: 'Fold',
  call: 'Call',
  raise: 'Raise',
  jam: 'Jam',
};
const ACTION_BUTTON_CLASSES: Record<Action, string> = {
  fold: 'bg-gray-500',
  call: 'bg-green-600',
  raise: 'bg-blue-600',
  jam: 'bg-red-600',
};
const ACTION_TEXT_CLASSES: Record<Action, string> = {
  fold: 'text-gray-600',
  call: 'text-green-600',
  raise: 'text-blue-600',
  jam: 'text-red-600',
};
const ACTION_BAR_COLORS: Record<Action, string> = {
  fold: 'bg-gray-400',
  call: 'bg-green-500',
  raise: 'bg-blue-500',
  jam: 'bg-red-500',
};

const ACTIONS: Action[] = ['fold', 'call', 'raise', 'jam'];
const RECENT_HANDS_LIMIT = 10;
const RECENT_SPOTS_LIMIT = 3;
const MAX_DEPTH_DIFFERENCE_BB = 3;
const HIGHLIGHT_MS = 1200;

type FeedbackState = {
  kind: FeedbackKind;
  isCorrect: boolean;
  isMixedCorrect: boolean;
  selectedAction: Action;
  correctActions: Action[];
  primaryAction: Action;
  frequencies: HandFrequencies;
  confusedWithSpot?: Spot;
} | null;

export default function Trainer() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const category = normalizeSpotCategory(searchParams.get('category') ?? undefined);

  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [spots, setSpots] = useState<Spot[]>([]);
  const [cards, setCards] = useState<TrainerCard[]>([]);
  const [rangesBySpot, setRangesBySpot] = useState<Map<string, SpotRange>>(new Map());
  const [currentCard, setCurrentCard] = useState<TrainerCard | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [barRevealed, setBarRevealed] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [trainingCategoryLabel, setTrainingCategoryLabel] = useState('Category');
  const [highlightStack, setHighlightStack] = useState(false);
  const [highlightPosition, setHighlightPosition] = useState(false);

  // Retry queue: cards that were answered wrong, come back after N cards
  const retryQueueRef = useRef<Array<{ card: TrainerCard; showAfterCount: number }>>([]);
  const cardCountRef = useRef(0);

  const startTimeRef = useRef<number>(0);
  const recentHandsRef = useRef<string[]>([]);
  const lastShownSpotIdsRef = useRef<string[]>([]);
  const prevDepthRef = useRef<number | null>(null);
  const prevPositionRef = useRef<string | null>(null);

  const currentSpot = useMemo(
    () => spots.find((spot) => spot.id === currentCard?.spotId) ?? spots[0] ?? null,
    [currentCard?.spotId, spots]
  );

  const visibleActions = useMemo(() => {
    const actionSet = new Set<Action>();
    for (const range of rangesBySpot.values()) {
      for (const hand of Object.values(range)) {
        for (const action of ACTIONS) {
          if (hand[action] > 0) actionSet.add(action);
        }
      }
    }
    const actions = ACTIONS.filter((a) => actionSet.has(a));
    return actions.length > 0 ? actions : ACTIONS;
  }, [rangesBySpot]);

  // Highlight depth/position changes
  useEffect(() => {
    const depth = currentSpot?.effectiveStackBb;
    const position = currentSpot?.actingPosition;
    if (depth == null) return;

    if (prevDepthRef.current !== null && prevDepthRef.current !== depth) {
      setHighlightStack(true);
      const timer = window.setTimeout(() => setHighlightStack(false), HIGHLIGHT_MS);
      prevDepthRef.current = depth;
      return () => window.clearTimeout(timer);
    }
    prevDepthRef.current = depth;

    if (prevPositionRef.current !== null && prevPositionRef.current !== position) {
      setHighlightPosition(true);
      const timer = window.setTimeout(() => setHighlightPosition(false), HIGHLIGHT_MS);
      prevPositionRef.current = position ?? null;
      return () => window.clearTimeout(timer);
    }
    prevPositionRef.current = position ?? null;
  }, [currentSpot?.effectiveStackBb, currentSpot?.actingPosition]);

  const initTrainer = useCallback(async () => {
    setLoading(true);
    setSettings(loadSettings());
    setCards([]);
    setSpots([]);
    setRangesBySpot(new Map());
    setCurrentCard(null);
    setFeedback(null);
    setBarRevealed(false);
    setSessionCount(0);
    setCorrectCount(0);
    retryQueueRef.current = [];
    cardCountRef.current = 0;
    recentHandsRef.current = [];
    lastShownSpotIdsRef.current = [];

    const selectedSpots = id
      ? [await getSpot(id)].filter((spot): spot is Spot => Boolean(spot))
      : category
        ? await getSpotsByCategory(category)
        : [];

    if (selectedSpots.length === 0) {
      setLoading(false);
      return;
    }

    const categoryLabel = category ?? getSpotCategoryLabel(selectedSpots[0].category);
    setTrainingCategoryLabel(categoryLabel);
    setSpots(selectedSpots);

    const allCards: TrainerCard[] = [];
    const newCards: TrainerCard[] = [];
    const rangeMap = new Map<string, SpotRange>();

    for (const selectedSpot of selectedSpots) {
      const [range, existingCards] = await Promise.all([
        getRange(selectedSpot.id),
        getCardsBySpot(selectedSpot.id),
      ]);

      if (!range) continue;
      rangeMap.set(selectedSpot.id, range);

      const cardMap = new Map(existingCards.map((c) => [c.hand, c]));
      for (const hand of ALL_HANDS) {
        const freq = range[hand];
        if (!freq || (freq.fold + freq.call + freq.raise + freq.jam) === 0) continue;

        const existing = cardMap.get(hand);
        if (existing) {
          existing.frequencies = freq;
          allCards.push(existing);
        } else {
          const card = createNewCard(selectedSpot.id, hand, freq);
          allCards.push(card);
          newCards.push(card);
        }
      }
    }

    if (newCards.length > 0) await saveCards(newCards);

    setRangesBySpot(rangeMap);
    setCards(allCards);

    const trainable = filterTrainableCards(allCards, settings.includeTrashHandsInTraining);
    const first = pickFromPools(trainable, 0);
    if (first) showCard(first);

    setLoading(false);
  }, [category, id, settings.includeTrashHandsInTraining]);

  useEffect(() => {
    initTrainer();
  }, [initTrainer]);

  function showCard(card: TrainerCard) {
    setCurrentCard(card);
    setFeedback(null);
    setBarRevealed(false);
    startTimeRef.current = Date.now();
    recentHandsRef.current = [...recentHandsRef.current, card.hand].slice(-RECENT_HANDS_LIMIT);
    lastShownSpotIdsRef.current = [...lastShownSpotIdsRef.current, card.spotId].slice(-RECENT_SPOTS_LIMIT);
  }

  /**
   * Pick next card from pools with retry queue priority.
   */
  function pickFromPools(allCards: TrainerCard[], count: number): TrainerCard | null {
    // 1. Check retry queue first
    const retryReady = retryQueueRef.current.filter((r) => count >= r.showAfterCount);
    if (retryReady.length > 0) {
      const retry = retryReady[0];
      retryQueueRef.current = retryQueueRef.current.filter((r) => r !== retry);
      // Get fresh version from cards array
      const fresh = allCards.find((c) => c.id === retry.card.id);
      return fresh ?? retry.card;
    }

    // 2. Classify pools
    const problemPool: TrainerCard[] = [];
    const learningPool: TrainerCard[] = [];
    const newPool: TrainerCard[] = [];
    const reviewPool: TrainerCard[] = [];

    for (const card of allCards) {
      const pool = classifyCardPool(card);
      switch (pool) {
        case 'problem': problemPool.push(card); break;
        case 'learning': learningPool.push(card); break;
        case 'new': newPool.push(card); break;
        case 'review': reviewPool.push(card); break;
      }
    }

    // 3. Every Nth card — force review sampling
    if (count > 0 && count % REVIEW_SAMPLE_EVERY_N === 0 && reviewPool.length > 0) {
      return pickNextCard(reviewPool, recentHandsRef.current, lastShownSpotIdsRef.current);
    }

    // 4. Determine which pool to draw from
    const newRatio = getNewCardRatio(problemPool.length, problemPool.length + learningPool.length + newPool.length);
    const roll = Math.random();

    // Problem pool (highest priority)
    if (roll < 0.55 && problemPool.length > 0) {
      return pickNextCard(problemPool, recentHandsRef.current, lastShownSpotIdsRef.current);
    }

    // Learning pool
    if (roll < 0.55 + 0.35 - newRatio && learningPool.length > 0) {
      return pickNextCard(learningPool, recentHandsRef.current, lastShownSpotIdsRef.current);
    }

    // New cards
    if (newPool.length > 0) {
      return pickNextCard(newPool, recentHandsRef.current, lastShownSpotIdsRef.current);
    }

    // Fallback: anything available
    const combined = [...problemPool, ...learningPool, ...reviewPool];
    if (combined.length > 0) {
      return pickNextCard(combined, recentHandsRef.current, lastShownSpotIdsRef.current);
    }

    return null;
  }

  function pickNext() {
    setBarRevealed(false);
    setFeedback(null);
    cardCountRef.current += 1;

    const trainable = filterTrainableCards(cards, settings.includeTrashHandsInTraining);
    const next = pickFromPools(trainable, cardCountRef.current);
    if (next) {
      showCard(next);
    }
  }

  const handleAnswer = useCallback(async (action: Action) => {
    if (!currentCard || !currentSpot) return;

    const freq = currentCard.frequencies;
    const responseTimeMs = Date.now() - startTimeRef.current;

    const primaryAction = getPrimaryAction(freq);
    const maxFreq = freq[primaryAction];
    const trueMix = maxFreq < settings.mixThreshold;
    const tolerant = settings.mixStrategy === 'tolerant';
    const correctActions = ACTIONS.filter((a) => freq[a] > 0);

    const isCorrect = tolerant
      ? freq[action] > 0
      : trueMix
        ? freq[action] > 0
        : action === primaryAction;

    const isMixedCorrect = isCorrect && action !== primaryAction;

    const errorClassification = !isCorrect
      ? classifyError(action, currentSpot, currentCard.hand, spots, rangesBySpot)
      : { type: 'wrong' as const };

    let feedbackKind: FeedbackKind;
    if (isCorrect) {
      if (isMixAcceptable(tolerant, trueMix, action, primaryAction)) {
        feedbackKind = 'mix_acceptable';
      } else if (responseTimeMs > settings.slowResponseMs) {
        feedbackKind = 'slow_correct';
      } else {
        feedbackKind = 'correct';
      }
    } else {
      feedbackKind = errorClassification.type === 'depth_confusion' ? 'depth_confusion' : 'wrong';
    }

    const baseGrade = determineGrade(isCorrect, isMixedCorrect, responseTimeMs, {
      fastMs: settings.fastResponseMs,
      slowMs: settings.slowResponseMs,
    });
    const grade = !isCorrect && errorClassification.type === 'depth_confusion' ? 'hard' : baseGrade;

    const updatedCard = scheduleCard(currentCard, grade);
    updatedCard.stats.shown += 1;
    if (isCorrect) {
      updatedCard.stats.correct += 1;
      updatedCard.stats.streak += 1;
    } else {
      updatedCard.stats.wrong += 1;
      updatedCard.stats.streak = 0;

      // Add to retry queue — will come back after RETRY_DELAY_CARDS
      retryQueueRef.current.push({
        card: updatedCard,
        showAfterCount: cardCountRef.current + RETRY_DELAY_CARDS,
      });
    }
    const n = updatedCard.stats.shown;
    updatedCard.stats.avgResponseMs = Math.round(
      ((updatedCard.stats.avgResponseMs * (n - 1)) + responseTimeMs) / n
    );

    let errorType: SessionAnswer['errorType'];
    if (!isCorrect) {
      if (errorClassification.type === 'depth_confusion') errorType = 'depth_confusion';
      else if (action !== primaryAction && freq[action] > 0) errorType = 'mix_miss';
      else errorType = 'wrong_action';
    }

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
      errorType,
    };

    await saveCard(updatedCard);
    await saveSession(answer);

    setFeedback({
      kind: feedbackKind,
      isCorrect,
      isMixedCorrect,
      selectedAction: action,
      correctActions,
      primaryAction,
      frequencies: freq,
      confusedWithSpot: errorClassification.confusedWithSpot,
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => setBarRevealed(true));
    });

    triggerFeedback(feedbackKind, {
      feedbackSounds: settings.feedbackSounds,
      feedbackVibration: settings.feedbackVibration,
    });

    setSessionCount((c) => c + 1);
    if (isCorrect) setCorrectCount((c) => c + 1);

    setCards((prev) => prev.map((c) => (c.id === updatedCard.id ? updatedCard : c)));
  }, [currentCard, currentSpot, rangesBySpot, settings, spots]);

  // --- Live stats ---
  const accuracy = sessionCount > 0 ? Math.round((correctCount / sessionCount) * 100) : 0;
  const problemCount = cards.filter((c) => classifyCardPool(c) === 'problem').length;
  const learningCount = cards.filter((c) => {
    const p = classifyCardPool(c);
    return p === 'learning' || p === 'new';
  }).length;
  const masteredCount = cards.filter((c) => c.memory.phase === 'mastered' || (c.memory.phase === 'review' && c.memory.intervalDays >= 7)).length;

  // --- RENDER ---

  if (loading) {
    return <div className="flex h-[100dvh] items-center justify-center text-gray-400">Loading...</div>;
  }

  if (!currentSpot) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-2 p-4">
        <p className="text-red-600">{category ? 'Category not found.' : 'Spot not found.'}</p>
        <Link to="/spots" className="text-sm text-blue-600">Back to spots</Link>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-2 p-4">
        <p className="text-yellow-600">No hands in range. Fill the chart first.</p>
        <Link to={`/spots/${currentSpot.id}/range`} className="text-sm text-blue-600">Open Chart Editor</Link>
      </div>
    );
  }

  const userAnswerBarPosition = feedback
    ? getBarPosition(feedback.frequencies, feedback.selectedAction)
    : 0;

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col px-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      {/* Top bar */}
      <div className="flex items-center justify-between py-2">
        <span className="max-w-[60%] truncate text-xs text-gray-400">
          {trainingCategoryLabel}
        </span>
        <span className="text-xs text-gray-400">
          {correctCount}/{sessionCount} · {accuracy}%
        </span>
      </div>

      {/* Main — vertically centered */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <PokerTable
          format={currentSpot.format}
          actingPosition={currentSpot.actingPosition}
          history={currentSpot.history}
          effectiveStackBb={currentSpot.effectiveStackBb}
          hand={currentCard?.hand}
          highlightStack={highlightStack}
          highlightPosition={highlightPosition}
        />

        {/* Frequency bar — always present */}
        <div className="mt-4 w-full">
          <div className="relative h-6 w-full overflow-hidden rounded-full bg-gray-100 ring-1 ring-gray-200">
            {currentCard && (
              <div className="absolute inset-0 flex">
                {ACTIONS.filter((a) => currentCard.frequencies[a] > 0).map((a) => (
                  <div
                    key={a}
                    className={`${ACTION_BAR_COLORS[a]} h-full transition-all duration-700 ease-out`}
                    style={{ width: barRevealed ? `${currentCard.frequencies[a] * 100}%` : '0%' }}
                  />
                ))}
              </div>
            )}
            {feedback && barRevealed && (
              <div
                className="absolute top-0 h-full w-0.5 bg-white shadow transition-all duration-500"
                style={{ left: `${userAnswerBarPosition}%` }}
              >
                <div className={`absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full ring-2 ring-white ${feedback.isCorrect ? 'bg-green-500' : 'bg-red-500'}`} />
                <div className={`absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full ring-2 ring-white ${feedback.isCorrect ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
            )}
          </div>
          <div className={`mt-1 flex justify-between text-[10px] transition-opacity duration-500 ${barRevealed ? 'opacity-100' : 'opacity-0'}`}>
            {currentCard && ACTIONS.filter((a) => currentCard.frequencies[a] > 0).map((a) => (
              <span key={a} className={`${ACTION_TEXT_CLASSES[a]} font-medium`}>
                {ACTION_LABELS[a]} {(currentCard.frequencies[a] * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        </div>

        {/* Action / Feedback area — fixed height */}
        <div className="mt-4 h-[130px] w-full">
          {currentCard && !feedback && (
            <div className="flex h-full flex-col justify-center">
              <div className="flex gap-3" role="group" aria-label="Action buttons">
                {visibleActions.map((action) => (
                  <button
                    key={action}
                    onClick={() => handleAnswer(action)}
                    aria-label={`${ACTION_LABELS[action]} action`}
                    className={`flex-1 rounded-xl ${ACTION_BUTTON_CLASSES[action]} py-4 text-base font-bold text-white active:scale-95`}
                  >
                    {ACTION_LABELS[action]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {feedback && (
            <div role="status" aria-live="polite" className="flex h-full flex-col justify-center space-y-3">
              <div className="flex items-center justify-center gap-2">
                <span className={`text-xl font-bold ${
                  feedback.kind === 'wrong' ? 'text-red-600'
                    : feedback.kind === 'depth_confusion' ? 'text-amber-600'
                    : 'text-green-600'
                }`}>
                  {feedback.isCorrect ? '✓' : feedback.kind === 'depth_confusion' ? '⚠' : '✗'}
                </span>
                {feedback.kind === 'depth_confusion' && feedback.confusedWithSpot && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                    {ACTION_LABELS[feedback.selectedAction]} → {feedback.confusedWithSpot.effectiveStackBb}bb
                  </span>
                )}
              </div>

              <button
                onClick={pickNext}
                className="w-full rounded-xl bg-gray-900 py-3.5 text-base font-bold text-white active:scale-95"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar — live progress */}
      <div className="flex items-center justify-between py-2">
        <Link to={category ? '/' : '/spots'} className="text-xs text-gray-400">← End</Link>
        <div className="flex gap-2 text-[10px]">
          <span className="text-red-500">🔴 {problemCount}</span>
          <span className="text-amber-500">🟡 {learningCount}</span>
          <span className="text-green-500">🟢 {masteredCount}</span>
        </div>
      </div>
    </div>
  );
}

// --- Helpers ---

function getBarPosition(freq: HandFrequencies, action: Action): number {
  let position = 0;
  for (const a of ACTIONS) {
    if (freq[a] <= 0) continue;
    if (a === action) return position + (freq[a] * 100) / 2;
    position += freq[a] * 100;
  }
  return position;
}

function filterTrainableCards(cards: TrainerCard[], includeTrash: boolean): TrainerCard[] {
  if (includeTrash) return cards;
  return cards.filter((c) => !(c.frequencies.fold === 1 && c.frequencies.call === 0 && c.frequencies.raise === 0 && c.frequencies.jam === 0));
}

function getPrimaryAction(freq: HandFrequencies): Action {
  return ACTIONS.reduce((best, a) => (freq[a] > freq[best] ? a : best), 'fold' as Action);
}

function isMixAcceptable(tolerant: boolean, trueMix: boolean, selectedAction: Action, primaryAction: Action): boolean {
  return tolerant && trueMix && selectedAction !== primaryAction;
}

function classifyError(
  selectedAction: Action,
  currentSpot: Spot,
  hand: string,
  categorySpots: Spot[],
  allRanges: Map<string, SpotRange>
): { type: 'wrong' | 'depth_confusion'; confusedWithSpot?: Spot } {
  const siblings = categorySpots
    .filter((s) => s.id !== currentSpot.id && s.effectiveStackBb !== currentSpot.effectiveStackBb)
    .sort((a, b) =>
      Math.abs(a.effectiveStackBb - currentSpot.effectiveStackBb)
      - Math.abs(b.effectiveStackBb - currentSpot.effectiveStackBb)
    );

  for (const sibling of siblings) {
    const range = allRanges.get(sibling.id);
    if (!range) continue;
    const freq = range[hand];
    if (!freq) continue;

    const siblingPrimary = getPrimaryAction(freq);
    const diff = Math.abs(sibling.effectiveStackBb - currentSpot.effectiveStackBb);
    if (siblingPrimary === selectedAction && diff <= MAX_DEPTH_DIFFERENCE_BB) {
      return { type: 'depth_confusion', confusedWithSpot: sibling };
    }
  }

  return { type: 'wrong' };
}