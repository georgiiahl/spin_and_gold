import { Action, HandFrequencies, SpotRange, TrainerCard } from '@/domain/types';
import { isBorderHand } from '@/domain/border';

export type TrainableSettings = {
  includeTrashHandsInTraining: boolean;
  focusOnMixedHands: boolean;
  allowedHands?: Set<string>;
};

const FREQUENCY_EPSILON = 0.0001;

export const PURE_RAISE_OR_JAM_FOCUS_MULTIPLIER = 0.45;
export const NON_BORDER_TRASH_FOCUS_MULTIPLIER = 0.08;

export function getPureAction(frequencies: HandFrequencies): Action | null {
  const actions: Action[] = ['fold', 'call', 'raise', 'jam'];
  for (const action of actions) {
    const isPureForAction = Math.abs(frequencies[action] - 1) < FREQUENCY_EPSILON;
    if (!isPureForAction) continue;
    const others = actions.filter((candidate) => candidate !== action);
    if (others.every((candidate) => frequencies[candidate] <= FREQUENCY_EPSILON)) {
      return action;
    }
  }
  return null;
}

export function isPureFold(frequencies: HandFrequencies): boolean {
  return getPureAction(frequencies) === 'fold';
}

export function isPureRaiseOrJam(frequencies: HandFrequencies): boolean {
  const pureAction = getPureAction(frequencies);
  return pureAction === 'raise' || pureAction === 'jam';
}

export function filterTrainableCards(cards: TrainerCard[], settings: TrainableSettings): TrainerCard[] {
  return cards.filter((card) => isTrainableCard(card, settings));
}

export function isTrainableCard(card: TrainerCard, settings: TrainableSettings): boolean {
  if (settings.allowedHands && !settings.allowedHands.has(card.hand)) return false;
  const pureAction = getPureAction(card.frequencies);

  if (!settings.focusOnMixedHands) {
    if (settings.includeTrashHandsInTraining) return true;
    return pureAction !== 'fold';
  }

  if (!pureAction) return true;
  return pureAction !== 'call';
}

export function getFocusMixedPriorityMultiplier(card: TrainerCard, range?: SpotRange): number {
  const pureAction = getPureAction(card.frequencies);
  if (pureAction === 'raise' || pureAction === 'jam') return PURE_RAISE_OR_JAM_FOCUS_MULTIPLIER;
  if (pureAction === 'fold') {
    if (range && isBorderHand(card.hand, range)) return 1;
    return NON_BORDER_TRASH_FOCUS_MULTIPLIER;
  }
  return 1;
}
