import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import RangeMatrix from '@/components/RangeMatrix';
import { Action, HandFrequencies, Spot, SpotRange } from '@/domain/types';
import { getRange } from '@/storage/ranges';
import { getSpot } from '@/storage/spots';
import { ALL_HANDS, getHandPosition, HAND_MATRIX } from '@/domain/hands';

export default function StudyMode() {
  const { id } = useParams<{ id: string }>();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [range, setRange] = useState<SpotRange>({});
  const [selectedHand, setSelectedHand] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([getSpot(id), getRange(id)]).then(([loadedSpot, loadedRange]) => {
      setSpot(loadedSpot ?? null);
      setRange(loadedRange ?? {});
      if (loadedRange) {
        const first = ALL_HANDS.find((hand) => loadedRange[hand] && sumFrequencies(loadedRange[hand]) > 0);
        setSelectedHand(first ?? null);
      }
    });
  }, [id]);

  const borderHands = useMemo(() => findBorderHands(range), [range]);
  const selectedFreq = selectedHand ? range[selectedHand] : undefined;
  const selectedClass = selectedHand && selectedFreq ? classifyHand(selectedHand, selectedFreq, borderHands) : 'empty';

  if (!spot) {
    return <div className="text-gray-500">Loading...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-3">
        <h1 className="text-lg font-bold">Study Mode</h1>
        <div className="text-xs text-gray-500">{spot.title}</div>
      </div>

      <RangeMatrix
        range={range}
        onCellAction={() => {}}
        onCellClick={setSelectedHand}
        getCellClassName={(hand, freq) => {
          if (selectedHand === hand) return 'ring-2 ring-blue-300';
          if (!freq || sumFrequencies(freq) === 0) return '';
          if (borderHands.has(hand)) return 'ring-2 ring-yellow-300/80';
          return '';
        }}
        activeAction="fold"
        mode="frequency"
        readOnly
      />

      <div className="bg-white border border-gray-200 rounded-lg p-4 mt-4 text-sm">
        {selectedHand && selectedFreq ? (
          <>
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold">{selectedHand}</div>
              <span className="text-xs uppercase tracking-wide text-gray-500">{selectedClass}</span>
            </div>
            <div className="mt-2 space-y-1 text-gray-700">
              {(['fold', 'call', 'raise', 'jam'] as Action[]).map((action) => (
                <div key={action} className="flex items-center justify-between">
                  <span className="capitalize">{action}</span>
                  <span>{(selectedFreq[action] * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-gray-500">Tap a hand to inspect frequencies.</div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mt-3 text-xs text-gray-700 space-y-1">
        <div><span className="font-semibold">Pure:</span> only one action {'>'} 0.</div>
        <div><span className="font-semibold">Mixed:</span> two or more actions {'>'} 0.</div>
        <div><span className="font-semibold">Border:</span> neighbor hand has different primary action.</div>
      </div>

      <Link to="/spots" className="block mt-6 text-sm text-gray-500 hover:text-gray-900">
        ← Back to spots
      </Link>
    </div>
  );
}

function sumFrequencies(freq: HandFrequencies): number {
  return freq.fold + freq.call + freq.raise + freq.jam;
}

function getPrimaryAction(freq: HandFrequencies): Action {
  const actions: Action[] = ['fold', 'call', 'raise', 'jam'];
  return actions.reduce((best, action) => (freq[action] > freq[best] ? action : best), 'fold' as Action);
}

function classifyHand(hand: string, freq: HandFrequencies, borderHands: Set<string>): 'pure' | 'mixed' | 'border' | 'empty' {
  if (sumFrequencies(freq) === 0) return 'empty';
  if (borderHands.has(hand)) return 'border';
  const nonZeroCount = Object.values(freq).filter((value) => value > 0).length;
  if (nonZeroCount > 1) return 'mixed';
  return 'pure';
}

function findBorderHands(range: SpotRange): Set<string> {
  const borders = new Set<string>();
  for (const hand of ALL_HANDS) {
    const myFreq = range[hand];
    if (!myFreq || sumFrequencies(myFreq) === 0) continue;
    const pos = getHandPosition(hand);
    if (!pos) continue;
    const myAction = getPrimaryAction(myFreq);
    const neighbors = [
      [pos.row - 1, pos.col],
      [pos.row + 1, pos.col],
      [pos.row, pos.col - 1],
      [pos.row, pos.col + 1],
    ];
    for (const [row, col] of neighbors) {
      if (row < 0 || row > 12 || col < 0 || col > 12) continue;
      const neighborHand = HAND_MATRIX[row][col];
      const neighborFreq = range[neighborHand];
      if (!neighborFreq || sumFrequencies(neighborFreq) === 0) continue;
      if (getPrimaryAction(neighborFreq) !== myAction) {
        borders.add(hand);
        break;
      }
    }
  }
  return borders;
}
