type Suit = 'S' | 'H' | 'D' | 'C';

type Card = {
  rank: number;
  suit: Suit;
  raw: string;
};

type HandScore = [number, number, number, number, number, number];

const RANKS = '23456789TJQKA';
const SUITS = new Set<Suit>(['S', 'H', 'D', 'C']);
const DEFAULT_ITERATIONS = 5000;

export function calculateEquity(
  heroCards: [string, string],
  villainCards: [string, string],
  board: string[]
): number {
  const hero = heroCards.map(parseCard);
  const villain = villainCards.map(parseCard);
  const knownBoard = board.map(parseCard);
  const knownCards = [...hero, ...villain, ...knownBoard];

  if (knownCards.some((card) => card === null)) {
    return 0;
  }

  const parsedHero = hero as Card[];
  const parsedVillain = villain as Card[];
  const parsedBoard = knownBoard as Card[];
  const cards = knownCards as Card[];
  const uniqueCards = new Set(cards.map((card) => card.raw));
  if (uniqueCards.size !== cards.length || parsedBoard.length > 5) {
    return 0;
  }

  const remainingBoardCards = 5 - parsedBoard.length;
  const deck = buildDeck().filter((card) => !uniqueCards.has(card.raw));
  const iterations = remainingBoardCards === 0 ? 1 : DEFAULT_ITERATIONS;
  const rng = createSeededRandom([...heroCards, ...villainCards, ...board].join('-'));
  let total = 0;

  for (let index = 0; index < iterations; index += 1) {
    const simulatedBoard = parsedBoard.length === 5
      ? parsedBoard
      : [...parsedBoard, ...drawRandomCards(deck, remainingBoardCards, rng)];
    const heroScore = evaluateBestOfSeven([...parsedHero, ...simulatedBoard]);
    const villainScore = evaluateBestOfSeven([...parsedVillain, ...simulatedBoard]);
    const comparison = compareScores(heroScore, villainScore);

    if (comparison > 0) {
      total += 1;
    } else if (comparison === 0) {
      total += 0.5;
    }
  }

  return total / iterations;
}

function buildDeck(): Card[] {
  const cards: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      cards.push(parseCard(`${rank}${suit}`)!);
    }
  }
  return cards;
}

function parseCard(value: string): Card | null {
  const match = value.trim().toUpperCase().match(/^([2-9TJQKA])([SHDC])$/);
  if (!match || !SUITS.has(match[2] as Suit)) return null;
  return {
    rank: RANKS.indexOf(match[1]) + 2,
    suit: match[2] as Suit,
    raw: `${match[1]}${match[2]}`,
  };
}

function drawRandomCards(deck: Card[], count: number, rng: () => number): Card[] {
  const available = [...deck];
  const cards: Card[] = [];

  for (let index = 0; index < count; index += 1) {
    const pickIndex = Math.floor(rng() * available.length);
    cards.push(available[pickIndex]);
    available.splice(pickIndex, 1);
  }

  return cards;
}

function evaluateBestOfSeven(cards: Card[]): HandScore {
  let best: HandScore | null = null;

  for (let first = 0; first < cards.length - 4; first += 1) {
    for (let second = first + 1; second < cards.length - 3; second += 1) {
      for (let third = second + 1; third < cards.length - 2; third += 1) {
        for (let fourth = third + 1; fourth < cards.length - 1; fourth += 1) {
          for (let fifth = fourth + 1; fifth < cards.length; fifth += 1) {
            const score = evaluateFiveCardHand([
              cards[first],
              cards[second],
              cards[third],
              cards[fourth],
              cards[fifth],
            ]);
            if (!best || compareScores(score, best) > 0) {
              best = score;
            }
          }
        }
      }
    }
  }

  return best ?? [0, 0, 0, 0, 0, 0];
}

function evaluateFiveCardHand(cards: Card[]): HandScore {
  const ranks = cards.map((card) => card.rank).sort((left, right) => right - left);
  const isFlush = cards.every((card) => card.suit === cards[0].suit);
  const straightHigh = getStraightHigh(ranks);
  const counts = buildRankCounts(ranks);

  if (isFlush && straightHigh > 0) return [8, straightHigh, 0, 0, 0, 0];

  if (counts[0][1] === 4) {
    return [7, counts[0][0], counts[1][0], 0, 0, 0];
  }

  if (counts[0][1] === 3 && counts[1][1] === 2) {
    return [6, counts[0][0], counts[1][0], 0, 0, 0];
  }

  if (isFlush) {
    return [5, ranks[0], ranks[1], ranks[2], ranks[3], ranks[4]];
  }

  if (straightHigh > 0) {
    return [4, straightHigh, 0, 0, 0, 0];
  }

  if (counts[0][1] === 3) {
    const kickers = counts.slice(1).map(([rank]) => rank).sort((left, right) => right - left);
    return [3, counts[0][0], kickers[0] ?? 0, kickers[1] ?? 0, 0, 0];
  }

  if (counts[0][1] === 2 && counts[1][1] === 2) {
    const pairs = [counts[0][0], counts[1][0]].sort((left, right) => right - left);
    const kicker = counts[2]?.[0] ?? 0;
    return [2, pairs[0], pairs[1], kicker, 0, 0];
  }

  if (counts[0][1] === 2) {
    const kickers = counts.slice(1).map(([rank]) => rank).sort((left, right) => right - left);
    return [1, counts[0][0], kickers[0] ?? 0, kickers[1] ?? 0, kickers[2] ?? 0, 0];
  }

  return [0, ranks[0], ranks[1], ranks[2], ranks[3], ranks[4]];
}

function buildRankCounts(ranks: number[]): Array<[number, number]> {
  const counts = new Map<number, number>();
  for (const rank of ranks) {
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }

  return [...counts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return right[0] - left[0];
  });
}

function getStraightHigh(ranks: number[]): number {
  const unique = [...new Set(ranks)].sort((left, right) => right - left);
  if (unique[0] === 14) unique.push(1);

  let run = 1;
  for (let index = 1; index < unique.length; index += 1) {
    if (unique[index - 1] - unique[index] === 1) {
      run += 1;
      if (run >= 5) {
        return unique[index - 4] === 14 && unique[index] === 1 ? 5 : unique[index - 4];
      }
    } else {
      run = 1;
    }
  }

  return 0;
}

function compareScores(left: HandScore, right: HandScore): number {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function createSeededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
