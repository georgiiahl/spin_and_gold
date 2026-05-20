// 13 ranks high to low
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

export type Rank = (typeof RANKS)[number];

/**
 * Generate the 13x13 matrix of canonical hand names.
 * Row = first rank, Col = second rank.
 * Upper-left triangle (col > row) = suited
 * Lower-left triangle (row > col) = offsuit
 * Diagonal = pairs
 */
export function generateHandMatrix(): string[][] {
  const matrix: string[][] = [];
  for (let r = 0; r < 13; r++) {
    const row: string[] = [];
    for (let c = 0; c < 13; c++) {
      if (r === c) {
        row.push(`${RANKS[r]}${RANKS[c]}`);
      } else if (c > r) {
        row.push(`${RANKS[r]}${RANKS[c]}s`);
      } else {
        row.push(`${RANKS[c]}${RANKS[r]}o`);
      }
    }
    matrix.push(row);
  }
  return matrix;
}

/** Flat list of all 169 canonical hands (matrix order, row by row) */
export const HAND_MATRIX = generateHandMatrix();
export const ALL_HANDS: string[] = HAND_MATRIX.flat();

/** Validate a hand key */
export function isValidHand(hand: string): boolean {
  return ALL_HANDS.includes(hand);
}

/** Get row/col index for a hand in the matrix */
export function getHandPosition(hand: string): { row: number; col: number } | null {
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      if (HAND_MATRIX[r][c] === hand) return { row: r, col: c };
    }
  }
  return null;
}
