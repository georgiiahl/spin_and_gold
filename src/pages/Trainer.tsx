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
import { getAllSpots, getSpot, getSpotsByCategory } from '@/storage/spots';
import { getRange } from '@/storage/ranges';
import { getSessionsBySpot, saveSession } from '@/storage/sessions';
import { getCardsBySpot, saveCard, saveCards } from '@/storage/cards';
import { createNewCard, determineGrade, migrateCardMemory, scheduleCard } from '@/domain/memory';
import {
  pickNextCard,
  classifyCardPool,
  getNewCardRatio,
  getRetryDelaySeconds,
  isSpotOnCooldown,
  REVIEW_SAMPLE_EVERY_N,
} from '@/domain/priority';
import { filterTrainableCards } from '@/domain/trainable';
import { findParentSpot, getAllowedHands, isSecondAction } from '@/domain/parentSpot';
import { BalancedAnswer, scoreBalancedAnswer } from '@/domain/scoring';
import { loadSettings, AppSettings } from '@/storage/settings';
import PokerTable from '@/components/PokerTable';
import { FeedbackKind, triggerFeedback } from '@/domain/feedback';
import { estimateInitialDifficulty, recalibrateCardDifficulty } from '@/domain/difficulty';

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
const ACTION_KEYS: Record<string, Action> = {
  f: 'fold',
  '1': 'fold',
  c: 'call',
  '2': 'call',
  r: 'raise',
  '3': 'raise',
  j: 'jam',
  '4': 'jam',
};
const ACTION_SHORTCUT_LABELS: Record<Action, string> = {
  fold: 'F · 1',
  call: 'C · 2',
  raise: 'R · 3',
  jam: 'J · 4',
};
const MIX_SHORTCUT_LABEL = 'M · 5';
const MIX_KEYS = new Set(['m', '5']);
const RECENT_HANDS_LIMIT = 10;
const RECENT_SPOTS_LIMIT = 6;
const MAX_DEPTH_DIFFERENCE_BB = 3;
const HIGHLIGHT_MS = 1200;
const RETRY_SAME_SPOT_DEFER_MS = 60_000;
const MIX_ALLOCATION_STEP = 25;
const MIX_TOTAL_TARGET = 100;
const MIX_TOTAL_EPSILON = 0.01;

type FeedbackState = {
  kind: FeedbackKind;
  isCorrect: boolean;
  isMixedCorrect: boolean;
  selectedAction: Action;
  correctActions: Action[];
  primaryAction: Action;
  frequencies: HandFrequencies;
  balancedAnswer?: BalancedAnswer;
  balancedScore?: number;
  confusedWithSpot?: Spot;
} | null;

