import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from 'react';
import { summarizeChipEv } from '@/domain/chipEv';
import { StoredChipEvHandResult, clearStoredChipEvHands, getStoredChipEvHands } from '@/storage/chipEvStore';
import { importHandHistoryText } from '@/storage/handHistoryImport';

type GraphMode = 'tournament' | 'import';
type FormatFilter = 'all' | '3max' | 'hu';
type PositionFilter = 'all' | 'BTN' | 'SB' | 'BB';

type GraphPoint = {
  label: string;
  cumulativeChips: number;
  cevPerTournament: number;
};

export default function ChipEvStats() {
  const [results, setResults] = useState<StoredChipEvHandResult[]>([]);
  const [status, setStatus] = useState('');
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [graphMode, setGraphMode] = useState<GraphMode>('tournament');

  useEffect(() => {
    getStoredChipEvHands().then(setResults);
  }, []);

  const filteredResults = useMemo(
    () => results.filter((result) => {
      if (formatFilter !== 'all' && result.format !== formatFilter) return false;
      if (positionFilter !== 'all' && result.heroPosition !== positionFilter) return false;

      const handDate = getFilterDate(result);
      if (startDate && handDate < startDate) return false;
      if (endDate && handDate > endDate) return false;
      return true;
    }),
    [results, formatFilter, positionFilter, startDate, endDate]
  );

  const summary = useMemo(() => summarizeChipEv(filteredResults), [filteredResults]);
  const chipEvBbPerTournament = useMemo(() => {
    if (summary.totalTournaments === 0) return 0;
    const totalBb = filteredResults.reduce(
      (sum, result) => sum + (result.bbSize > 0 ? result.netChipsAdjusted / result.bbSize : 0),
      0
    );
    return roundNumber(totalBb / summary.totalTournaments);
  }, [filteredResults, summary.totalTournaments]);

  const chartPoints = useMemo(() => buildGraphPoints(filteredResults, graphMode), [filteredResults, graphMode]);
  const positionBreakdown = useMemo(() => buildPositionBreakdown(filteredResults), [filteredResults]);
  const lastPoint = chartPoints[chartPoints.length - 1];

  async function refreshResults(nextStatus?: string) {
    const stored = await getStoredChipEvHands();
    setResults(stored);
    if (nextStatus) setStatus(nextStatus);
  }

  async function importFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setStatus('Importing...');

    let imported = 0;
    for (const file of Array.from(fileList)) {
      if (!file.name.toLowerCase().endsWith('.txt')) continue;
      imported += await importHandHistoryText(file.name, await file.text());
    }

    await refreshResults(imported > 0 ? `Imported ${imported} hand(s).` : 'No valid hands found.');
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    await importFiles(event.dataTransfer.files);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    await importFiles(event.target.files);
    event.target.value = '';
  }

  async function handleClear() {
    await clearStoredChipEvHands();
    await refreshResults('ChipEV results cleared.');
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h1 className="text-xl font-bold">ChipEV Stats</h1>
        <p className="mt-1 text-sm text-gray-500">
          Import PokerCraft / GGPoker hand histories to track adjusted chip EV per tournament and bb/100.
        </p>
      </div>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        className="rounded-lg border border-dashed border-gray-300 bg-white p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold">Import hand histories</div>
            <div className="text-sm text-gray-500">Drop .txt files here or select them manually.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="file"
              accept=".txt,text/plain"
              multiple
              onChange={handleFileChange}
              className="block text-sm text-gray-700 file:mr-2 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-white hover:file:bg-blue-500"
            />
            <button
              type="button"
              onClick={handleClear}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Clear ChipEV data
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <select
            value={formatFilter}
            onChange={(event) => setFormatFilter(event.target.value as FormatFilter)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
          >
            <option value="all">All formats</option>
            <option value="3max">3-max</option>
            <option value="hu">HU</option>
          </select>
          <select
            value={positionFilter}
            onChange={(event) => setPositionFilter(event.target.value as PositionFilter)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
          >
            <option value="all">All positions</option>
            <option value="BTN">BTN</option>
            <option value="SB">SB</option>
            <option value="BB">BB</option>
          </select>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
          />
          <select
            value={graphMode}
            onChange={(event) => setGraphMode(event.target.value as GraphMode)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
          >
            <option value="tournament">Graph by tournament</option>
            <option value="import">Graph by import</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="ChipEV / tournament" value={`${formatSigned(summary.chipEvPerTournament)} chips`} />
        <MetricCard label="ChipEV / tournament" value={`${formatSigned(chipEvBbPerTournament)} bb`} />
        <MetricCard label="ChipEV bb/100" value={formatSigned(summary.chipEvBbPer100)} />
        <MetricCard
          label="Hands / tournaments"
          value={`${summary.totalHands} / ${summary.totalTournaments}`}
          subValue={`${summary.adjustedHands} adjusted · ${summary.allInHandsCount} all-in hands`}
        />
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">ChipEV graph</h2>
            <div className="text-sm text-gray-500">Cumulative adjusted chips and cEV/t over time.</div>
          </div>
          <div className="text-sm text-gray-500">{chartPoints.length} points</div>
        </div>
        {chartPoints.length === 0 ? (
          <div className="text-sm text-gray-500">Import hands to populate the graph.</div>
        ) : (
          <div className="space-y-4">
            <LineChart points={chartPoints} />
            <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-3">
              <div>Last cumulative chips: {formatSigned(lastPoint?.cumulativeChips ?? 0)}</div>
              <div>Last cEV/t: {formatSigned(lastPoint?.cevPerTournament ?? 0)}</div>
              <div>Mode: {graphMode === 'tournament' ? 'Tournament' : 'Import session'}</div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Position breakdown</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {positionBreakdown.map((item) => (
            <div key={item.position} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <div className="font-medium">{item.position}</div>
              <div className="mt-1 text-gray-600">{item.hands} hands · {item.tournaments} tournaments</div>
              <div className="mt-2 text-lg font-semibold">{formatSigned(item.chipEvPerTournament)} cEV/t</div>
              <div className="text-gray-600">{formatSigned(item.bbPer100)} bb/100</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Imported hands</h2>
          <span className="text-sm text-gray-500">{filteredResults.length}</span>
        </div>
        {filteredResults.length === 0 ? (
          <div className="text-sm text-gray-500">No ChipEV hands match the current filters.</div>
        ) : (
          <div className="max-h-80 space-y-2 overflow-auto">
            {filteredResults.map((result) => (
              <div key={result.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">
                    #{result.handId} · T{result.tournamentId || '—'} · {result.heroPosition || '—'} · {result.format}
                  </div>
                  <div className={result.netChipsAdjusted >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {formatSigned(result.netChipsAdjusted)} chips
                  </div>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Actual {formatSigned(result.netChipsActual)} · {result.isAllInAdjusted ? 'all-in adjusted' : 'actual result used'}
                  {' '}· {result.sourceFile}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {status && <p className="text-sm text-gray-600">{status}</p>}
    </div>
  );
}

function MetricCard({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {subValue && <div className="mt-1 text-sm text-gray-500">{subValue}</div>}
    </div>
  );
}

function LineChart({ points }: { points: GraphPoint[] }) {
  const width = 800;
  const height = 240;
  const padding = 24;
  const values = points.map((point) => point.cumulativeChips);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 0);
  const range = Math.max(1, maxValue - minValue);

  const path = points.map((point, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(1, points.length - 1);
    const y = height - padding - ((point.cumulativeChips - minValue) / range) * (height - padding * 2);
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');

  const zeroY = height - padding - ((0 - minValue) / range) * (height - padding * 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-60 w-full rounded-lg bg-gray-50">
      <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} stroke="#CBD5E1" strokeDasharray="4 4" />
      <path d={path} fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function buildGraphPoints(results: StoredChipEvHandResult[], graphMode: GraphMode): GraphPoint[] {
  if (results.length === 0) return [];

  const groups = new Map<string, {
    label: string;
    chips: number;
    timestamp: number;
    tournaments: Set<string>;
  }>();

  for (const result of results) {
    const key = graphMode === 'tournament'
      ? result.tournamentId || result.id
      : `${result.importedAt}:${result.sourceFile}`;
    const current = groups.get(key) ?? {
      label: graphMode === 'tournament' ? `T${result.tournamentId || '—'}` : result.sourceFile,
      chips: 0,
      timestamp: getSortTimestamp(result),
      tournaments: new Set<string>(),
    };
    current.chips += result.netChipsAdjusted;
    current.timestamp = Math.min(current.timestamp, getSortTimestamp(result));
    if (result.tournamentId) current.tournaments.add(result.tournamentId);
    groups.set(key, current);
  }

  let cumulative = 0;
  let cumulativeTournaments = 0;
  return [...groups.values()]
    .sort((left, right) => left.timestamp - right.timestamp)
    .map((group) => {
      cumulative += group.chips;
      cumulativeTournaments += Math.max(1, group.tournaments.size);
      return {
        label: group.label,
        cumulativeChips: roundNumber(cumulative),
        cevPerTournament: cumulativeTournaments > 0 ? roundNumber(cumulative / cumulativeTournaments) : 0,
      };
    });
}

function buildPositionBreakdown(results: StoredChipEvHandResult[]) {
  return (['BTN', 'SB', 'BB'] as const).map((position) => {
    const items = results.filter((result) => result.heroPosition === position);
    const summary = summarizeChipEv(items);
    return {
      position,
      hands: items.length,
      tournaments: summary.totalTournaments,
      chipEvPerTournament: summary.chipEvPerTournament,
      bbPer100: calculateBbPer100(items),
    };
  });
}

function getFilterDate(result: StoredChipEvHandResult): string {
  const timestamp = parseTimestamp(result.timestamp);
  return timestamp ? new Date(timestamp).toISOString().slice(0, 10) : new Date(result.importedAt).toISOString().slice(0, 10);
}

function getSortTimestamp(result: StoredChipEvHandResult): number {
  return parseTimestamp(result.timestamp) ?? result.importedAt;
}

function parseTimestamp(value: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value.replace(/\//g, '-').replace(' ', 'T'));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatSigned(value: number): string {
  const rounded = roundNumber(value);
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

function roundNumber(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateBbPer100(results: StoredChipEvHandResult[]): number {
  if (results.length === 0) return 0;
  const totalBb = results.reduce((sum, result) => sum + (result.bbSize > 0 ? result.netChipsAdjusted / result.bbSize : 0), 0);
  return roundNumber((totalBb / results.length) * 100);
}
