import ICAL from "ical.js";
import { Temporal } from "@js-temporal/polyfill";
import {
  type CalendarEvent,
  makeEvent,
  MAX_EVENTS,
  validDate,
  validateEvent,
  validInstant,
  validZone,
} from "./events";

export const MAX_ICS_BYTES = 40_000_000;
function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\r\n?|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}
// RFC 5545 §3.1: maximum 75 octets, including the continuation whitespace.
export function foldLine(line: string): string {
  let current = "",
    bytes = 0;
  const lines: string[] = [];
  for (const char of line) {
    const point = char.codePointAt(0)!;
    const size =
      point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    if (bytes + size > 75) {
      lines.push(current);
      current = " ";
      bytes = 1;
    }
    current += char;
    bytes += size;
  }
  lines.push(current);
  return lines.join("\r\n");
}
const compact = (value: string) => value.replace(/[-:]/g, "");
export function exportICS(events: CalendarEvent[]): string {
  if (!events.length || events.length > MAX_EVENTS)
    throw new Error(`Choose 1–${MAX_EVENTS} events to export.`);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Calendar Events Studio//Local-first 1.0//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const raw of events) {
    const event = validateEvent(raw);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(event.uid)}`,
      `DTSTAMP:${compact(event.updatedAt)}`,
      `CREATED:${compact(event.createdAt)}`,
      `LAST-MODIFIED:${compact(event.updatedAt)}`,
      `SEQUENCE:${event.sequence}`,
      `DTSTART${event.allDay ? ";VALUE=DATE" : ""}:${compact(event.start)}`,
      `DTEND${event.allDay ? ";VALUE=DATE" : ""}:${compact(event.end)}`,
      `SUMMARY:${escapeText(event.title)}`,
      `DESCRIPTION:${escapeText(event.description)}`,
      `LOCATION:${escapeText(event.location)}`,
      `X-CES-TIMEZONE;VALUE=TEXT:${escapeText(event.timeZone)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
const allowed = new Set([
  "uid",
  "dtstamp",
  "created",
  "last-modified",
  "sequence",
  "dtstart",
  "dtend",
  "summary",
  "description",
  "location",
  "x-ces-timezone",
]);
const calendarAllowed = new Set(["version", "prodid", "calscale"]);
function rawValue(
  component: InstanceType<typeof ICAL.Component>,
  name: string,
): unknown {
  return component.getFirstProperty(name)?.jCal[3];
}
function assertProperties(
  component: InstanceType<typeof ICAL.Component>,
  names: Set<string>,
) {
  const seen = new Set<string>();
  for (const property of component.getAllProperties()) {
    if (!names.has(property.name))
      throw new Error(
        `Import does not support ${property.name.toUpperCase()}. No events were added.`,
      );
    if (seen.has(property.name))
      throw new Error(`Duplicate ${property.name.toUpperCase()} in calendar.`);
    seen.add(property.name);
    if (property.jCal.length !== 4)
      throw new Error(
        `Multiple values in ${property.name.toUpperCase()} are not supported.`,
      );
    const params = property.jCal[1] as Record<string, unknown>;
    for (const key of Object.keys(params))
      if (!(key === "tzid" && ["dtstart", "dtend"].includes(property.name)))
        throw new Error(`Unsupported ${key.toUpperCase()} parameter.`);
    const expected = ["dtstart", "dtend"].includes(property.name)
      ? ["date", "date-time"]
      : ["dtstamp", "created", "last-modified"].includes(property.name)
        ? ["date-time"]
        : property.name === "sequence"
          ? ["integer"]
          : ["text"];
    if (!expected.includes(property.type))
      throw new Error(`Invalid value type in ${property.name.toUpperCase()}.`);
  }
}
function importEvent(
  component: InstanceType<typeof ICAL.Component>,
): CalendarEvent {
  assertProperties(component, allowed);
  if (component.getAllSubcomponents().length)
    throw new Error(
      "Alarms and nested components are not supported. No events were added.",
    );
  const startProperty = component.getFirstProperty("dtstart");
  const endProperty = component.getFirstProperty("dtend");
  if (!startProperty) throw new Error("Each event needs DTSTART.");
  const start = rawValue(component, "dtstart");
  const end = rawValue(component, "dtend");
  if (
    typeof start !== "string" ||
    (end !== undefined && typeof end !== "string")
  )
    throw new Error("Invalid event date.");
  const allDay = startProperty.type === "date";
  if (endProperty && endProperty.type !== startProperty.type)
    throw new Error("Start and end must use the same date type.");
  const title = rawValue(component, "summary");
  const location = rawValue(component, "location") ?? "";
  const description = rawValue(component, "description") ?? "";
  const uid = rawValue(component, "uid");
  const stamp = validInstant(rawValue(component, "dtstamp"));
  const createdAt = component.hasProperty("created")
    ? validInstant(rawValue(component, "created"))
    : stamp;
  const updatedAt = component.hasProperty("last-modified")
    ? validInstant(rawValue(component, "last-modified"))
    : stamp;
  const sequence = rawValue(component, "sequence") ?? 0;
  let event: CalendarEvent;
  const startZone = startProperty.getParameter("tzid");
  const endZone = endProperty?.getParameter("tzid");
  const displayZone = rawValue(component, "x-ces-timezone");
  if (allDay) {
    if (startZone || endZone)
      throw new Error("All-day dates cannot have TZID.");
    validDate(start);
    const exclusiveEnd =
      end === undefined
        ? Temporal.PlainDate.from(start).add({ days: 1 }).toString()
        : validDate(end);
    if (exclusiveEnd <= start)
      throw new Error("All-day end must be after start.");
    event = makeEvent({
      title,
      location,
      description,
      allDay: true,
      start,
      end: Temporal.PlainDate.from(exclusiveEnd)
        .subtract({ days: 1 })
        .toString(),
      timeZone: displayZone ?? "UTC",
      disambiguation: "reject",
    });
  } else {
    if (!end) throw new Error("Timed events need an explicit DTEND.");
    if (start.endsWith("Z") && end.endsWith("Z")) {
      if (startZone || endZone)
        throw new Error("UTC dates cannot also have TZID.");
      validInstant(start);
      validInstant(end);
      event = makeEvent({
        title,
        location,
        description,
        allDay: false,
        start: start.slice(0, -1),
        end: end.slice(0, -1),
        timeZone: "UTC",
        disambiguation: "reject",
      });
      event.timeZone = validZone(displayZone ?? "UTC");
    } else {
      if (
        !startZone ||
        !endZone ||
        startZone !== endZone ||
        start.endsWith("Z") ||
        end.endsWith("Z")
      )
        throw new Error(
          "Use UTC dates or the same explicit IANA TZID for start and end. Floating times are not supported.",
        );
      event = makeEvent({
        title,
        location,
        description,
        allDay: false,
        start,
        end,
        timeZone: validZone(startZone),
        disambiguation: "reject",
      });
      if (displayZone !== undefined) event.timeZone = validZone(displayZone);
    }
  }
  return validateEvent({ ...event, uid, createdAt, updatedAt, sequence });
}
export function importICS(text: string): CalendarEvent[] {
  if (!text || new TextEncoder().encode(text).length > MAX_ICS_BYTES)
    throw new Error("Choose an ICS file smaller than 40 MB.");
  // ICAL.js coerces INTEGER values with parseInt; reject malformed source values first.
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const stack: string[] = [];
  let roots = 0;
  for (const line of unfolded.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const boundary = /^(BEGIN|END):([A-Z0-9-]+)$/i.exec(line);
    if (boundary) {
      const component = boundary[2].toUpperCase();
      if (boundary[1].toUpperCase() === "BEGIN") {
        if (!stack.length && (component !== "VCALENDAR" || ++roots > 1)) throw new Error("Import one calendar at a time.");
        stack.push(component);
      } else if (stack.pop() !== component) throw new Error("Calendar component boundaries do not match.");
    } else if (line.trim() && !stack.length) throw new Error("Unexpected content outside the calendar.");
    const match = /^SEQUENCE(?:;[^:]*)?:(.*)$/i.exec(line);
    if (match && !/^[+-]?\d+$/.test(match[1]))
      throw new Error("SEQUENCE must be a whole integer.");
  }
  if (stack.length || roots !== 1) throw new Error("Incomplete calendar component boundaries.");
  let calendar: InstanceType<typeof ICAL.Component>;
  try {
    const parsed: unknown = ICAL.parse(text.replace(/^\uFEFF/, ""));
    if (!Array.isArray(parsed) || parsed[0] !== "vcalendar") throw new Error();
    calendar = new ICAL.Component(parsed);
  } catch {
    throw new Error("This is not a single valid iCalendar file.");
  }
  assertProperties(calendar, calendarAllowed);
  if (
    rawValue(calendar, "version") !== "2.0" ||
    !calendar.hasProperty("prodid")
  )
    throw new Error("Calendar must declare VERSION:2.0 and PRODID.");
  if (
    calendar.hasProperty("calscale") &&
    rawValue(calendar, "calscale") !== "GREGORIAN"
  )
    throw new Error("Only Gregorian calendars are supported.");
  const components = calendar.getAllSubcomponents();
  if (!components.length || components.length > MAX_EVENTS)
    throw new Error(`Import 1–${MAX_EVENTS} events at a time.`);
  if (components.some((c) => c.name !== "vevent"))
    throw new Error(
      "Only standalone events are supported. Custom timezone definitions, tasks and journals are not imported.",
    );
  const events = components.map(importEvent);
  if (new Set(events.map((e) => e.uid)).size !== events.length)
    throw new Error("Duplicate event UIDs in this file. No events were added.");
  return events;
}
export function mergeImported(
  existing: CalendarEvent[],
  imported: CalendarEvent[],
): { events: CalendarEvent[]; added: number; skipped: number } {
  const uids = new Set(existing.map((e) => e.uid));
  const additions = imported.filter((e) => !uids.has(e.uid));
  if (existing.length + additions.length > MAX_EVENTS)
    throw new Error(
      `This device can keep up to ${MAX_EVENTS} events. Export a backup and remove some before importing.`,
    );
  return {
    events: [...additions, ...existing],
    added: additions.length,
    skipped: imported.length - additions.length,
  };
}
