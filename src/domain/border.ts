import { HAND_MATRIX, getHandPosition } from '@/domain/hands';
import { Action, HandFrequencies, SpotRange } from '@/domain/types';

const ACTIONS: Action[] = ['fold', 'call', 'raise', 'jam'];

function totalFrequency(freq: HandFrequencies): number {
  return freq.fold + freq.call + freq.raise + freq.jam;
}

function getPrimaryAction(freq: HandFrequencies): Action {
  return ACTIONS.reduce((best, action) => (freq[action] > freq[best] ? action : best), 'fold' as Action);
}

export function isBorderHand(hand: string, range: SpotRange): boolean {
  const freq = range[hand];
  if (!freq || totalFrequency(freq) === 0) return false;

  const position = getHandPosition(hand);
  if (!position) return false;

  const myPrimaryAction = getPrimaryAction(freq);
  const neighbors: Array<[number, number]> = [
    [position.row - 1, position.col],
    [position.row + 1, position.col],
    [position.row, position.col - 1],
    [position.row, position.col + 1],
  ];

  for (const [row, col] of neighbors) {
    if (row < 0 || row >= 13 || col < 0 || col >= 13) continue;
    const neighborHand = HAND_MATRIX[row][col];
    const neighborFrequencies = range[neighborHand];
    if (!neighborFrequencies || totalFrequency(neighborFrequencies) === 0) continue;
    if (getPrimaryAction(neighborFrequencies) !== myPrimaryAction) {
      return true;
    }
  }

  return false;
}
