import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from 'react';
import ReviewHand, { ReviewHandResult } from '@/components/ReviewHand';
import ReviewSummary from '@/components/ReviewSummary';
import { parseGgHandHistories } from '@/domain/hhParser';
import { buildHandVerdict } from '@/domain/hhReview';
import { MatchedSpot, matchHandToSpot } from '@/domain/hhSpotMatcher';
import { Spot, SpotRange } from '@/domain/types';
import { StoredHandHistory, clearStoredHands, getStoredHands, saveImportedHands } from '@/storage/hhStore';
import { getAllRanges } from '@/storage/ranges';
import { getAllSpots } from '@/storage/spots';

type ReviewMode = 'list' | 'review' | 'summary';

type ReviewReadyHand = {
  recordId: string;
  parsed: StoredHandHistory['hand'];
  matched: MatchedSpot;
};

export default function ReviewPage() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [rangesBySpot, setRangesBySpot] = useState<Map<string, SpotRange>>(new Map());
  const [storedHands, setStoredHands] = useState<StoredHandHistory[]>([]);
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState<ReviewMode>('list');
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<ReviewHandResult[]>([]);

  const [positionFilter, setPositionFilter] = useState<'all' | 'BTN' | 'SB' | 'BB'>('all');
  const [spotTypeFilter, setSpotTypeFilter] = useState<'all' | 'open' | 'vs_open' | 'vs_3bet' | 'vs_jam'>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | '3max' | 'hu'>('all');

  useEffect(() => {
    Promise.all([getAllSpots(), getAllRanges(), getStoredHands()]).then(([loadedSpots, loadedRanges, storedHands]) => {
      setSpots(loadedSpots);
      setRangesBySpot(new Map(loadedRanges.map((entry) => [entry.spotId, entry.range])));
      setStoredHands(storedHands);
    });
  }, []);

  const matchedHands = useMemo<ReviewReadyHand[]>(
    () => storedHands.map((entry) => ({
      recordId: entry.id,
      parsed: entry.hand,
      matched: matchHandToSpot(entry.hand, spots),
    })),
    [storedHands, spots]
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
  const currentRange = useMemo(
    () => (current?.matched.matchedSpotId ? rangesBySpot.get(current.matched.matchedSpotId) : undefined),
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
    setStoredHands(stored);
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

  function handleNext(result: ReviewHandResult) {
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
    setStoredHands([]);
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
        key={current.recordId}
        matched={current.matched}
        verdict={currentVerdict}
        rangeForSpot={currentRange}
        index={index}
        total={filteredHands.length}
        onNext={handleNext}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
        <h1 className="text-xl font-bold text-slate-100">Review Mode</h1>
        <p className="mt-1 text-sm text-slate-400">
          Import hand history .txt files and review your preflop decisions.
        </p>
      </div>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        className="rounded-lg border border-dashed border-slate-600 bg-slate-800/60 p-4"
      >
        <div className="space-y-2">
          <p className="text-sm text-slate-300">Drop .txt files here or select files manually.</p>
          <input
            type="file"
            accept=".txt,text/plain"
            multiple
            onChange={handleFileChange}
            className="block text-sm text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-amber-500 file:px-3 file:py-2 file:text-slate-950 hover:file:bg-amber-400"
          />
          <button
            type="button"
            onClick={handleClearImported}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700"
          >
            Clear imported hands
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
        <h2 className="font-semibold text-slate-100">Filters</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <select
            value={positionFilter}
            onChange={(event) => setPositionFilter(event.target.value as typeof positionFilter)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-sm text-slate-200"
          >
            <option value="all">All positions</option>
            <option value="BTN">BTN</option>
            <option value="SB">SB</option>
            <option value="BB">BB</option>
          </select>
          <select
            value={spotTypeFilter}
            onChange={(event) => setSpotTypeFilter(event.target.value as typeof spotTypeFilter)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-sm text-slate-200"
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
            className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-sm text-slate-200"
          >
            <option value="all">All formats</option>
            <option value="3max">3-max</option>
            <option value="hu">HU</option>
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-slate-100">Parsed hands</h2>
          <span className="text-sm text-slate-400">{filteredHands.length}</span>
        </div>
        {filteredHands.length === 0 ? (
          <p className="text-sm text-slate-400">No hands to review yet.</p>
        ) : (
          <div className="max-h-72 space-y-2 overflow-auto">
            {filteredHands.map(({ recordId, parsed, matched }) => (
              <div key={recordId} className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-sm text-slate-200">
                <div>#{parsed.handId} · {matched.actingPosition} · {matched.spotType} · {matched.effectiveStackBb}bb</div>
                <div className="text-xs text-slate-400">
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
          className="mt-3 w-full rounded-lg bg-amber-500 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-40"
        >
          Start Review
        </button>
      </div>

      {status && <p className="text-sm text-slate-300">{status}</p>}
    </div>
  );
}