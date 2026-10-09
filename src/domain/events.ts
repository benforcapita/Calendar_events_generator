import { Temporal } from "@js-temporal/polyfill";

export type Disambiguation = "reject" | "earlier" | "later";
export interface EventDraft {
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  start: string;
  end: string;
  timeZone: string;
  disambiguation: Disambiguation;
  endDisambiguation?: Disambiguation;
}
export interface CalendarEvent {
  id: string;
  uid: string;
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  start: string;
  end: string;
  timeZone: string;
  createdAt: string;
  updatedAt: string;
  sequence: number;
}
export const MAX_EVENTS = 500;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const localPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;
const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Event details must be an object.");
  return value as Record<string, unknown>;
}
export function safeText(
  value: unknown,
  label: string,
  max: number,
  required = false,
): string {
  // Control characters are intentionally rejected at the text trust boundary.
  if (
    typeof value !== "string" ||
    value.length > max ||
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  )
    throw new Error(`${label} must be valid text, up to ${max} characters.`);
  if (required && !value.trim()) throw new Error(`${label} is required.`);
  // Reject unpaired UTF-16 surrogates instead of losing characters on export.
  for (const c of value)
    if (
      c.length === 1 &&
      c.charCodeAt(0) >= 0xd800 &&
      c.charCodeAt(0) <= 0xdfff
    )
      throw new Error(`${label} contains invalid Unicode.`);
  return value.replace(/\r\n?/g, "\n");
}
export function validDate(value: unknown): string {
  if (
    typeof value !== "string" ||
    !datePattern.test(value) ||
    value.slice(0, 4) === "0000"
  )
    throw new Error("Use a valid date in YYYY-MM-DD format (years 0001–9999).");
  try {
    return Temporal.PlainDate.from(value, { overflow: "reject" }).toString();
  } catch {
    throw new Error("That date does not exist. Check the month and day.");
  }
}
export function validZone(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 100 ||
    !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*$/.test(value)
  )
    throw new Error("Use an IANA time zone, such as Europe/London or UTC.");
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value;
  } catch {
    throw new Error(
      "Unknown time zone. Use an IANA name, such as America/New_York.",
    );
  }
}
function localToInstant(
  value: unknown,
  zone: string,
  choice: Disambiguation,
): string {
  if (typeof value !== "string" || !localPattern.test(value))
    throw new Error("Use a valid local date and time.");
  validDate(value.slice(0, 10));
  if (value.length === 19 && Number(value.slice(17, 19)) > 59)
    throw new Error(
      "Seconds must be 00–59; leap-second times are not supported.",
    );
  let local: Temporal.PlainDateTime;
  try {
    local = Temporal.PlainDateTime.from(value, { overflow: "reject" });
  } catch {
    throw new Error("That date or time is invalid.");
  }
  const earlier = local.toZonedDateTime(zone, { disambiguation: "earlier" });
  const later = local.toZonedDateTime(zone, { disambiguation: "later" });
  if (
    !earlier.toPlainDateTime().equals(local) ||
    !later.toPlainDateTime().equals(local)
  )
    throw new Error(
      "This local time does not exist because the clock moves forward. Choose another time.",
    );
  if (
    earlier.epochNanoseconds !== later.epochNanoseconds &&
    choice === "reject"
  )
    throw new Error(
      "This local time occurs twice when the clock moves back. Choose the first or second occurrence below.",
    );
  return (choice === "later" ? later : earlier)
    .toInstant()
    .toString({ smallestUnit: "second" });
}
export function validInstant(value: unknown): string {
  if (typeof value !== "string" || !instantPattern.test(value))
    throw new Error("Invalid UTC event time.");
  validDate(value.slice(0, 10));
  try {
    const parsed = Temporal.Instant.from(value);
    if (parsed.toString({ smallestUnit: "second" }) !== value)
      throw new Error();
    return value;
  } catch {
    throw new Error("Invalid UTC event date or time.");
  }
}
export function makeEvent(value: unknown): CalendarEvent {
  const d = record(value);
  const title = safeText(d.title, "Title", 300, true).trim();
  const description = safeText(d.description, "Notes", 20000);
  const location = safeText(d.location, "Location", 1000);
  if (typeof d.allDay !== "boolean")
    throw new Error("Choose all-day or timed.");
  if (!["reject", "earlier", "later"].includes(d.disambiguation as string))
    throw new Error("Invalid daylight-saving time choice.");
  if (
    d.endDisambiguation !== undefined &&
    !["reject", "earlier", "later"].includes(d.endDisambiguation as string)
  )
    throw new Error("Invalid end daylight-saving time choice.");
  const timeZone = validZone(d.timeZone);
  let start: string, end: string;
  if (d.allDay) {
    start = validDate(d.start);
    const lastDay = validDate(d.end);
    if (lastDay < start)
      throw new Error("Last day must be on or after the start date.");
    end = Temporal.PlainDate.from(lastDay).add({ days: 1 }).toString();
    validDate(end);
  } else {
    start = localToInstant(
      d.start,
      timeZone,
      d.disambiguation as Disambiguation,
    );
    end = localToInstant(
      d.end,
      timeZone,
      (d.endDisambiguation ?? d.disambiguation) as Disambiguation,
    );
    validInstant(start);
    validInstant(end);
    if (Temporal.Instant.compare(end, start) <= 0)
      throw new Error("End must be after the start.");
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  return {
    id,
    uid: `${id}@calendar-events-studio.local`,
    title,
    description,
    location,
    allDay: d.allDay,
    start,
    end,
    timeZone,
    createdAt: now,
    updatedAt: now,
    sequence: 0,
  };
}
export function validateEvent(value: unknown): CalendarEvent {
  const e = record(value);
  if (typeof e.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(e.id))
    throw new Error("Invalid event identity.");
  const uid = safeText(e.uid, "Event UID", 500, true);
  if (/[\r\n]/.test(uid)) throw new Error("Invalid event UID.");
  if (typeof e.allDay !== "boolean") throw new Error("Invalid event kind.");
  const start = e.allDay ? validDate(e.start) : validInstant(e.start);
  const end = e.allDay ? validDate(e.end) : validInstant(e.end);
  if (end <= start) throw new Error("End must be after the start.");
  if (
    !Number.isSafeInteger(e.sequence) ||
    (e.sequence as number) < 0 ||
    (e.sequence as number) >= 2147483647
  )
    throw new Error("Invalid event revision.");
  return {
    id: e.id,
    uid,
    title: safeText(e.title, "Title", 300, true),
    description: safeText(e.description, "Notes", 20000),
    location: safeText(e.location, "Location", 1000),
    allDay: e.allDay,
    start,
    end,
    timeZone: validZone(e.timeZone),
    createdAt: validInstant(e.createdAt),
    updatedAt: validInstant(e.updatedAt),
    sequence: e.sequence as number,
  };
}
export function updateEvent(
  previous: CalendarEvent,
  draft: unknown,
): CalendarEvent {
  const next = makeEvent(draft);
  return validateEvent({
    ...next,
    id: previous.id,
    uid: previous.uid,
    createdAt: previous.createdAt,
    sequence: previous.sequence + 1,
  });
}
export function toDraft(event: CalendarEvent): EventDraft {
  const start = event.allDay
    ? event.start
    : Temporal.Instant.from(event.start)
        .toZonedDateTimeISO(event.timeZone)
        .toPlainDateTime()
        .toString({ smallestUnit: "second" });
  const end = event.allDay
    ? Temporal.PlainDate.from(event.end).subtract({ days: 1 }).toString()
    : Temporal.Instant.from(event.end)
        .toZonedDateTimeISO(event.timeZone)
        .toPlainDateTime()
        .toString({ smallestUnit: "second" });
  const occurrence = (local: string, instant: string): Disambiguation =>
    event.allDay
      ? "reject"
      : localToInstant(local, event.timeZone, "earlier") === instant
        ? "earlier"
        : "later";
  return {
    title: event.title,
    description: event.description,
    location: event.location,
    allDay: event.allDay,
    start,
    end,
    timeZone: event.timeZone,
    disambiguation: occurrence(start, event.start),
    endDisambiguation: occurrence(end, event.end),
  };
}
export function blankDraft(): EventDraft {
  const today = Temporal.Now.plainDateISO().toString();
  return {
    title: "",
    description: "",
    location: "",
    allDay: false,
    start: `${today}T09:00`,
    end: `${today}T10:00`,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    disambiguation: "reject",
  };
}
export function parseStructuredText(text: string): EventDraft {
  if (text.length > 3000 || /[\r\n]/.test(text))
    throw new Error("Use one line in the format shown below.");
  const parts = text.split("|").map((s) => s.trim());
  if (parts.length < 3 || parts.length > 5)
    throw new Error(
      "Use Title | YYYY-MM-DD | HH:MM-HH:MM | Time zone | Location.",
    );
  const [title, dates, time, zone, location] = parts;
  const dateParts = dates.split("..");
  if (dateParts.length > 2)
    throw new Error("Use one date or a start..last date range.");
  const startDate = validDate(dateParts[0]);
  const endDate = validDate(dateParts[1] || startDate);
  const allDay = time.toLowerCase() === "all-day";
  if (!allDay && !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(time))
    throw new Error("Use a 24-hour range such as 09:00-10:30, or all-day.");
  const draft: EventDraft = {
    title,
    description: "",
    location: location || "",
    allDay,
    start: allDay ? startDate : `${startDate}T${time.slice(0, 5)}`,
    end: allDay ? endDate : `${endDate}T${time.slice(6)}`,
    timeZone: zone || "UTC",
    disambiguation: "reject",
  };
  makeEvent(draft);
  return draft;
}
