import { Action, HandFrequencies, AnswerGrade } from '@/domain/types';

export type BalancedAnswer = {
  allocations: Partial<Record<Action, number>>;
};

const ACTIONS: Action[] = ['fold', 'call', 'raise', 'jam'];

export function scoreBalancedAnswer(
  answer: BalancedAnswer,
  frequencies: HandFrequencies
): { score: number; grade: AnswerGrade } {
  const totalDeviation = ACTIONS.reduce((sum, action) => {
    const actual = frequencies[action] * 100;
    const provided = answer.allocations[action] ?? 0;
    return sum + Math.abs(provided - actual);
  }, 0);

  const score = Math.max(0, Math.min(1, 1 - totalDeviation / 200));
  const grade: AnswerGrade = score >= 0.95
    ? 'easy'
    : score >= 0.75
      ? 'good'
      : score >= 0.5
        ? 'hard'
        : 'again';

  return { score, grade };
}