function memoryNeedsPersist(previous: TrainerCard, next: TrainerCard): boolean {
  return previous.memory.difficulty !== next.memory.difficulty
    || previous.memory.stability !== next.memory.stability
    || previous.memory.reps !== next.memory.reps
    || previous.memory.state !== next.memory.state
    || previous.memory.last_review !== next.memory.last_review
    || previous.memory.structuralDifficulty !== next.memory.structuralDifficulty;
}

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
  const [showMixAllocation, setShowMixAllocation] = useState(false);
  const [mixAllocations, setMixAllocations] = useState<Partial<Record<Action, number>>>({});

  // Retry queue: cards that were answered wrong, come back after a time delay
  const retryQueueRef = useRef<Array<{ card: TrainerCard; retryAfterTimestamp: number }>>([]);
  const retryAttemptsRef = useRef<Map<string, number>>(new Map());
  const sessionHistoryRef = useRef<SessionAnswer[]>([]);
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
    setShowMixAllocation(false);
    setMixAllocations({});
    retryQueueRef.current = [];
    retryAttemptsRef.current = new Map();
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

    const sessionsBySpot = await Promise.all(
      selectedSpots.map((spot) => getSessionsBySpot(spot.id))
    );
    sessionHistoryRef.current = sessionsBySpot.flat();
    const secondActionSpots = selectedSpots.filter((spot) => isSecondAction(spot));
    const allSpots = secondActionSpots.length > 0 ? await getAllSpots() : [];

    const categoryLabel = category ?? getSpotCategoryLabel(selectedSpots[0].category);
    setTrainingCategoryLabel(categoryLabel);
    setSpots(selectedSpots);

    const allCards: TrainerCard[] = [];
    const cardsToPersist: TrainerCard[] = [];
    const rangeMap = new Map<string, SpotRange>();
    const existingCardsBySpot = new Map<string, TrainerCard[]>();
    const parentAllowedHandsBySpot = new Map<string, Set<string>>();

    for (const selectedSpot of selectedSpots) {
      const [range, existingCards] = await Promise.all([
        getRange(selectedSpot.id),
        getCardsBySpot(selectedSpot.id),
      ]);

      if (!range) continue;
      rangeMap.set(selectedSpot.id, range);
      existingCardsBySpot.set(selectedSpot.id, existingCards);
    }

    const parentSpotBySelectedSpot = new Map<string, Spot>();
    for (const selectedSpot of secondActionSpots) {
      const parentSpot = findParentSpot(selectedSpot, allSpots);
      if (parentSpot) parentSpotBySelectedSpot.set(selectedSpot.id, parentSpot);
    }

    const parentSpots = Array.from(parentSpotBySelectedSpot.values());
    const uniqueParentSpotIds = Array.from(new Set(parentSpots.map((spot) => spot.id)));
    const parentRangeEntries = await Promise.all(
      uniqueParentSpotIds.map(async (spotId) => [spotId, (await getRange(spotId)) ?? null] as const)
    );
    const parentRangeCache = new Map<string, SpotRange | null>(parentRangeEntries);

    for (const [selectedSpotId, parentSpot] of parentSpotBySelectedSpot.entries()) {
      const parentRange = parentRangeCache.get(parentSpot.id);
      if (!parentRange) continue;
      parentAllowedHandsBySpot.set(selectedSpotId, new Set(getAllowedHands(parentRange)));
    }

    for (const selectedSpot of selectedSpots) {
      const range = rangeMap.get(selectedSpot.id);
      if (!range) continue;
      const allowedHands = parentAllowedHandsBySpot.get(selectedSpot.id);

      const siblings = selectedSpots.filter(
        (s) => s.id !== selectedSpot.id && normalizeSpotCategory(s.category) === normalizeSpotCategory(selectedSpot.category)
      );
      const cardMap = new Map((existingCardsBySpot.get(selectedSpot.id) ?? []).map((c) => [c.hand, c]));

      for (const hand of ALL_HANDS) {
        if (allowedHands && !allowedHands.has(hand)) continue;
        const freq = range[hand];
        if (!freq || (freq.fold + freq.call + freq.raise + freq.jam) === 0) continue;

        const structuralDifficulty = estimateInitialDifficulty(hand, freq, selectedSpot, siblings, rangeMap);
        const existing = cardMap.get(hand);
        if (existing) {
          existing.frequencies = freq;
          const migrated = migrateCardMemory(existing);
          migrated.memory.structuralDifficulty = structuralDifficulty;
          migrated.memory.difficulty = recalibrateCardDifficulty(
            migrated,
            sessionHistoryRef.current,
            structuralDifficulty
          );
          allCards.push(migrated);
          if (memoryNeedsPersist(existing, migrated)) {
            cardsToPersist.push(migrated);
          }
        } else {
          const difficulty = recalibrateCardDifficulty(
            createNewCard(selectedSpot.id, hand, freq, structuralDifficulty),
            sessionHistoryRef.current,
            structuralDifficulty
          );
          const card = createNewCard(selectedSpot.id, hand, freq, difficulty);
          allCards.push(card);
          cardsToPersist.push(card);
        }
      }
    }

    if (cardsToPersist.length > 0) await saveCards(cardsToPersist);

    setRangesBySpot(rangeMap);
    setCards(allCards);

    const trainable = filterTrainableCards(
      allCards,
      {
        includeTrashHandsInTraining: settings.includeTrashHandsInTraining,
        focusOnMixedHands: settings.focusOnMixedHands,
      }
    );
    const first = pickFromPools(trainable, 0);
    if (first) showCard(first);

    setLoading(false);
  }, [category, id, settings.focusOnMixedHands, settings.includeTrashHandsInTraining]);

  useEffect(() => {
    initTrainer();
  }, [initTrainer]);

  function showCard(card: TrainerCard) {
    setCurrentCard(card);
    setFeedback(null);
    setBarRevealed(false);
    setShowMixAllocation(false);
    setMixAllocations({});
    startTimeRef.current = Date.now();
    recentHandsRef.current = [...recentHandsRef.current, card.hand].slice(-RECENT_HANDS_LIMIT);
    lastShownSpotIdsRef.current = [...lastShownSpotIdsRef.current, card.spotId].slice(-RECENT_SPOTS_LIMIT);
  }

  function pickRespectingCooldown(pool: TrainerCard[]): TrainerCard | null {
    if (pool.length === 0) return null;
    const candidates = [...pool];

    while (candidates.length > 0) {
      const picked = pickNextCard(
        candidates,
        recentHandsRef.current,
        lastShownSpotIdsRef.current,
        settings.focusOnMixedHands,
        rangesBySpot
      );
      if (!picked) return null;

      if (!isSpotOnCooldown(picked.spotId, lastShownSpotIdsRef.current, settings.sameSpotCooldown)) {
        return picked;
      }

      const pickedIndex = candidates.findIndex((c) => c.id === picked.id);
      if (pickedIndex < 0) return null;
      candidates.splice(pickedIndex, 1);
    }

    return null;
  }

  /**
   * Pick next card from pools with retry queue priority.
   */
  function pickFromPools(allCards: TrainerCard[], count: number): TrainerCard | null {
    // 1. Check retry queue first (time-based)
    const now = Date.now();
    const readyRetries = retryQueueRef.current
      .filter((r) => now >= r.retryAfterTimestamp)
      .sort((a, b) => a.retryAfterTimestamp - b.retryAfterTimestamp);

    if (readyRetries.length > 0) {
      const seenSpots = new Set<string>();
      for (const retry of readyRetries) {
        if (seenSpots.has(retry.card.spotId)) {
          retry.retryAfterTimestamp = now + RETRY_SAME_SPOT_DEFER_MS;
          continue;
        }
        seenSpots.add(retry.card.spotId);
      }

      const retry = readyRetries.find((r) => !isSpotOnCooldown(r.card.spotId, lastShownSpotIdsRef.current, settings.sameSpotCooldown));
      if (retry) {
        retryQueueRef.current = retryQueueRef.current.filter((r) => r !== retry);
        const fresh = allCards.find((c) => c.id === retry.card.id);
        return fresh ?? retry.card;
      }
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
      return pickRespectingCooldown(reviewPool);
    }

    // 4. Determine which pool to draw from
    const newRatio = getNewCardRatio(problemPool.length, problemPool.length + learningPool.length + newPool.length);
    const roll = Math.random();

    // Problem pool (highest priority)
    if (roll < 0.55 && problemPool.length > 0) {
      const picked = pickRespectingCooldown(problemPool);
      if (picked) return picked;
    }

    // Learning pool
    if (roll < 0.55 + 0.35 - newRatio && learningPool.length > 0) {
      const picked = pickRespectingCooldown(learningPool);
      if (picked) return picked;
    }

    // New cards
    if (newPool.length > 0) {
      const picked = pickRespectingCooldown(newPool);
      if (picked) return picked;
    }

    // Fallback: anything available
    const combined = [...problemPool, ...learningPool, ...reviewPool];
    if (combined.length > 0) {
      return pickRespectingCooldown(combined);
    }

    return null;
  }

  function pickNext() {
    setBarRevealed(false);
    setFeedback(null);
    cardCountRef.current += 1;

    const trainable = filterTrainableCards(
      cards,
      {
        includeTrashHandsInTraining: settings.includeTrashHandsInTraining,
        focusOnMixedHands: settings.focusOnMixedHands,
      }
    );
    const next = pickFromPools(trainable, cardCountRef.current);
    if (next) {
      showCard(next);
    }
  }

  function startMixAllocation() {
    if (!currentCard) return;
    const nextAllocations: Partial<Record<Action, number>> = {};
    for (const action of ACTIONS) {
      if (currentCard.frequencies[action] > 0) {
        nextAllocations[action] = currentCard.frequencies[action] * 100;
      }
    }
    setMixAllocations(nextAllocations);
    setShowMixAllocation(true);
  }

  function adjustMixAllocation(action: Action, direction: -1 | 1) {
    setMixAllocations((prev) => {
      const current = prev[action] ?? 0;
      const next = Math.max(0, Math.min(100, current + direction * MIX_ALLOCATION_STEP));
      return { ...prev, [action]: next };
    });
  }

  const commitAnswer = useCallback(async (params: {
    grade: SessionAnswer['grade'];
    isCorrect: boolean;
    isMixedCorrect: boolean;
    responseTimeMs: number;
    correctActions: Action[];
    primaryAction: Action;
    sessionSelectedAction: Action;
    feedbackSelectedAction?: Action;
    feedbackKind: FeedbackKind;
    errorType?: SessionAnswer['errorType'];
    confusedWithSpot?: Spot;
    balancedAnswer?: BalancedAnswer;
    balancedScore?: number;
  }) => {
    if (!currentCard) return;

    const updatedCard = scheduleCard(currentCard, params.grade, { desiredRetention: settings.desiredRetention });
    updatedCard.stats.shown += 1;
    if (params.isCorrect) {
      updatedCard.stats.correct += 1;
      updatedCard.stats.streak += 1;
      retryAttemptsRef.current.delete(updatedCard.id);
      retryQueueRef.current = retryQueueRef.current.filter((r) => r.card.id !== updatedCard.id);
    } else {
      updatedCard.stats.wrong += 1;
      updatedCard.stats.streak = 0;

      const attempt = (retryAttemptsRef.current.get(updatedCard.id) ?? 0) + 1;
      retryAttemptsRef.current.set(updatedCard.id, attempt);
      const delaySec = getRetryDelaySeconds(attempt, settings.retryMinDelaySec);

      retryQueueRef.current = retryQueueRef.current.filter((r) => r.card.id !== updatedCard.id);
      retryQueueRef.current.push({
        card: updatedCard,
        retryAfterTimestamp: Date.now() + delaySec * 1000,
      });
    }

    const n = updatedCard.stats.shown;
    updatedCard.stats.avgResponseMs = Math.round(
      ((updatedCard.stats.avgResponseMs * (n - 1)) + params.responseTimeMs) / n
    );

    const answer: SessionAnswer = {
      spotId: currentCard.spotId,
      hand: currentCard.hand,
      selectedAction: params.sessionSelectedAction,
      correctActions: params.correctActions,
      primaryAction: params.primaryAction,
      isCorrect: params.isCorrect,
      isMixedCorrect: params.isMixedCorrect,
      responseTimeMs: params.responseTimeMs,
      grade: params.grade,
      balancedAnswer: params.balancedAnswer,
      balancedScore: params.balancedScore,
      timestamp: Date.now(),
      errorType: params.errorType,
    };

    const structuralDifficulty = updatedCard.memory.structuralDifficulty ?? updatedCard.memory.difficulty;
    updatedCard.memory.difficulty = recalibrateCardDifficulty(
      updatedCard,
      [...sessionHistoryRef.current, answer],
      structuralDifficulty
    );
    sessionHistoryRef.current = [...sessionHistoryRef.current, answer];

    await saveCard(updatedCard);
    await saveSession(answer);

    setShowMixAllocation(false);
    setFeedback({
      kind: params.feedbackKind,
      isCorrect: params.isCorrect,
      isMixedCorrect: params.isMixedCorrect,
      selectedAction: params.feedbackSelectedAction ?? params.sessionSelectedAction,
      correctActions: params.correctActions,
      primaryAction: params.primaryAction,
      frequencies: currentCard.frequencies,
      confusedWithSpot: params.confusedWithSpot,
      balancedAnswer: params.balancedAnswer,
      balancedScore: params.balancedScore,
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => setBarRevealed(true));
    });

    triggerFeedback(params.feedbackKind, {
      feedbackSounds: settings.feedbackSounds,
      feedbackVibration: settings.feedbackVibration,
    });

    setSessionCount((c) => c + 1);
    if (params.isCorrect) setCorrectCount((c) => c + 1);

    setCards((prev) => prev.map((c) => (c.id === updatedCard.id ? updatedCard : c)));
  }, [currentCard, settings.desiredRetention, settings.feedbackSounds, settings.feedbackVibration, settings.retryMinDelaySec]);

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

    let errorType: SessionAnswer['errorType'];
    if (!isCorrect) {
      if (errorClassification.type === 'depth_confusion') errorType = 'depth_confusion';
      else if (action !== primaryAction && freq[action] > 0) errorType = 'mix_miss';
      else errorType = 'wrong_action';
    }

    await commitAnswer({
      grade,
      isCorrect,
      isMixedCorrect,
      responseTimeMs,
      correctActions,
      primaryAction,
      sessionSelectedAction: action,
      feedbackSelectedAction: action,
      feedbackKind,
      errorType,
      confusedWithSpot: errorClassification.confusedWithSpot,
    });
  }, [commitAnswer, currentCard, currentSpot, rangesBySpot, settings.fastResponseMs, settings.mixStrategy, settings.mixThreshold, settings.slowResponseMs, spots]);

  const handleBalancedAnswer = useCallback(async () => {
    if (!currentCard) return;

    const correctActions = ACTIONS.filter((a) => currentCard.frequencies[a] > 0);
    const total = correctActions.reduce((sum, action) => sum + (mixAllocations[action] ?? 0), 0);
    if (Math.abs(total - MIX_TOTAL_TARGET) >= MIX_TOTAL_EPSILON) return;

    const balancedAnswer: BalancedAnswer = { allocations: mixAllocations };
    const { score, grade } = scoreBalancedAnswer(balancedAnswer, currentCard.frequencies);
    const primaryAction = getPrimaryAction(currentCard.frequencies);
    const selectedAction = correctActions.reduce((best, action) => (
      (balancedAnswer.allocations[action] ?? 0) > (balancedAnswer.allocations[best] ?? 0) ? action : best
    ), primaryAction);
    const isCorrect = grade !== 'again';
    const feedbackKind: FeedbackKind = isCorrect ? 'correct' : 'wrong';

    await commitAnswer({
      grade,
      isCorrect,
      isMixedCorrect: false,
      responseTimeMs: Date.now() - startTimeRef.current,
      correctActions,
      primaryAction,
      sessionSelectedAction: selectedAction,
      feedbackSelectedAction: selectedAction,
      feedbackKind,
      balancedAnswer,
      balancedScore: score,
    });
  }, [commitAnswer, currentCard, mixAllocations]);

  const mixedActions = useMemo(
    () => (currentCard ? ACTIONS.filter((a) => currentCard.frequencies[a] > 0) : []),
    [currentCard]
  );
  const isMixedHand = mixedActions.length >= 2;
  const mixAllocationTotal = mixedActions.reduce((sum, action) => sum + (mixAllocations[action] ?? 0), 0);
  const isMixTotalValid = Math.abs(mixAllocationTotal - MIX_TOTAL_TARGET) < MIX_TOTAL_EPSILON;
  const isMixShortcutVisible = settings.showMixButton && isMixedHand;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTypingElement(event.target)) return;

      const key = event.key.toLowerCase();
      if (currentCard && !feedback) {
        const action = ACTION_KEYS[key];
        if (action && visibleActions.includes(action)) {
          event.preventDefault();
          void handleAnswer(action);
          return;
        }
        if (isMixShortcutVisible && MIX_KEYS.has(key)) {
          event.preventDefault();
          startMixAllocation();
          return;
        }
      }

      if (feedback && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        pickNext();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentCard, feedback, handleAnswer, isMixShortcutVisible, pickNext, startMixAllocation, visibleActions]);

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
    return <div className="flex min-h-[40vh] items-center justify-center text-gray-400">Loading...</div>;
  }

  if (!currentSpot) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2">
        <p className="text-red-600">{category ? 'Category not found.' : 'Spot not found.'}</p>
        <Link to="/spots" className="text-sm text-blue-600">Back to spots</Link>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2">
        <p className="text-yellow-600">No hands in range. Fill the chart first.</p>
        <Link to={`/spots/${currentSpot.id}/range`} className="text-sm text-blue-600">Open Chart Editor</Link>
      </div>
    );
  }

  const userAnswerBarPosition = feedback
    ? getBarPosition(feedback.frequencies, feedback.selectedAction)
    : 0;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col pb-[env(safe-area-inset-bottom)]">
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
        <div className="mt-4 min-h-[130px] w-full">
          {currentCard && !feedback && (
            <div className="flex h-full flex-col justify-center">
              <div className="flex gap-3" role="group" aria-label="Action buttons">
                {visibleActions.map((action) => (
                  <button
                    key={action}
                    onClick={() => handleAnswer(action)}
                    aria-label={`${ACTION_LABELS[action]} action`}
                    className={`flex flex-1 flex-col items-center rounded-xl ${ACTION_BUTTON_CLASSES[action]} py-3 text-base font-bold text-white active:scale-95`}
                  >
                    <span>{ACTION_LABELS[action]}</span>
                    <span className="text-xs font-medium text-white/60">{ACTION_SHORTCUT_LABELS[action]}</span>
                  </button>
                ))}
                {settings.showMixButton && isMixedHand && (
                  <button
                    onClick={startMixAllocation}
                    aria-label="Mix action"
                    className="flex flex-1 flex-col items-center rounded-xl bg-purple-600 py-3 text-base font-bold text-white active:scale-95"
                  >
                    <span>Mix</span>
                    <span className="text-xs font-medium text-white/60">{MIX_SHORTCUT_LABEL}</span>
                  </button>
                )}
              </div>
              {showMixAllocation && settings.showMixButton && isMixedHand && (
                <div className="mt-3 rounded-xl border border-purple-100 bg-purple-50 p-3">
                  <div className="space-y-2">
                    {mixedActions.map((action) => (
                      <div key={action} className="flex items-center justify-between gap-3">
                        <span className={`${ACTION_TEXT_CLASSES[action]} text-sm font-semibold`}>{ACTION_LABELS[action]}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => adjustMixAllocation(action, -1)}
                            className="h-7 w-7 rounded-md border border-gray-300 bg-white text-sm font-bold text-gray-700"
                          >
                            −
                          </button>
                          <span className="w-12 text-center text-sm font-semibold text-gray-700">
                            {mixAllocations[action] ?? 0}%
                          </span>
                          <button
                            onClick={() => adjustMixAllocation(action, 1)}
                            className="h-7 w-7 rounded-md border border-gray-300 bg-white text-sm font-bold text-gray-700"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`text-xs font-medium ${isMixTotalValid ? 'text-green-700' : 'text-red-600'}`}>
                      Total: {mixAllocationTotal}%
                    </span>
                    <button
                      onClick={handleBalancedAnswer}
                      disabled={!isMixTotalValid}
                      className="rounded-lg bg-purple-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              )}
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
              {feedback.balancedAnswer && (
                <div className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
                  {ACTIONS.filter((action) => feedback.frequencies[action] > 0).map((action) => (
                    <div key={action} className="flex items-center justify-between gap-4">
                      <span className={`${ACTION_TEXT_CLASSES[action]} font-medium`}>{ACTION_LABELS[action]}</span>
                      <span className="text-gray-600">
                        You {feedback.balancedAnswer?.allocations[action] ?? 0}% ·
                        {' '}Actual {(feedback.frequencies[action] * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                  {typeof feedback.balancedScore === 'number' && (
                    <div className="pt-1 font-medium text-gray-700">Score: {(feedback.balancedScore * 100).toFixed(0)}%</div>
                  )}
                </div>
              )}

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

function isTypingElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
}
