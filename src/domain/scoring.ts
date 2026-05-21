import { Action, HandFrequencies, AnswerGrade } from '@/domain/types';

export type BalancedAnswer = {
  allocations: Partial<Record<Action, number>>;
};

const ACTIONS: Action[] = ['fold', 'call', 'raise', 'jam'];
// Max L1 deviation is 200 when two actions are swapped 100/0 vs 0/100.
const MAX_TOTAL_DEVIATION = 200;
const EASY_THRESHOLD = 0.95;
const GOOD_THRESHOLD = 0.75;
const HARD_THRESHOLD = 0.5;

export function scoreBalancedAnswer(
  answer: BalancedAnswer,
  frequencies: HandFrequencies
): { score: number; grade: AnswerGrade } {
  const totalDeviation = ACTIONS.reduce((sum, action) => {
    const actual = frequencies[action] * 100;
    const provided = answer.allocations[action] ?? 0;
    return sum + Math.abs(provided - actual);
  }, 0);

  const score = Math.max(0, Math.min(1, 1 - totalDeviation / MAX_TOTAL_DEVIATION));
  const grade: AnswerGrade = score >= EASY_THRESHOLD
    ? 'easy'
    : score >= GOOD_THRESHOLD
      ? 'good'
      : score >= HARD_THRESHOLD
        ? 'hard'
        : 'again';

  return { score, grade };
}
