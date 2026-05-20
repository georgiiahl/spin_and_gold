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
import { getAllSessions, saveSession } from '@/storage/sessions';
import { getCardsBySpot, saveCard, saveCards } from '@/storage/cards';
import { createNewCard, determineGrade, scheduleCard } from '@/domain/memory';
import { pickNextCard } from '@/domain/priority';
import { loadSettings } from '@/storage/settings';
import PokerTable from '@/components/PokerTable';
import SessionSummary from '@/components/SessionSummary';
import { buildCategoryProgress } from '@/domain/progress';
import { FeedbackKind, getFeedbackPanelClass, triggerFeedback } from '@/domain/feedback';

const ACTION_LABELS: Record<Action, string> = {
  fold: 'Fold',
  call: 'Call',
  raise: 'Raise',
  jam: 'Jam',
};
const ACTION_BUTTON_CLASSES: Record<Action, string> = {
  fold: 'bg-fold',
  call: 'bg-call',
  raise: 'bg-raise',
  jam: 'bg-jam',
};
const ACTION_TEXT_CLASSES: Record<Action, string> = {
  fold: 'text-fold',
  call: 'text-call',
  raise: 'text-raise',
  jam: 'text-jam',
};

const ACTIONS: Action[] = ['fold', 'call', 'raise', 'jam'];
const RECENT_HANDS_LIMIT = 8;
const RECENT_SPOTS_LIMIT = 3;
const DEPTH_CONFUSION_NEIGHBOR_BB = 3;

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

  const settings = useMemo(() => loadSettings(), []);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [cards, setCards] = useState<TrainerCard[]>([]);
  const [rangesBySpot, setRangesBySpot] = useState<Map<string, SpotRange>>(new Map());
  const [currentCard, setCurrentCard] = useState<TrainerCard | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [fixMode, setFixMode] = useState(false);
  const [pendingMistakeIds, setPendingMistakeIds] = useState<string[]>([]);
  const [remainingDueIds, setRemainingDueIds] = useState<string[]>([]);
  const [sessionAnswers, setSessionAnswers] = useState<SessionAnswer[]>([]);
  const [historySessions, setHistorySessions] = useState<SessionAnswer[]>([]);
  const [sessionStartMs, setSessionStartMs] = useState<number>(Date.now());
  const [clockMs, setClockMs] = useState<number>(Date.now());
  const [levelBefore, setLevelBefore] = useState(0);
  const [levelAfter, setLevelAfter] = useState(0);
  const [trainingCategoryLabel, setTrainingCategoryLabel] = useState('Category');
  const [depthHighlight, setDepthHighlight] = useState(false);

  const startTimeRef = useRef<number>(0);
  const recentHandsRef = useRef<string[]>([]);
  const lastShownSpotIdsRef = useRef<string[]>([]);
  const prevDepthRef = useRef<number | null>(null);

  const currentSpot = useMemo(
    () => spots.find((spot) => spot.id === currentCard?.spotId) ?? spots[0] ?? null,
    [currentCard?.spotId, spots]
  );

  const visibleActions = useMemo(() => {
    const actionSet = new Set<Action>();
    for (const range of rangesBySpot.values()) {
      for (const hand of Object.values(range)) {
        for (const action of ACTIONS) {
          if (hand[action] > 0) {
            actionSet.add(action);
          }
        }
      }
    }
    const actions = ACTIONS.filter((action) => actionSet.has(action));
    return actions.length > 0 ? actions : ACTIONS;
  }, [rangesBySpot]);

  const timeLimitMs = settings.sessionTimeLimitMin * 60_000;
  const timedRemainingMs = Math.max(0, timeLimitMs - (clockMs - sessionStartMs));
  const isTimedLimitReached = settings.sessionMode === 'timed' && (clockMs - sessionStartMs) >= timeLimitMs;
  const isCardLimitReached = settings.sessionMode === 'cards' && sessionCount >= settings.sessionCardLimit;

  useEffect(() => {
    initTrainer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, category]);

  useEffect(() => {
    if (sessionEnded) return;
    const timer = window.setInterval(() => setClockMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [sessionEnded]);

  useEffect(() => {
    const depth = currentSpot?.effectiveStackBb;
    if (depth == null) return;
    if (prevDepthRef.current !== null && prevDepthRef.current !== depth) {
      prevDepthRef.current = depth;
      setDepthHighlight(true);
      const timer = window.setTimeout(() => setDepthHighlight(false), 900);
      return () => window.clearTimeout(timer);
    }
    prevDepthRef.current = depth;
  }, [currentSpot?.effectiveStackBb]);

  async function initTrainer() {
    setLoading(true);
    setSessionEnded(false);
    setFixMode(false);
    setPendingMistakeIds([]);
    setRemainingDueIds([]);
    setSessionAnswers([]);
    setCards([]);
    setSpots([]);
    setRangesBySpot(new Map());
    setCurrentCard(null);
    setFeedback(null);
    setSessionCount(0);
    setCorrectCount(0);
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

    const loadedSessions = await getAllSessions();
    setHistorySessions(loadedSessions);

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

      const cardMap = new Map(existingCards.map((card) => [card.hand, card]));
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

    if (newCards.length > 0) {
      await saveCards(newCards);
    }

    setRangesBySpot(rangeMap);
    setCards(allCards);

    const progressBefore = buildCategoryProgress(categoryLabel, selectedSpots, allCards, loadedSessions);
    setLevelBefore(progressBefore.level);
    setLevelAfter(progressBefore.level);

    const trainableCards = filterTrainableCards(allCards, settings.includeTrashHandsInTraining);
    const dueCards = trainableCards.filter((card) => !card.memory.dueAt || card.memory.dueAt <= Date.now());
    const dueIds = dueCards.map((card) => card.id);
    setRemainingDueIds(dueIds);
    setSessionStartMs(Date.now());
    setClockMs(Date.now());

    const firstPool = applyMixFocus(dueCards, settings.focusOnMixedHands);
    const first = chooseNextCard(firstPool);
    if (first) {
      showCard(first);
    } else {
      endSession(allCards);
    }

    setLoading(false);
  }

  function rememberShownCard(card: TrainerCard) {
    recentHandsRef.current = [...recentHandsRef.current, card.hand].slice(-RECENT_HANDS_LIMIT);
    lastShownSpotIdsRef.current = [...lastShownSpotIdsRef.current, card.spotId].slice(-RECENT_SPOTS_LIMIT);
  }

  function showCard(card: TrainerCard) {
    setCurrentCard(card);
    startTimeRef.current = Date.now();
    rememberShownCard(card);
  }

  function chooseNextCard(pool: TrainerCard[]): TrainerCard | null {
    const recentSpotIds = lastShownSpotIdsRef.current;
    let next = pickNextCard(pool, recentHandsRef.current, recentSpotIds);
    const nextSpotId = next?.spotId;

    if (
      nextSpotId
      && recentSpotIds.length === RECENT_SPOTS_LIMIT
      && recentSpotIds.every((spotId) => spotId === nextSpotId)
    ) {
      const alternate = pickNextCard(
        pool.filter((card) => card.spotId !== nextSpotId),
        recentHandsRef.current,
        recentSpotIds
      );
      if (alternate) {
        next = alternate;
      }
    }

    return next;
  }

  function shouldEndNormalSession() {
    if (remainingDueIds.length === 0) return true;
    if (isTimedLimitReached) return true;
    if (isCardLimitReached) return true;
    return false;
  }

  function endSession(cardSnapshot = cards) {
    const combinedSessions = [...historySessions, ...sessionAnswers];
    const progressAfter = buildCategoryProgress(trainingCategoryLabel, spots, cardSnapshot, combinedSessions);
    setLevelAfter(progressAfter.level);
    setSessionEnded(true);
    setCurrentCard(null);
    setFeedback(null);
  }

  function startFixMistakes() {
    if (pendingMistakeIds.length === 0) return;
    setFixMode(true);
    setSessionEnded(false);
    setFeedback(null);
    const mistakeCards = cards.filter((card) => pendingMistakeIds.includes(card.id));
    const first = chooseNextCard(mistakeCards);
    if (first) {
      showCard(first);
    }
  }

  function pickNext() {
    if (fixMode) {
      const mistakeCards = cards.filter((card) => pendingMistakeIds.includes(card.id));
      if (mistakeCards.length === 0) {
        setFixMode(false);
        endSession();
        return;
      }
      const next = chooseNextCard(applyMixFocus(mistakeCards, settings.focusOnMixedHands));
      if (next) {
        showCard(next);
      }
      setFeedback(null);
      return;
    }

    if (shouldEndNormalSession()) {
      endSession();
      return;
    }

    const dueSet = new Set(remainingDueIds);
    const basePool = filterTrainableCards(cards, settings.includeTrashHandsInTraining)
      .filter((card) => dueSet.has(card.id));

    if (basePool.length === 0) {
      endSession();
      return;
    }

    const next = chooseNextCard(applyMixFocus(basePool, settings.focusOnMixedHands));
    if (next) {
      showCard(next);
    }
    setFeedback(null);
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
      if (!tolerant && trueMix && action !== primaryAction) {
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
    }
    const n = updatedCard.stats.shown;
    updatedCard.stats.avgResponseMs = Math.round(
      ((updatedCard.stats.avgResponseMs * (n - 1)) + responseTimeMs) / n
    );

    let errorType: SessionAnswer['errorType'];
    if (!isCorrect) {
      if (errorClassification.type === 'depth_confusion') {
        errorType = 'depth_confusion';
      } else if (!tolerant && !trueMix && action !== primaryAction && freq[action] > 0) {
        errorType = 'mix_miss';
      } else {
        errorType = 'wrong_action';
      }
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

    triggerFeedback(feedbackKind, {
      feedbackSounds: settings.feedbackSounds,
      feedbackVibration: settings.feedbackVibration,
    });

    setSessionCount((count) => count + 1);
    if (isCorrect) {
      setCorrectCount((count) => count + 1);
    }

    setCards((prev) => prev.map((card) => (card.id === updatedCard.id ? updatedCard : card)));
    setSessionAnswers((prev) => [...prev, answer]);

    if (!fixMode) {
      setRemainingDueIds((prev) => prev.filter((cardId) => cardId !== currentCard.id));
      if (!isCorrect) {
        setPendingMistakeIds((prev) => (prev.includes(currentCard.id) ? prev : [...prev, currentCard.id]));
      }
    } else if (isCorrect) {
      setPendingMistakeIds((prev) => prev.filter((cardId) => cardId !== currentCard.id));
    }
  }, [
    currentCard,
    currentSpot,
    fixMode,
    rangesBySpot,
    settings.fastResponseMs,
    settings.feedbackSounds,
    settings.feedbackVibration,
    settings.mixStrategy,
    settings.mixThreshold,
    settings.slowResponseMs,
    spots,
  ]);

  const summaryAccuracy = sessionAnswers.length > 0
    ? Math.round((sessionAnswers.filter((answer) => answer.isCorrect).length / sessionAnswers.length) * 100)
    : 0;
  const depthConfusions = sessionAnswers.filter((answer) => answer.errorType === 'depth_confusion').length;
  const wrongCount = sessionAnswers.filter((answer) => !answer.isCorrect && answer.errorType !== 'depth_confusion').length;
  const avgResponseMs = sessionAnswers.length > 0
    ? Math.round(sessionAnswers.reduce((sum, answer) => sum + answer.responseTimeMs, 0) / sessionAnswers.length)
    : 0;

  const mistakeSummaries = pendingMistakeIds
    .map((idToFix) => {
      const [spotId, hand] = idToFix.split(':');
      const spot = spots.find((item) => item.id === spotId);
      const card = cards.find((item) => item.id === idToFix);
      const latestError = [...sessionAnswers].reverse().find(
        (answer) => answer.spotId === spotId && answer.hand === hand && !answer.isCorrect
      );
      if (!spot || !card) return null;
      return {
        id: idToFix,
        hand,
        spotTitle: spot.title,
        expectedAction: getPrimaryAction(card.frequencies),
        errorType: latestError?.errorType,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  if (loading) {
    return <div className="p-4 text-gray-500">Loading...</div>;
  }

  if (!currentSpot && !sessionEnded) {
    return (
      <div className="p-4">
        <p className="text-red-600">{category ? 'Category not found.' : 'Spot not found.'}</p>
        <Link to="/spots" className="text-blue-400 text-sm">Back to spots</Link>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="p-4">
        <p className="text-yellow-500">No hands in range. Fill the chart first.</p>
        {currentSpot && (
          <Link to={`/spots/${currentSpot.id}/range`} className="text-blue-400 text-sm mt-2 block">
            Open Chart Editor
          </Link>
        )}
      </div>
    );
  }

  if (sessionEnded) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col p-4">
        <SessionSummary
          totalCardsReviewed={sessionAnswers.length}
          accuracyPercent={summaryAccuracy}
          depthConfusions={depthConfusions}
          wrongCount={wrongCount}
          avgResponseMs={avgResponseMs}
          levelBefore={levelBefore}
          levelAfter={levelAfter}
          mistakes={mistakeSummaries}
          onStartFixMistakes={startFixMistakes}
          complete={pendingMistakeIds.length === 0}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {trainingCategoryLabel} · {currentSpot?.title}
          {fixMode && ' · Fix Mistakes'}
        </span>
        <span className="text-xs text-gray-500">
          {correctCount}/{sessionCount}
          {sessionCount > 0 && ` (${Math.round((correctCount / sessionCount) * 100)}%)`}
        </span>
      </div>

      <div className={`mb-3 text-center text-4xl font-extrabold ${depthHighlight ? 'animate-pulse-amber text-amber-600' : 'text-gray-900'}`}>
        {currentSpot?.effectiveStackBb}bb
      </div>

      {settings.sessionMode === 'timed' && (
        <div className="mb-3 text-center text-sm text-gray-600">
          Time left: {Math.ceil(timedRemainingMs / 1000)}s
        </div>
      )}
      {settings.sessionMode === 'cards' && (
        <div className="mb-3 text-center text-sm text-gray-600">
          Cards: {sessionCount}/{settings.sessionCardLimit}
        </div>
      )}
      {settings.sessionMode === 'until_done' && (
        <div className="mb-3 text-center text-sm text-gray-600">
          Remaining due cards: {remainingDueIds.length}
        </div>
      )}

      <PokerTable
        format={currentSpot?.format ?? '3max'}
        actingPosition={currentSpot?.actingPosition ?? 'BTN'}
        history={currentSpot?.history ?? []}
        effectiveStackBb={currentSpot?.effectiveStackBb ?? 0}
        hand={currentCard?.hand}
      />

      <div className="mt-4 flex flex-1 flex-col items-center justify-center">
        {currentCard && !feedback && (
          <div className="w-full max-w-xs">
            <div className="mb-4 text-center text-sm text-gray-500">What's your action?</div>
            <div className="grid grid-cols-2 gap-3">
              {visibleActions.map((action) => (
                <button
                  key={action}
                  onClick={() => handleAnswer(action)}
                  className={`rounded-xl ${ACTION_BUTTON_CLASSES[action]} py-4 text-lg font-bold text-white shadow-sm transition-transform active:scale-95`}
                >
                  {ACTION_LABELS[action]}
                </button>
              ))}
            </div>
          </div>
        )}

        {feedback && (
          <div className="w-full max-w-xs text-center">
            <div className={`mb-3 text-xl font-bold ${feedback.kind === 'wrong' ? 'text-red-600' : feedback.kind === 'depth_confusion' ? 'text-amber-600' : 'text-green-600'}`}>
              {feedback.kind === 'mix_acceptable'
                ? '~ Mix acceptable'
                : feedback.kind === 'slow_correct'
                  ? '✓ Slow but correct'
                  : feedback.kind === 'depth_confusion'
                    ? '⚠ Wrong depth'
                    : feedback.isCorrect
                      ? '✓ Correct'
                      : '✗ Wrong'}
            </div>

            {feedback.kind === 'depth_confusion' && feedback.confusedWithSpot && (
              <div className="mb-3 inline-flex animate-pulse-amber rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
                {ACTION_LABELS[feedback.selectedAction]} is correct at {feedback.confusedWithSpot.effectiveStackBb}bb
              </div>
            )}

            <div className={`mb-4 rounded-2xl border p-4 text-left text-sm shadow-sm transition-colors duration-300 ${getFeedbackPanelClass(feedback.kind)}`}>
              <div className="mb-2">
                <span className="text-gray-500">You chose: </span>
                <span className={`font-medium ${ACTION_TEXT_CLASSES[feedback.selectedAction]}`}>
                  {ACTION_LABELS[feedback.selectedAction]}
                </span>
              </div>
              <div className="mb-2">
                <span className="text-gray-500">Primary: </span>
                <span className="font-medium">{ACTION_LABELS[feedback.primaryAction]}</span>
              </div>
              {settings.showFrequenciesInFeedback && (
                <div>
                  <span className="text-gray-500">Frequencies: </span>
                  <div className="mt-1">
                    {ACTIONS.filter((action) => feedback.frequencies[action] > 0).map((action) => (
                      <span key={action} className={`mr-2 inline-block ${ACTION_TEXT_CLASSES[action]}`}>
                        {ACTION_LABELS[action]} {(feedback.frequencies[action] * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={pickNext}
              className="w-full rounded-xl bg-blue-600 py-4 text-lg font-bold text-white transition-transform hover:bg-blue-500 active:scale-95"
            >
              {fixMode
                ? pendingMistakeIds.length <= 1 && feedback.isCorrect
                  ? 'Finish session'
                  : 'Next mistake →'
                : shouldEndNormalSession()
                  ? 'View summary'
                  : 'Next →'}
            </button>
          </div>
        )}
      </div>

      <Link to={category ? '/' : '/spots'} className="mt-4 block text-center text-sm text-gray-500 hover:text-gray-900">
        ← End session
      </Link>
    </div>
  );
}

function filterTrainableCards(cards: TrainerCard[], includeTrashHandsInTraining: boolean): TrainerCard[] {
  if (includeTrashHandsInTraining) return cards;
  return cards.filter((card) => !isTrashHand(card));
}

function applyMixFocus(cards: TrainerCard[], focusOnMixedHands: boolean): TrainerCard[] {
  if (!focusOnMixedHands) return cards;
  const mixed = cards.filter((card) => countNonZeroActions(card) > 1);
  return mixed.length > 0 ? mixed : cards;
}

function isTrashHand(card: TrainerCard): boolean {
  return (
    card.frequencies.fold === 1
    && card.frequencies.call === 0
    && card.frequencies.raise === 0
    && card.frequencies.jam === 0
  );
}

function countNonZeroActions(card: TrainerCard): number {
  return Object.values(card.frequencies).reduce((count, value) => count + (value > 0 ? 1 : 0), 0);
}

function getPrimaryAction(freq: HandFrequencies): Action {
  return ACTIONS.reduce((best, action) => (freq[action] > freq[best] ? action : best), 'fold' as Action);
}

function classifyError(
  selectedAction: Action,
  currentSpot: Spot,
  hand: string,
  categorySpots: Spot[],
  allRanges: Map<string, SpotRange>
): { type: 'wrong' | 'depth_confusion'; confusedWithSpot?: Spot } {
  const siblings = categorySpots
    .filter((spot) => spot.id !== currentSpot.id && spot.effectiveStackBb !== currentSpot.effectiveStackBb)
    .sort(
      (a, b) =>
        Math.abs(a.effectiveStackBb - currentSpot.effectiveStackBb)
        - Math.abs(b.effectiveStackBb - currentSpot.effectiveStackBb)
    );

  for (const sibling of siblings) {
    const siblingRange = allRanges.get(sibling.id);
    if (!siblingRange) continue;
    const siblingFreq = siblingRange[hand];
    if (!siblingFreq) continue;

    const siblingPrimary = getPrimaryAction(siblingFreq);
    const diff = Math.abs(sibling.effectiveStackBb - currentSpot.effectiveStackBb);
    if (siblingPrimary === selectedAction && diff <= DEPTH_CONFUSION_NEIGHBOR_BB) {
      return { type: 'depth_confusion', confusedWithSpot: sibling };
    }
  }

  return { type: 'wrong' };
}
