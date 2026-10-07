/** Générateur pseudo-aléatoire à graine fixe (mulberry32) pour des données de démo reproductibles. */
export function createRandom(seed: number) {
  let state = seed;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  function pick<T>(items: readonly T[]): T {
    const item = items[Math.floor(next() * items.length)];
    if (item === undefined) {
      throw new Error('Liste vide');
    }
    return item;
  }
  function weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let threshold = next() * total;
    for (const [value, weight] of entries) {
      threshold -= weight;
      if (threshold <= 0) {
        return value;
      }
    }
    return pick(entries)[0];
  }
  return { next, int, pick, weighted, chance: (probability: number) => next() < probability };
}

export type Random = ReturnType<typeof createRandom>;
