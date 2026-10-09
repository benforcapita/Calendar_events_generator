import { type CalendarEvent, MAX_EVENTS, validateEvent } from "./events";
export const STORAGE_KEY = "ces_events_v1";
function validateList(value: unknown): CalendarEvent[] {
  if (!Array.isArray(value) || value.length > MAX_EVENTS)
    throw new Error("Invalid saved event list.");
  const events = value.map(validateEvent);
  if (
    new Set(events.map((e) => e.id)).size !== events.length ||
    new Set(events.map((e) => e.uid)).size !== events.length
  )
    throw new Error("Duplicate saved event identity.");
  return events;
}
export function loadEvents(storage: Pick<Storage, "getItem">): {
  events: CalendarEvent[];
  error: string | null;
} {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { events: [], error: null };
    if (raw.length > 40_000_000) throw new Error();
    const data: unknown = JSON.parse(raw);
    if (
      !data ||
      typeof data !== "object" ||
      !("version" in data) ||
      data.version !== 1 ||
      !("events" in data)
    )
      throw new Error();
    return { events: validateList(data.events), error: null };
  } catch {
    return {
      events: [],
      error:
        "Saved browser storage could not be read. Existing data is untouched. New events stay in this tab only; download an ICS backup before leaving.",
    };
  }
}
export function saveEvents(
  storage: Pick<Storage, "setItem">,
  events: CalendarEvent[],
): void {
  const validated = validateList(events);
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, events: validated }),
    );
  } catch {
    throw new Error(
      "Changes are not saved to this browser. They remain in this tab; download an ICS backup before leaving.",
    );
  }
}
export function loadBrowserEvents() {
  try {
    return loadEvents(window.localStorage);
  } catch {
    return {
      events: [],
      error:
        "Browser storage is unavailable. Events stay in this tab only; download an ICS backup before leaving.",
    };
  }
}
