import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DeltaCard, buildDeltaDrillQueue, computeDeltas, findAnchorSpot } from '@/domain/delta';
import { Action, SessionAnswer, Spot, SpotRange, getSpotCategoryLabel } from '@/domain/types';
import { getAllCards } from '@/storage/cards';
import { getRange } from '@/storage/ranges';
import { getAllSessions, saveSession } from '@/storage/sessions';
import { getAllSpots, getSpotsByCategory } from '@/storage/spots';

type CategoryOption = {
  name: string;
  spotCount: number;
};

type Phase = 'binary' | 'action' | 'feedback';

type FeedbackState = {
  isCorrect: boolean;
  message: string;
  anchorAction: Action;
  targetAction: Action;
};

const ACTIONS: Action[] = ['fold', 'call', 'raise', 'jam'];
const ACTION_LABELS: Record<Action, string> = { fold: 'Fold', call: 'Call', raise: 'Raise', jam: 'Jam' };
const ACTION_BUTTON_CLASSES: Record<Action, string> = {
  fold: 'bg-fold',
  call: 'bg-call',
  raise: 'bg-raise',
  jam: 'bg-jam',
};
const ACTION_SHORTCUTS: Record<Action, string> = { fold: 'F · 1', call: 'C · 2', raise: 'R · 3', jam: 'J · 4' };
const BINARY_KEYS: Record<string, 'same' | 'different'> = { s: 'same', d: 'different' };
const ACTION_KEYS: Record<string, Action> = {
  f: 'fold',
  c: 'call',
  r: 'raise',
  j: 'jam',
  '1': 'fold',
  '2': 'call',
  '3': 'raise',
  '4': 'jam',
};

