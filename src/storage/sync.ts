import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { FullExportPayload } from '@/storage/importExport';

const SYNC_PREFIX = '#sync=';

export function encodeSyncPayload(data: FullExportPayload, origin: string): string {
  const serialized = JSON.stringify(data);
  const compressed = compressToEncodedURIComponent(serialized);
  return `${origin}/#sync=${compressed}`;
}

export function decodeSyncPayload(hash: string): FullExportPayload | null {
  if (!hash.startsWith(SYNC_PREFIX)) return null;
  const compressed = hash.slice(SYNC_PREFIX.length);
  if (!compressed) return null;
  const json = decompressFromEncodedURIComponent(compressed);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as FullExportPayload;
    const data = parsed?.data;
    if (
      parsed?.version !== 1 ||
      parsed?.type !== 'full' ||
      !data ||
      !Array.isArray(data.spots) ||
      !Array.isArray(data.ranges) ||
      !Array.isArray(data.cards) ||
      !Array.isArray(data.sessions)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
