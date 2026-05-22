import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from 'react';
import ReviewHand from '@/components/ReviewHand';
import ReviewSummary, { ReviewSummaryItem } from '@/components/ReviewSummary';
import { ParsedHand, parseGgHandHistories } from '@/domain/hhParser';
import { buildHandVerdict } from '@/domain/hhReview';
import { MatchedSpot, matchHandToSpot } from '@/domain/hhSpotMatcher';
import { Spot, SpotRange } from '@/domain/types';
import { buildStoredHandId, clearStoredHands, getStoredHands, saveImportedHands } from '@/storage/hhStore';
import { getAllRanges } from '@/storage/ranges';
import { getAllSpots } from '@/storage/spots';

type ReviewMode = 'list' | 'review' | 'summary';

type ReviewReadyHand = {
  parsed: ParsedHand;
  matched: MatchedSpot;
};

export default function ReviewPage() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [rangesBySpot, setRangesBySpot] = useState<Map<string, SpotRange>>(new Map());
  const [hands, setHands] = useState<ParsedHand[]>([]);
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState<ReviewMode>('list');
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<ReviewSummaryItem[]>([]);

  const [positionFilter, setPositionFilter] = useState<'all' | 'BTN' | 'SB' | 'BB'>('all');
  const [spotTypeFilter, setSpotTypeFilter] = useState<'all' | 'open' | 'vs_open' | 'vs_3bet' | 'vs_jam'>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | '3max' | 'hu'>('all');

  useEffect(() => {
    Promise.all([getAllSpots(), getAllRanges(), getStoredHands()]).then(([loadedSpots, loadedRanges, storedHands]) => {
      setSpots(loadedSpots);
      setRangesBySpot(new Map(loadedRanges.map((entry) => [entry.spotId, entry.range])));
      setHands(storedHands.map((entry) => entry.hand));
    });
  }, []);

  const matchedHands = useMemo<ReviewReadyHand[]>(
    () => hands.map((hand) => ({ parsed: hand, matched: matchHandToSpot(hand, spots) })),
    [hands, spots]
  );

  const filteredHands = useMemo(
    () => matchedHands.filter(({ matched }) => {
      if (positionFilter !== 'all' && matched.actingPosition !== positionFilter) return false;
      if (spotTypeFilter !== 'all' && matched.spotType !== spotTypeFilter) return false;
      if (formatFilter !== 'all' && matched.hand.format !== formatFilter) return false;
      return true;
    }),
    [matchedHands, positionFilter, spotTypeFilter, formatFilter]
  );

  const current = filteredHands[index] ?? null;
  const currentVerdict = useMemo(
    () => (current ? buildHandVerdict(current.matched, rangesBySpot) : null),
    [current, rangesBySpot]
  );

  async function importFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setStatus('Importing...');

    let imported = 0;
    for (const file of Array.from(fileList)) {
      if (!file.name.toLowerCase().endsWith('.txt')) continue;
      const raw = await file.text();
      const parsed = parseGgHandHistories(raw);
      if (parsed.length === 0) continue;
      await saveImportedHands(file.name, parsed);
      imported += parsed.length;
    }

    const stored = await getStoredHands();
    setHands(stored.map((entry) => entry.hand));
    setStatus(imported > 0 ? `Imported ${imported} hand(s).` : 'No valid hands found.');
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    await importFiles(event.target.files);
    event.target.value = '';
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    await importFiles(event.dataTransfer.files);
  }

  function startReview() {
    setResults([]);
    setIndex(0);
    setMode('review');
  }

  function handleNext(result: ReviewSummaryItem) {
    const nextResults = [...results, result];
    setResults(nextResults);
    const nextIndex = index + 1;
    if (nextIndex >= filteredHands.length) {
      setMode('summary');
      return;
    }
    setIndex(nextIndex);
  }

  async function handleClearImported() {
    await clearStoredHands();
    setHands([]);
    setStatus('Imported hands cleared.');
    setMode('list');
    setIndex(0);
    setResults([]);
  }

  if (mode === 'summary') {
    return <ReviewSummary items={results} onRestart={() => setMode('list')} />;
  }

  if (mode === 'review' && current) {
    return (
      <ReviewHand
        matched={current.matched}
        verdict={currentVerdict}
        onNext={handleNext}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h1 className="text-xl font-bold">Review Mode</h1>
        <p className="mt-1 text-sm text-gray-500">
          Import GG Poker hand history .txt files and review preflop decisions.
        </p>
      </div>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        className="rounded-lg border border-dashed border-gray-300 bg-white p-4"
      >
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Drop .txt files here or select files manually.</p>
          <input
            type="file"
            accept=".txt,text/plain"
            multiple
            onChange={handleFileChange}
            className="block text-sm text-gray-700 file:mr-2 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-white hover:file:bg-blue-500"
          />
          <button
            type="button"
            onClick={handleClearImported}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Clear imported hands
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="font-semibold">Filters</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <select
            value={positionFilter}
            onChange={(event) => setPositionFilter(event.target.value as typeof positionFilter)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-sm"
          >
            <option value="all">All positions</option>
            <option value="BTN">BTN</option>
            <option value="SB">SB</option>
            <option value="BB">BB</option>
          </select>
          <select
            value={spotTypeFilter}
            onChange={(event) => setSpotTypeFilter(event.target.value as typeof spotTypeFilter)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-sm"
          >
            <option value="all">All spot types</option>
            <option value="open">Open</option>
            <option value="vs_open">Vs open</option>
            <option value="vs_3bet">Vs 3bet</option>
            <option value="vs_jam">Vs jam</option>
          </select>
          <select
            value={formatFilter}
            onChange={(event) => setFormatFilter(event.target.value as typeof formatFilter)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-sm"
          >
            <option value="all">All formats</option>
            <option value="3max">3-max</option>
            <option value="hu">HU</option>
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Parsed hands</h2>
          <span className="text-sm text-gray-500">{filteredHands.length}</span>
        </div>
        {filteredHands.length === 0 ? (
          <p className="text-sm text-gray-500">No hands to review yet.</p>
        ) : (
          <div className="max-h-72 space-y-2 overflow-auto">
            {filteredHands.map(({ parsed, matched }) => (
              <div key={buildStoredHandId(parsed, 'review-list')} className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm text-gray-700">
                <div>#{parsed.handId} · {matched.actingPosition} · {matched.spotType} · {matched.effectiveStackBb}bb</div>
                <div className="text-xs text-gray-500">
                  {matched.matchedSpotId ? `Matched spot: ${matched.matchedSpotId}` : 'No matching spot'}
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={startReview}
          disabled={filteredHands.length === 0}
          className="mt-3 w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
        >
          Start Review
        </button>
      </div>

      {status && <p className="text-sm text-gray-600">{status}</p>}
    </div>
  );
}
