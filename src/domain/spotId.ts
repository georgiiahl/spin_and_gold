import { GameFormat, HistoryEntry } from './types';

/**
 * Generate a deterministic spot ID from parameters.
 * Examples:
 *   3max_20bb_btn_rfi
 *   hu_10bb_sb_open
 *   3max_12bb_btn_open_sb_3bet_btn_decision
 */
export function generateSpotId(
  format: GameFormat,
  stackBb: number,
  actingPosition: string,
  history: HistoryEntry[]
): string {
  const parts: string[] = [
    format,
    `${stackBb}bb`,
    actingPosition.toLowerCase(),
  ];

  if (history.length === 0) {
    parts.push('rfi');
  } else {
    for (const entry of history) {
      parts.push(entry.position.toLowerCase());
      parts.push(entry.action.toLowerCase());
    }
    parts.push(actingPosition.toLowerCase());
    parts.push('decision');
  }

  return parts.join('_');
}
