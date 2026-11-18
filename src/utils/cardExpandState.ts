export type ExpandedCardMap = Record<string, boolean>;

/**
 * Toggles the expand/shrink state for a single card ID while preserving all other cards.
 */
export function toggleCardExpanded(map: ExpandedCardMap, id: string): ExpandedCardMap {
  if (!id) return map;
  const nextExpanded = !Boolean(map[id]);
  if (!nextExpanded) {
    const { [id]: _removed, ...rest } = map;
    return rest;
  }
  return {
    ...map,
    [id]: true,
  };
}

/**
 * Returns true only when `ids` is non-empty and every visible card ID is expanded.
 */
export function areAllCardsExpanded(map: ExpandedCardMap, ids: readonly string[]): boolean {
  if (ids.length === 0) return false;
  return ids.every((id) => Boolean(map[id]));
}

/**
 * Expands all visible cards if any are currently shrunk; shrinks all visible cards
 * if every visible card is already expanded. Preserves state for off-filter IDs.
 */
export function toggleAllCardsExpanded(
  map: ExpandedCardMap,
  ids: readonly string[]
): ExpandedCardMap {
  if (ids.length === 0) return map;
  const shouldShrink = areAllCardsExpanded(map, ids);
  const next: ExpandedCardMap = { ...map };
  if (shouldShrink) {
    for (const id of ids) {
      delete next[id];
    }
  } else {
    for (const id of ids) {
      next[id] = true;
    }
  }
  return next;
}
