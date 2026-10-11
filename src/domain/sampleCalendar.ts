import ICAL from "ical.js";
import { type CalendarEvent, makeEvent } from "./events";
import { exportICS, importICS } from "./ics";

const STAMP = "2026-10-11T12:00:00Z";

function stable(event: CalendarEvent, id: string): CalendarEvent {
  return {
    ...event,
    id,
    uid: `${id}@calendar-events-studio.local`,
    createdAt: STAMP,
    updatedAt: STAMP,
    sequence: 0,
  };
}

/** Deterministic events used for the committed sample file and its validator. */
export function sampleEvents(): CalendarEvent[] {
  return [
    stable(
      makeEvent({
        title: "Design review",
        description: "Walk through the local-first editor.",
        location: "Studio 2",
        allDay: false,
        start: "2026-10-12T09:00",
        end: "2026-10-12T10:30",
        timeZone: "America/New_York",
        disambiguation: "reject",
      }),
      "design-review",
    ),
    stable(
      makeEvent({
        title: "Offsite",
        description: "",
        location: "",
        allDay: true,
        start: "2026-12-31",
        end: "2027-01-02",
        timeZone: "UTC",
        disambiguation: "reject",
      }),
      "offsite",
    ),
  ];
}

export function sampleCalendar(): string {
  return exportICS(sampleEvents());
}

export interface CalendarReport {
  valid: true;
  events: number;
  octets: number;
  maxLineOctets: number;
  version: string;
  prodid: string;
  calscale: string;
  lineEndings: "CRLF";
  summaries: string[];
  roundTrip: true;
  parser: "ical.js";
}

function unfold(text: string): string[] {
  const raw = text.split("\r\n").slice(0, -1);
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/**
 * Checks a generated calendar against RFC 5545 framing rules and an
 * independent ICAL.js parse, then confirms this app can import it back.
 */
export function validateCalendar(
  text: string,
  expected: CalendarEvent[],
): CalendarReport {
  if (!text.endsWith("\r\n")) throw new Error("Calendar must end with CRLF.");
  const withoutBreaks = text.replace(/\r\n/g, "");
  if (withoutBreaks.includes("\n") || withoutBreaks.includes("\r")) {
    throw new Error("Calendar must use CRLF line endings only.");
  }
  const physical = text.split("\r\n").slice(0, -1);
  if (physical.some((line) => line.length === 0)) {
    throw new Error("Calendar contains a blank content line.");
  }
  let maxLineOctets = 0;
  for (const line of physical) {
    const octets = new TextEncoder().encode(line).length;
    if (octets > 75) {
      throw new Error(`Content line exceeds 75 octets (${octets}).`);
    }
    if (octets > maxLineOctets) maxLineOctets = octets;
  }

  const unfolded = unfold(text);
  const stack: string[] = [];
  for (const line of unfolded) {
    const boundary = /^(BEGIN|END):([A-Z0-9-]+)$/.exec(line);
    if (!boundary) continue;
    const name = boundary[2];
    if (boundary[1] === "BEGIN") stack.push(name);
    else if (stack.pop() !== name) {
      throw new Error(`Component boundary mismatch at END:${name}.`);
    }
  }
  if (stack.length !== 0 || unfolded[0] !== "BEGIN:VCALENDAR") {
    throw new Error("Calendar component boundaries do not match.");
  }
  if (unfolded[unfolded.length - 1] !== "END:VCALENDAR") {
    throw new Error("Calendar must end with END:VCALENDAR.");
  }

  let parsed: unknown;
  try {
    parsed = ICAL.parse(text);
  } catch {
    throw new Error("ICAL.js could not parse the generated calendar.");
  }
  if (!Array.isArray(parsed) || parsed[0] !== "vcalendar") {
    throw new Error("Root component must be VCALENDAR.");
  }
  const calendar = new ICAL.Component(parsed);
  const version = calendar.getFirstPropertyValue("version");
  const prodid = calendar.getFirstPropertyValue("prodid");
  const calscale = calendar.getFirstPropertyValue("calscale");
  if (version !== "2.0") throw new Error("VERSION must be 2.0.");
  if (typeof prodid !== "string" || prodid.length === 0) {
    throw new Error("PRODID is required.");
  }
  if (calscale !== "GREGORIAN") throw new Error("CALSCALE must be GREGORIAN.");
  if (calendar.getFirstProperty("method")) {
    throw new Error("Generated calendars must not include METHOD.");
  }

  const vevents = calendar.getAllSubcomponents("vevent");
  if (vevents.length === 0) throw new Error("Calendar has no events.");
  const summaries: string[] = [];
  for (const vevent of vevents) {
    for (const name of ["uid", "dtstamp", "dtstart", "dtend", "summary"]) {
      if (!vevent.getFirstProperty(name)) {
        throw new Error(`VEVENT is missing ${name.toUpperCase()}.`);
      }
    }
    for (const banned of ["organizer", "attendee", "rrule"]) {
      if (vevent.getFirstProperty(banned)) {
        throw new Error(`VEVENT must not include ${banned.toUpperCase()}.`);
      }
    }
    const summary = vevent.getFirstPropertyValue("summary");
    if (typeof summary !== "string") throw new Error("SUMMARY must be text.");
    summaries.push(summary);
  }

  const imported = importICS(text);
  if (imported.length !== vevents.length || imported.length !== expected.length) {
    throw new Error("Importer did not accept every generated event.");
  }
  if (
    imported.length !== expected.length ||
    imported.some((event, index) => {
      const source = expected[index];
      return (
        event.uid !== source.uid ||
        event.title !== source.title ||
        event.description !== source.description ||
        event.location !== source.location ||
        event.allDay !== source.allDay ||
        event.start !== source.start ||
        event.end !== source.end ||
        event.timeZone !== source.timeZone ||
        event.createdAt !== source.createdAt ||
        event.updatedAt !== source.updatedAt ||
        event.sequence !== source.sequence
      );
    })
  ) {
    throw new Error("Import did not round-trip the generated events.");
  }

  return {
    valid: true,
    events: vevents.length,
    octets: new TextEncoder().encode(text).length,
    maxLineOctets,
    version: "2.0",
    prodid,
    calscale: "GREGORIAN",
    lineEndings: "CRLF",
    summaries,
    roundTrip: true,
    parser: "ical.js",
  };
}
