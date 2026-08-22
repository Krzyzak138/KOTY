export const CATS = ['Angela', 'Basta'] as const;
export const MEALS = ['morning', 'snack', 'evening'] as const;
export const PEOPLE = ['Marek', 'Karolina', 'Albert', 'Laura'] as const;
export const CARE_ACTIVITIES = ['play', 'brushing', 'litter'] as const;

export type Cat = (typeof CATS)[number];
export type Meal = (typeof MEALS)[number];
export type Person = (typeof PEOPLE)[number];
export type CareActivity = (typeof CARE_ACTIVITIES)[number];

export type Feeding = {
  id: string;
  cat: Cat;
  meal: Meal;
  fedAt: string;
  fedBy: Person;
  localDate: string;
  batchId: string | null;
};

export type CareEvent = {
  id: string;
  activity: CareActivity;
  cat: Cat | null;
  doneAt: string;
  doneBy: Person;
  localDate: string;
};

export type HistoryEntry = {
  id: string;
  at: string;
  localDate: string;
  person: Person;
  title: string;
  icon: string;
};

export const MEAL_LABELS: Record<Meal, string> = {
  morning: 'Rano',
  snack: 'Przekąska',
  evening: 'Wieczór',
};

export const MEAL_ICONS: Record<Meal, string> = {
  morning: '🥫',
  snack: '🍪',
  evening: '🥡',
};

export const CARE_LABELS: Record<CareActivity, string> = {
  play: 'Zabawa',
  brushing: 'Szczotkowanie',
  litter: 'Kuweta',
};

export const CARE_ICONS: Record<CareActivity, string> = {
  play: '🧶',
  brushing: '🪮',
  litter: '🧹',
};

export function localDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Dzień aplikacji zmienia się o 02:00 czasu lokalnego. Dzięki temu czynności
 * wykonane po północy, ale przed snem, nadal należą do poprzedniego dnia.
 */
export function trackingDate(date = new Date(), resetHour = 2): string {
  const shifted = new Date(date);
  shifted.setHours(shifted.getHours() - resetHour);
  return localDate(shifted);
}

export function millisecondsUntilNextReset(date = new Date(), resetHour = 2): number {
  const next = new Date(date);
  next.setHours(resetHour, 0, 0, 0);
  if (next.getTime() <= date.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - date.getTime();
}

export function latestFor(
  feedings: Feeding[],
  date: string,
  cat: Cat,
  meal: Meal,
): Feeding | undefined {
  return feedings
    .filter((item) => item.localDate === date && item.cat === cat && item.meal === meal)
    .sort((a, b) => b.fedAt.localeCompare(a.fedAt))[0];
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function latestCareFor(
  events: CareEvent[],
  date: string,
  activity: CareActivity,
  cat: Cat | null,
): CareEvent | undefined {
  return events
    .filter((item) => item.localDate === date && item.activity === activity && item.cat === cat)
    .sort((a, b) => b.doneAt.localeCompare(a.doneAt))[0];
}

export function groupHistory(feedings: Feeding[]): Feeding[][] {
  const groups = new Map<string, Feeding[]>();
  [...feedings]
    .sort((a, b) => b.fedAt.localeCompare(a.fedAt))
    .forEach((feeding) => {
      const key = feeding.batchId ?? feeding.id;
      groups.set(key, [...(groups.get(key) ?? []), feeding]);
    });
  return [...groups.values()];
}

export function buildHistory(feedings: Feeding[], careEvents: CareEvent[]): HistoryEntry[] {
  const feedingEntries = groupHistory(feedings).flatMap((group) => {
    const first = group[0];
    if (!first) return [];
    return [{
      id: first.batchId ?? first.id,
      at: first.fedAt,
      localDate: first.localDate,
      person: first.fedBy,
      title: `${group.map((item) => item.cat).join(' + ')} · ${MEAL_LABELS[first.meal].toLowerCase()}`,
      icon: '🍽️',
    }];
  });
  const careEntries = careEvents.map((item) => ({
    id: item.id,
    at: item.doneAt,
    localDate: item.localDate,
    person: item.doneBy,
    title: item.activity === 'litter'
      ? 'Angela + Basta · kuweta'
      : `${item.cat} · ${CARE_LABELS[item.activity].toLowerCase()}`,
    icon: CARE_ICONS[item.activity],
  }));
  return [...feedingEntries, ...careEntries].sort((a, b) => b.at.localeCompare(a.at));
}
