import type { Event } from "@/types";

const FULL_MONTH_MAP: Record<string, number> = {
  gennaio: 0,
  febbraio: 1,
  marzo: 2,
  aprile: 3,
  maggio: 4,
  giugno: 5,
  luglio: 6,
  agosto: 7,
  settembre: 8,
  ottobre: 9,
  novembre: 10,
  dicembre: 11,
};

const SHORT_MONTH_MAP: Record<string, number> = {
  GEN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAG: 4,
  GIU: 5,
  LUG: 6,
  AGO: 7,
  SET: 8,
  OTT: 9,
  NOV: 10,
  DIC: 11,
};

const pad = (value: number) => String(value).padStart(2, "0");

const toDateKey = (year: number, month: number, day: number) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

export const normalizeEventText = (value?: string | null) =>
  (value || "").trim().replace(/\s+/g, " ").toLowerCase();

export const getEventDateKey = (
  dateStr: string,
  today = new Date(),
): string | null => {
  const trimmed = dateStr.trim();
  if (!trimmed) {
    return null;
  }

  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s]|$)/);
  if (isoMatch) {
    return isoMatch[1];
  }

  const fullItalianMatch = trimmed.match(
    /^(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})$/,
  );
  if (fullItalianMatch) {
    const day = Number(fullItalianMatch[1]);
    const month = FULL_MONTH_MAP[fullItalianMatch[2].toLowerCase()];
    const year = Number(fullItalianMatch[3]);

    if (!Number.isNaN(day) && month !== undefined && !Number.isNaN(year)) {
      return toDateKey(year, month, day);
    }
  }

  const shortItalianMatch = trimmed
    .split("|")[0]
    .trim()
    .match(/^(\d{1,2})\s+([A-Za-z]{3})$/i);
  if (shortItalianMatch) {
    const day = Number(shortItalianMatch[1]);
    const month = SHORT_MONTH_MAP[shortItalianMatch[2].toUpperCase()];

    if (!Number.isNaN(day) && month !== undefined) {
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      const inferredYear = month < currentMonth ? currentYear + 1 : currentYear;
      return toDateKey(inferredYear, month, day);
    }
  }

  return null;
};

const eventQualityScore = (event: Event) => {
  let score = 0;

  if (event.marzipanoScenes?.length) score += 100;
  if (event.tourProvider) score += 20;
  if (normalizeEventText(event.venue)) score += 10;
  if (normalizeEventText(event.description)) score += 5;
  if (event.genres?.length) score += 5;
  if (event.tables?.length) score += 3;
  if (event.time) score += 2;
  if (event.endTime) score += 2;
  if (event.ageLimit) score += 2;
  if (event.status) score += 1;

  return score;
};

const mergeEventFields = (preferred: Event, fallback: Event): Event => ({
  ...fallback,
  ...preferred,
  title: preferred.title.trim() || fallback.title,
  venue: preferred.venue?.trim() || fallback.venue,
  date: preferred.date || fallback.date,
  image: preferred.image || fallback.image,
  status: preferred.status ?? fallback.status,
  time: preferred.time ?? fallback.time,
  ageLimit: preferred.ageLimit ?? fallback.ageLimit,
  endTime: preferred.endTime ?? fallback.endTime,
  price: preferred.price ?? fallback.price,
  description: preferred.description ?? fallback.description,
  tourProvider: preferred.tourProvider ?? fallback.tourProvider,
  marzipanoScenes:
    preferred.marzipanoScenes?.length
      ? preferred.marzipanoScenes
      : fallback.marzipanoScenes,
  tables: preferred.tables?.length ? preferred.tables : fallback.tables,
  genres: preferred.genres?.length ? preferred.genres : fallback.genres,
});

export const dedupeEvents = (events: Event[]): Event[] => {
  const deduped: Event[] = [];

  for (const event of events) {
    const eventTitle = normalizeEventText(event.title);
    const eventDateKey = getEventDateKey(event.date) || normalizeEventText(event.date);
    const eventVenue = normalizeEventText(event.venue);

    const existingIndex = deduped.findIndex((existing) => {
      const existingTitle = normalizeEventText(existing.title);
      const existingDateKey =
        getEventDateKey(existing.date) || normalizeEventText(existing.date);
      const existingVenue = normalizeEventText(existing.venue);

      return (
        existingTitle === eventTitle &&
        existingDateKey === eventDateKey &&
        (existingVenue === eventVenue || !existingVenue || !eventVenue)
      );
    });

    if (existingIndex === -1) {
      deduped.push(event);
      continue;
    }

    const existing = deduped[existingIndex];
    const preferred =
      eventQualityScore(event) > eventQualityScore(existing) ? event : existing;
    const fallback = preferred === event ? existing : event;

    deduped[existingIndex] = mergeEventFields(preferred, fallback);
  }

  return deduped;
};
