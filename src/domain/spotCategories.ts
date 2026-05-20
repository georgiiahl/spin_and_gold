export const UNCATEGORIZED_SPOT_CATEGORY = 'Uncategorized';

export function normalizeSpotCategory(category?: string): string | undefined {
  const trimmed = category?.trim();
  return trimmed ? trimmed : undefined;
}

export function getSpotCategoryLabel(category?: string): string {
  return normalizeSpotCategory(category) ?? UNCATEGORIZED_SPOT_CATEGORY;
}

export function encodeSpotCategory(category?: string): string {
  return encodeURIComponent(getSpotCategoryLabel(category));
}

export function decodeSpotCategory(categoryParam?: string): string | undefined {
  return categoryParam ? decodeURIComponent(categoryParam) : undefined;
}
