import { Action, CardPhase, SessionAnswer, TrainerCard } from '@/domain/types';

const ACTIONS: Action[] = ['fold', 'call', 'raise', 'jam'];
const CARD_PHASES: CardPhase[] = ['new', 'learning', 'review', 'mastered', 'relearning'];

export type ActionAccuracy = {
  attempts: number;
  correct: number;
  accuracy: number;
};

export type SpotStats = {
  phaseDistribution: Record<CardPhase, number>;
  accuracyByAction: Record<Action, ActionAccuracy>;
  avgResponseTimeMs: number;
};

export type HardestHandStat = {
  hand: string;
  attempts: number;
  correct: number;
  correctRate: number;
};

export function computeSpotStats(sessions: SessionAnswer[], cards: TrainerCard[]): SpotStats {
  const phaseDistribution = CARD_PHASES.reduce<Record<CardPhase, number>>(
    (distribution, phase) => {
      distribution[phase] = 0;
      return distribution;
    },
    {} as Record<CardPhase, number>
  );

  for (const card of cards) {
    phaseDistribution[card.memory.phase] += 1;
  }

  const accuracyTotals = ACTIONS.reduce<Record<Action, { attempts: number; correct: number }>>(
    (totals, action) => {
      totals[action] = { attempts: 0, correct: 0 };
      return totals;
    },
    {} as Record<Action, { attempts: number; correct: number }>
  );

  let responseTimeTotal = 0;
  for (const session of sessions) {
    const actionTotals = accuracyTotals[session.selectedAction];
    actionTotals.attempts += 1;
    if (session.isCorrect) {
      actionTotals.correct += 1;
    }
    responseTimeTotal += session.responseTimeMs;
  }

  const accuracyByAction = ACTIONS.reduce<Record<Action, ActionAccuracy>>((totals, action) => {
    const { attempts, correct } = accuracyTotals[action];
    totals[action] = {
      attempts,
      correct,
      accuracy: attempts > 0 ? correct / attempts : 0,
    };
    return totals;
  }, {} as Record<Action, ActionAccuracy>);

  return {
    phaseDistribution,
    accuracyByAction,
    avgResponseTimeMs: sessions.length > 0 ? Math.round(responseTimeTotal / sessions.length) : 0,
  };
}

export function getHardestHands(
  sessions: SessionAnswer[],
  minAttempts = 3
): HardestHandStat[] {
  const byHand = new Map<string, { attempts: number; correct: number }>();

  for (const session of sessions) {
    const stats = byHand.get(session.hand) ?? { attempts: 0, correct: 0 };
    stats.attempts += 1;
    if (session.isCorrect) {
      stats.correct += 1;
    }
    byHand.set(session.hand, stats);
  }

  return [...byHand.entries()]
    .map(([hand, stats]) => ({
      hand,
      attempts: stats.attempts,
      correct: stats.correct,
      correctRate: stats.attempts > 0 ? stats.correct / stats.attempts : 0,
    }))
    .filter((stats) => stats.attempts >= minAttempts)
    .sort((a, b) => {
      if (a.correctRate !== b.correctRate) return a.correctRate - b.correctRate;
      if (a.attempts !== b.attempts) return b.attempts - a.attempts;
      return a.hand.localeCompare(b.hand);
    })
    .slice(0, 10);
}

export function getErrorHeatmap(sessions: SessionAnswer[]): Map<string, number> {
  const heatmap = new Map<string, number>();

  for (const session of sessions) {
    if (session.isCorrect && !session.errorType) continue;
    heatmap.set(session.hand, (heatmap.get(session.hand) ?? 0) + 1);
  }

  return heatmap;
}
