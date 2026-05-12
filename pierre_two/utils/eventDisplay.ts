import type {
  Event,
  EventEntryType,
  EventPricing,
  EventTicketingMode,
  TableReservation,
  Ticket,
} from "@/types";
import { getEventDateKey } from "@/utils/events";

type EventLike =
  | Pick<Event, "venue" | "clubName" | "clubAddress" | "date" | "time" | "price" | "pricing">
  | Pick<NonNullable<TableReservation["event"]>, "venue" | "clubName" | "clubAddress" | "date">
  | Pick<Ticket["event"], "venue" | "clubName" | "clubAddress" | "date">;

type EventPricingLike = Pick<Event, "price" | "pricing">;
type EventCtaLike = Pick<
  Event,
  "entryType" | "ticketingMode" | "hasReservableAreas" | "price" | "pricing"
>;

const normalizeText = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const parsePriceAmount = (value?: string | null) => {
  const normalized = normalizeText(value)?.replace(/[^\d.,-]/g, "").replace(",", ".");
  if (!normalized) {
    return undefined;
  }

  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : undefined;
};

const parseDate = (value: string): Date | null => {
  const isoDate = getEventDateKey(value);
  if (isoDate) {
    const date = new Date(`${isoDate}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

export const getEventVenueLabel = (event: EventLike) =>
  normalizeText(event.venue) || normalizeText(event.clubName) || "";

export const getEventAddressLabel = (event: EventLike) => {
  const address = normalizeText(event.clubAddress);
  if (!address) {
    return undefined;
  }

  const venue = getEventVenueLabel(event).toLowerCase();
  return venue === address.toLowerCase() ? undefined : address;
};

export const formatEventDateLabel = (value: string, includeYear = false) => {
  const date = parseDate(value);
  if (!date) {
    return value;
  }

  return date.toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "long",
    ...(includeYear ? { year: "numeric" as const } : {}),
  });
};

export const formatEventDateTimeLabel = (event: EventLike) => {
  const dateLabel = formatEventDateLabel(event.date, true);
  const timeLabel = "time" in event ? normalizeText(event.time) : undefined;
  return timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel;
};

const resolvePricing = (pricing?: EventPricing, rawPrice?: string) => {
  if (pricing) {
    return pricing;
  }

  const displayPrice = normalizeText(rawPrice);
  const amount = parsePriceAmount(displayPrice);
  return {
    isFree: !displayPrice || amount === 0,
    displayPrice: amount === 0 ? undefined : displayPrice,
  };
};

export const isEventFreeEntry = (event: EventPricingLike) =>
  resolvePricing(event.pricing, event.price).isFree;

export const getEventPriceLabel = (event: EventPricingLike) => {
  const displayPrice = resolvePricing(event.pricing, event.price).displayPrice;
  const amount = parsePriceAmount(displayPrice);
  return amount === undefined ? displayPrice : formatCurrencyAmount(amount);
};

export const resolveEventEntryType = (event: EventCtaLike): EventEntryType =>
  event.entryType || (isEventFreeEntry(event) ? "free" : "ticketed");

export const resolveEventTicketingMode = (
  event: EventCtaLike,
): EventTicketingMode =>
  event.ticketingMode ||
  (resolveEventEntryType(event) === "ticketed" ? "paid" : "none");

export const hasEventReservableAreas = (event: EventCtaLike) =>
  Boolean(event.hasReservableAreas);

export const parseCurrencyAmount = (value?: string | null) =>
  value ? Number.parseFloat(value.replace(/[^\d.,-]/g, "").replace(",", ".")) || 0 : 0;

export const formatCurrencyAmount = (value: number) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
