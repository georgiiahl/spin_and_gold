import { parseGgHandHistories } from '@/domain/hhParser';
import { saveChipEvHands, clearStoredChipEvHands } from '@/storage/chipEvStore';
import { clearStoredHands, saveImportedHands } from '@/storage/hhStore';

export async function importHandHistoryText(sourceFile: string, rawText: string): Promise<number> {
  const parsedHands = parseGgHandHistories(rawText);
  if (parsedHands.length === 0) return 0;

  await saveImportedHands(sourceFile, parsedHands);
  await saveChipEvHands(sourceFile, parsedHands);
  return parsedHands.length;
}

export async function clearImportedHandHistoryData(): Promise<void> {
  await Promise.all([clearStoredHands(), clearStoredChipEvHands()]);
}
