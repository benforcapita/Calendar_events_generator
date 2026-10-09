import { describe, expect, it } from "vitest";
import ICAL from "ical.js";
import { makeEvent, toDraft, updateEvent } from "./events";
import { exportICS, importICS, MAX_ICS_BYTES } from "./ics";
const timed = {
  title: "Review",
  description: "",
  location: "",
  allDay: false,
  start: "2026-10-12T09:00",
  end: "2026-10-12T10:00",
  timeZone: "America/New_York",
  disambiguation: "reject",
};
const wrap = (lines: string[]) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Test//EN",
    "BEGIN:VEVENT",
    "UID:abc@example.test",
    "DTSTAMP:20261009T120000Z",
    "SUMMARY:Review",
    ...lines,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
describe("ICS export and import", () => {
  it("emits CRLF, stable UID, UTC instants and a valid independent parse", () => {
    const event = makeEvent(timed);
    const text = exportICS([event]);
    expect(text.endsWith("\r\n")).toBe(true);
    expect(text).toContain("DTSTART:20261012T130000Z");
    const component = new ICAL.Component(ICAL.parse(text));
    const vevent = component.getFirstSubcomponent("vevent")!;
    expect(vevent.getFirstPropertyValue("uid")).toBe(event.uid);
    expect(vevent.getFirstPropertyValue("summary")).toBe("Review");
    const parsed = importICS(text)[0];
    expect({ ...parsed, id: event.id }).toEqual(event);
  });
  it("round trips escaping and Unicode without property injection", () => {
    const event = makeEvent({
      ...timed,
      title: "会議 👩🏽‍💻 ".repeat(25),
      description:
        "comma, semicolon; slash\\ literal\\n\r\nBEGIN:VEVENT\r\nATTENDEE:mailto:fake@example.test",
      location: "Café, 2; west",
    });
    const text = exportICS([event]);
    for (const line of text.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    const root = new ICAL.Component(ICAL.parse(text));
    expect(root.getAllSubcomponents("vevent")).toHaveLength(1);
    expect(
      root.getFirstSubcomponent("vevent")!.getFirstProperty("attendee"),
    ).toBeNull();
    const imported = importICS(text)[0];
    expect(imported.title).toBe(event.title);
    expect(imported.description).toBe(event.description);
    expect(imported.location).toBe(event.location);
  });
  it("round trips all-day leap and year boundaries using an exclusive end", () => {
    const event = makeEvent({
      ...timed,
      allDay: true,
      start: "2028-02-29",
      end: "2028-03-01",
    });
    const text = exportICS([event]);
    expect(text).toContain("DTSTART;VALUE=DATE:20280229");
    expect(text).toContain("DTEND;VALUE=DATE:20280302");
    expect(importICS(text)[0].end).toBe("2028-03-02");
    expect(toDraft(importICS(text)[0]).end).toBe("2028-03-01");
  });
  it("round trips a repeated-hour interval and preserves both endpoint choices through edits", () => {
    const original = makeEvent({
      ...timed,
      start: "2026-11-01T01:30",
      end: "2026-11-01T01:45",
      disambiguation: "earlier",
      endDisambiguation: "later",
    });
    expect(Date.parse(original.end) - Date.parse(original.start)).toBe(
      75 * 60000,
    );
    const imported = importICS(exportICS([original]))[0];
    const edited = updateEvent(imported, {
      ...toDraft(imported),
      title: "Renamed",
    });
    expect([edited.start, edited.end]).toEqual([original.start, original.end]);
  });
  it("imports UTC and date-only external files", () => {
    expect(
      importICS(wrap(["DTSTART:20261012T090000Z", "DTEND:20261012T100000Z"]))[0]
        .start,
    ).toBe("2026-10-12T09:00:00Z");
    expect(importICS(wrap(["DTSTART;VALUE=DATE:20261231"]))[0].end).toBe(
      "2027-01-01",
    );
  });
  it("imports explicit IANA zone dates with strict validation", () => {
    expect(
      importICS(
        wrap([
          "DTSTART;TZID=Asia/Kathmandu:20261012T090000",
          "DTEND;TZID=Asia/Kathmandu:20261012T100000",
        ]),
      )[0].start,
    ).toBe("2026-10-12T03:15:00Z");
  });
  it.each([
    ["DTSTART:20260229T090000Z", "DTEND:20260301T100000Z"],
    ["DTSTART:20261012T090000Z", "DTEND:20261012T080000Z"],
    ["DTSTART:20261012T090000", "DTEND:20261012T100000"],
    ["DTSTART:20261012T090000Z", "DTEND:20261012T100000Z", "RRULE:FREQ=WEEKLY"],
    [
      "DTSTART:20261012T090000Z",
      "DTEND:20261012T100000Z",
      "ATTENDEE:mailto:person@example.test",
    ],
    [
      "DTSTART:20261012T090000Z",
      "DTEND:20261012T100000Z",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:-PT10M",
      "END:VALARM",
    ],
    [
      "DTSTART:20261012T090000Z",
      "DTEND:20261012T100000Z",
      "DTSTART:20261013T090000Z",
    ],
    [
      "DTSTART;TZID=America/New_York:20260308T023000",
      "DTEND;TZID=America/New_York:20260308T040000",
    ],
    [
      "DTSTART;TZID=America/New_York:20261101T013000",
      "DTEND;TZID=America/New_York:20261101T023000",
    ],
  ])(
    "rejects invalid or unsupported calendar data atomically: %s",
    (...lines) => expect(() => importICS(wrap(lines))).toThrow(),
  );
  it("rejects mismatched component boundaries instead of repairing them", () => {
    const valid = wrap(["DTSTART:20261012T090000Z", "DTEND:20261012T100000Z"]);
    expect(() => importICS(valid.replace("END:VEVENT", "END:VTODO"))).toThrow();
    expect(() => importICS(valid.replace("END:VCALENDAR", "END:VEVENT"))).toThrow();
  });
  it("rejects multiple root calendars, invitations and unexpected components", () => {
    const valid = wrap(["DTSTART:20261012T090000Z", "DTEND:20261012T100000Z"]);
    expect(() => importICS(valid + valid)).toThrow();
    expect(() =>
      importICS(valid.replace("VERSION:2.0", "VERSION:2.0\r\nMETHOD:REQUEST")),
    ).toThrow();
    expect(() =>
      importICS(
        valid
          .replace("BEGIN:VEVENT", "BEGIN:VTODO")
          .replace("END:VEVENT", "END:VTODO"),
      ),
    ).toThrow();
  });
  it("exports a supported large backup that it can restore", () => {
    const events = Array.from({ length: 100 }, () =>
      makeEvent({ ...timed, description: "x".repeat(20000) }),
    );
    const backup = exportICS(events);
    expect(new TextEncoder().encode(backup).length).toBeLessThanOrEqual(
      MAX_ICS_BYTES,
    );
    expect(importICS(backup)).toHaveLength(100);
  });
  it.each(["1garbage", "2.5", "Infinity", "", "-1"])(
    "rejects malformed SEQUENCE %s",
    (value) => {
      expect(() =>
        importICS(
          wrap([
            "DTSTART:20261012T090000Z",
            "DTEND:20261012T100000Z",
            `SEQUENCE:${value}`,
          ]),
        ),
      ).toThrow();
    },
  );
  it("accepts an RFC integer sign for SEQUENCE", () =>
    expect(
      importICS(
        wrap([
          "DTSTART:20261012T090000Z",
          "DTEND:20261012T100000Z",
          "SEQUENCE:+2",
        ]),
      )[0].sequence,
    ).toBe(2));
  it("rejects injected identity or nonfinite revision on export", () => {
    const event = makeEvent(timed);
    expect(() =>
      exportICS([{ ...event, uid: "evil\r\nBEGIN:VEVENT" }]),
    ).toThrow();
    expect(() => exportICS([{ ...event, sequence: Infinity }])).toThrow();
  });
});