export default function DeltaTrainer() {
  const navigate = useNavigate();
  const { category: categoryFromPath } = useParams<{ category?: string }>();
  const category = categoryFromPath ? decodeURIComponent(categoryFromPath) : undefined;
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [sessions, setSessions] = useState<SessionAnswer[]>([]);
  const [rangesBySpot, setRangesBySpot] = useState<Map<string, SpotRange>>(new Map());
  const [autoAnchorId, setAutoAnchorId] = useState<string | null>(null);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [showAnchorSelector, setShowAnchorSelector] = useState(false);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('binary');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const startAtRef = useRef<number>(Date.now());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setFeedback(null);
      setPhase('binary');
      setIndex(0);
      setScore({ correct: 0, total: 0 });

      if (!category) {
        const allSpots = await getAllSpots();
        if (cancelled) return;
        const grouped = allSpots.reduce<Map<string, CategoryOption>>((map, spot) => {
          const name = getSpotCategoryLabel(spot.category);
          map.set(name, { name, spotCount: (map.get(name)?.spotCount ?? 0) + 1 });
          return map;
        }, new Map());
        setCategories(Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name)));
        setSpots([]);
        setSessions([]);
        setRangesBySpot(new Map());
        setAutoAnchorId(null);
        setAnchorId(null);
        setLoading(false);
        return;
      }

      const categorySpots = (await getSpotsByCategory(category)).sort((a, b) => a.effectiveStackBb - b.effectiveStackBb);
      const [ranges, allCards, allSessions] = await Promise.all([
        Promise.all(categorySpots.map((spot) => getRange(spot.id))),
        getAllCards(),
        getAllSessions(),
      ]);
      if (cancelled) return;

      const nextRanges = new Map<string, SpotRange>();
      for (let i = 0; i < categorySpots.length; i += 1) {
        const range = ranges[i];
        if (!range) continue;
        nextRanges.set(categorySpots[i].id, range);
      }
      const rangedSpots = categorySpots.filter((spot) => nextRanges.has(spot.id));
      const spotIds = new Set(rangedSpots.map((spot) => spot.id));
      const categoryCards = allCards.filter((card) => spotIds.has(card.spotId));
      const autoAnchor = rangedSpots.length > 0 ? findAnchorSpot(rangedSpots, categoryCards) : null;

      setCategories([]);
      setSpots(rangedSpots);
      setSessions(allSessions);
      setRangesBySpot(nextRanges);
      setAutoAnchorId(autoAnchor?.id ?? null);
      setAnchorId((prev) => (prev && spotIds.has(prev) ? prev : autoAnchor?.id ?? null));
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [category]);

  const drill = useMemo(() => {
    if (!anchorId) return [];
    const anchorRange = rangesBySpot.get(anchorId);
    if (!anchorRange) return [];

    const queue: DeltaCard[] = [];
    const spotIds = new Set(spots.map((spot) => spot.id));
    const relevantSessions = sessions.filter((session) => spotIds.has(session.spotId));

    for (const targetSpot of spots) {
      if (targetSpot.id === anchorId) continue;
      const targetRange = rangesBySpot.get(targetSpot.id);
      if (!targetRange) continue;
      const deltas = computeDeltas(anchorRange, targetRange, anchorId, targetSpot.id);
      if (deltas.length === 0) continue;
      queue.push(...buildDeltaDrillQueue(deltas, relevantSessions, anchorRange, targetRange));
    }

    return shuffle(queue);
  }, [anchorId, rangesBySpot, sessions, spots]);

  const current = drill[index];
  const anchorSpot = spots.find((spot) => spot.id === anchorId) ?? null;
  const targetSpot = current ? spots.find((spot) => spot.id === current.targetSpotId) ?? null : null;
  const isCompleted = drill.length > 0 && index >= drill.length;

  useEffect(() => {
    startAtRef.current = Date.now();
  }, [index, phase]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTypingElement(event.target)) return;
      const key = event.key.toLowerCase();

      if (phase === 'binary') {
        const answer = BINARY_KEYS[key];
        if (answer) {
          event.preventDefault();
          handleBinaryAnswer(answer);
        }
        return;
      }

      if (phase === 'action') {
        const action = ACTION_KEYS[key];
        if (action) {
          event.preventDefault();
          handleActionAnswer(action);
        }
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        goNext();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, current?.hand, current?.targetSpotId]);

  async function persistAnswer(params: {
    card: DeltaCard;
    selectedAction: Action;
    isCorrect: boolean;
    errorType?: SessionAnswer['errorType'];
  }) {
    const answer: SessionAnswer = {
      spotId: params.card.targetSpotId,
      hand: params.card.hand,
      selectedAction: params.selectedAction,
      correctActions: [params.card.targetAction],
      primaryAction: params.card.targetAction,
      isCorrect: params.isCorrect,
      isMixedCorrect: false,
      responseTimeMs: Date.now() - startAtRef.current,
      grade: params.isCorrect ? 'good' : 'again',
      timestamp: Date.now(),
      errorType: params.errorType,
    };
    await saveSession(answer);
  }

  async function finishCard(params: {
    card: DeltaCard;
    selectedAction: Action;
    isCorrect: boolean;
    message: string;
    errorType?: SessionAnswer['errorType'];
  }) {
    await persistAnswer({
      card: params.card,
      selectedAction: params.selectedAction,
      isCorrect: params.isCorrect,
      errorType: params.errorType,
    });
    setScore((prev) => ({
      correct: prev.correct + (params.isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));
    setFeedback({
      isCorrect: params.isCorrect,
      message: params.message,
      anchorAction: params.card.anchorAction,
      targetAction: params.card.targetAction,
    });
    setPhase('feedback');
  }

  async function handleBinaryAnswer(answer: 'same' | 'different') {
    if (!current) return;
    const guessedSame = answer === 'same';
    if (!guessedSame && !current.isSame) {
      setFeedback(null);
      setPhase('action');
      return;
    }

    if (guessedSame && current.isSame) {
      await finishCard({
        card: current,
        selectedAction: current.targetAction,
        isCorrect: true,
        message: 'Correct: same action.',
      });
      return;
    }

    if (guessedSame && !current.isSame) {
      await finishCard({
        card: current,
        selectedAction: current.anchorAction,
        isCorrect: false,
        message: `Different. Anchor is ${ACTION_LABELS[current.anchorAction]}, target is ${ACTION_LABELS[current.targetAction]}.`,
        errorType: 'depth_confusion',
      });
      return;
    }

    await finishCard({
      card: current,
      selectedAction: current.anchorAction,
      isCorrect: false,
      message: `Actually same: ${ACTION_LABELS[current.targetAction]} in both.`,
      errorType: 'depth_confusion',
    });
  }

  async function handleActionAnswer(action: Action) {
    if (!current) return;
    const isCorrect = action === current.targetAction;
    const errorType = !isCorrect
      ? (action === current.anchorAction ? 'depth_confusion' : 'wrong_action')
      : undefined;
    await finishCard({
      card: current,
      selectedAction: action,
      isCorrect,
      message: isCorrect
        ? 'Correct.'
        : `Wrong. Target is ${ACTION_LABELS[current.targetAction]}.`,
      errorType,
    });
  }

  function goNext() {
    setFeedback(null);
    setPhase('binary');
    if (index + 1 < drill.length) {
      setIndex((value) => value + 1);
      return;
    }
    setIndex(drill.length);
  }

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center text-gray-400">Loading...</div>;
  }

  if (!category) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold">Delta Trainer</h1>
          <div className="text-sm text-gray-500">Learn differences between depths</div>
        </div>
        {categories.length === 0 ? (
          <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2">
            <p className="text-yellow-600">No categories found.</p>
            <Link to="/" className="text-sm text-blue-600">Back to dashboard</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {categories.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => navigate(`/delta-trainer/${encodeURIComponent(item.name)}`)}
                className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:bg-gray-50"
              >
                <div className="font-semibold text-gray-900">{item.name}</div>
                <div className="text-sm text-gray-500">
                  {item.spotCount} spot{item.spotCount === 1 ? '' : 's'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (spots.length < 2 || !anchorSpot) {
    return (
      <div className="mx-auto flex min-h-[40vh] w-full max-w-4xl flex-col items-center justify-center gap-2">
        <p className="text-yellow-600">Need at least 2 spots with ranges in this category.</p>
        <Link to="/" className="text-sm text-blue-600">Back to dashboard</Link>
      </div>
    );
  }

  if (drill.length === 0) {
    return (
      <div className="mx-auto flex min-h-[40vh] w-full max-w-4xl flex-col items-center justify-center gap-2">
        <p className="text-yellow-600">No delta hands found for this category.</p>
        <Link to="/" className="text-sm text-blue-600">Back to dashboard</Link>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="mx-auto flex min-h-[40vh] w-full max-w-3xl flex-col items-center justify-center gap-4 rounded-xl border border-gray-200 bg-white p-6 text-center">
        <h1 className="text-xl font-bold">Delta Trainer complete</h1>
        <div className="text-sm text-gray-500">{category}</div>
        <div className="text-lg font-semibold">Score {score.correct}/{score.total}</div>
        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setPhase('binary');
            setFeedback(null);
            setScore({ correct: 0, total: 0 });
          }}
          className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-500"
        >
          Restart
        </button>
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-900">← Back to dashboard</Link>
      </div>
    );
  }

  if (!current || !targetSpot) {
    return (
      <div className="mx-auto flex min-h-[40vh] w-full max-w-4xl flex-col items-center justify-center gap-2">
        <p className="text-yellow-600">No delta hands found for this category.</p>
        <Link to="/" className="text-sm text-blue-600">Back to dashboard</Link>
      </div>
    );
  }

  const progressPercent = Math.round(((index + 1) / drill.length) * 100);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
      <div className="mb-3">
        <h1 className="text-xl font-bold">Delta Trainer</h1>
        <div className="text-sm text-gray-500">{category}</div>
      </div>

      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs text-gray-500">Base</div>
            <div className="text-base font-semibold">{anchorSpot.effectiveStackBb}bb</div>
          </div>
          <button
            type="button"
            onClick={() => setShowAnchorSelector((value) => !value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Change anchor
          </button>
        </div>
        {showAnchorSelector && (
          <div className="mt-2">
            <select
              value={anchorId ?? ''}
              onChange={(event) => {
                setAnchorId(event.target.value || null);
                setIndex(0);
                setPhase('binary');
                setFeedback(null);
                setScore({ correct: 0, total: 0 });
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {spots.map((spot) => (
                <option key={spot.id} value={spot.id}>
                  {spot.effectiveStackBb}bb{autoAnchorId === spot.id ? ' (auto)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mb-3 rounded-full bg-gray-200">
        <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="mb-6 flex items-center justify-between text-xs text-gray-500">
        <span>{Math.min(index + 1, drill.length)}/{drill.length}</span>
        <span>Score {score.correct}/{score.total}</span>
      </div>

      <div className="flex-1 rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <div className="mb-1 text-xs text-gray-500">Base: {anchorSpot.effectiveStackBb}bb — <span className="font-semibold text-gray-700">{ACTION_LABELS[current.anchorAction]}</span></div>
        <div className="mb-4 text-xs text-gray-500">This: {targetSpot.effectiveStackBb}bb</div>
        <div className="mb-6 text-5xl font-bold">{current.hand}</div>

        {phase === 'binary' && (
          <div className="mx-auto grid max-w-sm grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleBinaryAnswer('same')}
              className="rounded-xl bg-emerald-600 py-4 text-lg font-bold text-white shadow-sm transition hover:bg-emerald-500 active:scale-95"
            >
              Same
              <div className="text-xs font-medium text-emerald-100">S</div>
            </button>
            <button
              type="button"
              onClick={() => handleBinaryAnswer('different')}
              className="rounded-xl bg-indigo-600 py-4 text-lg font-bold text-white shadow-sm transition hover:bg-indigo-500 active:scale-95"
            >
              Different
              <div className="text-xs font-medium text-indigo-100">D</div>
            </button>
          </div>
        )}

        {phase === 'action' && (
          <div>
            <div className="mb-4 text-sm text-gray-500">Different. What action?</div>
            <div className="mx-auto grid max-w-xs grid-cols-2 gap-3">
              {ACTIONS.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => handleActionAnswer(action)}
                  className={`flex flex-col items-center rounded-xl ${ACTION_BUTTON_CLASSES[action]} py-3 text-lg font-bold text-white shadow-sm transition active:scale-95`}
                >
                  <span>{ACTION_LABELS[action]}</span>
                  <span className="text-xs font-medium text-white/70">{ACTION_SHORTCUTS[action]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'feedback' && feedback && (
          <div className="mx-auto max-w-sm">
            <div className={`mb-3 text-xl font-bold ${feedback.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
              {feedback.isCorrect ? '✓ Correct' : '✗ Wrong'}
            </div>
            <div className="mb-4 text-sm text-gray-600">{feedback.message}</div>
            <div className="mb-5 rounded-lg bg-gray-50 p-3 text-left text-sm">
              <div>Base {anchorSpot.effectiveStackBb}bb: <span className="font-semibold">{ACTION_LABELS[feedback.anchorAction]}</span></div>
              <div>
                This {targetSpot.effectiveStackBb}bb:{' '}
                <span className={`font-semibold ${feedback.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                  {ACTION_LABELS[feedback.targetAction]}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={goNext}
              className="w-full rounded-xl bg-gray-900 py-3.5 text-base font-bold text-white active:scale-95"
            >
              Next →
            </button>
            <div className="mt-2 text-xs text-gray-400">Enter / Space</div>
          </div>
        )}
      </div>

      <Link to="/" className="mt-4 text-center text-sm text-gray-500 hover:text-gray-900">← Back to dashboard</Link>
    </div>
  );
}

function isTypingElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
