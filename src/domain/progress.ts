import { SessionAnswer, Spot, TrainerCard } from '@/domain/types';

export type CategoryProgress = {
  category: string;
  level: 0 | 1 | 2 | 3 | 4 | 5;
  totalCards: number;
  masteredCards: number;
  reviewCards: number;
  learningCards: number;
  newCards: number;
  recentAccuracy: number;
};

export function calculateLevel(progress: CategoryProgress): number {
  const matureRatio = progress.totalCards > 0
    ? (progress.masteredCards + progress.reviewCards) / progress.totalCards
    : 0;
  if (matureRatio >= 0.95 && progress.recentAccuracy >= 0.9) return 5;
  if (matureRatio >= 0.8) return 4;
  if (matureRatio >= 0.6) return 3;
  if (matureRatio >= 0.35) return 2;
  if (matureRatio >= 0.1) return 1;
  return 0;
}

export function buildCategoryProgress(
  category: string,
  spots: Spot[],
  cards: TrainerCard[],
  sessions: SessionAnswer[],
  now = Date.now()
): CategoryProgress {
  const spotIds = new Set(spots.map((spot) => spot.id));
  const categoryCards = cards.filter((card) => spotIds.has(card.spotId));
  const recentFrom = now - 7 * 24 * 60 * 60 * 1000;
  const recentSessions = sessions.filter(
    (session) => spotIds.has(session.spotId) && session.timestamp >= recentFrom
  );
  const correctRecent = recentSessions.filter((session) => session.isCorrect).length;
  const recentAccuracy = recentSessions.length > 0 ? correctRecent / recentSessions.length : 0;

  const progress: CategoryProgress = {
    category,
    level: 0,
    totalCards: categoryCards.length,
    masteredCards: categoryCards.filter((card) => card.memory.phase === 'mastered').length,
    reviewCards: categoryCards.filter((card) => card.memory.phase === 'review').length,
    learningCards: categoryCards.filter(
      (card) => card.memory.phase === 'learning' || card.memory.phase === 'relearning'
    ).length,
    newCards: categoryCards.filter((card) => card.memory.phase === 'new').length,
    recentAccuracy,
  };

  progress.level = calculateLevel(progress) as CategoryProgress['level'];
  return progress;
}
