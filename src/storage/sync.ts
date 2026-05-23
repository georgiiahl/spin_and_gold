import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { FullExportPayload } from '@/storage/importExport';

const SYNC_PREFIX = '#sync=';

export function encodeSyncPayload(data: FullExportPayload): string {
  const serialized = JSON.stringify(data);
  const compressed = compressToEncodedURIComponent(serialized);
  return `${window.location.origin}/#sync=${compressed}`;
}

export function decodeSyncPayload(hash: string): FullExportPayload | null {
  if (!hash.startsWith(SYNC_PREFIX)) return null;
  const compressed = hash.slice(SYNC_PREFIX.length);
  if (!compressed) return null;
  const json = decompressFromEncodedURIComponent(compressed);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as FullExportPayload;
    if (parsed?.version !== 1 || parsed?.type !== 'full' || !parsed?.data) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
