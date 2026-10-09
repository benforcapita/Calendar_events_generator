import { describe, expect, it } from "vitest";
import { makeEvent, parseStructuredText, updateEvent } from "./events";
const draft = {
  title: "Design review",
  description: "",
  location: "",
  allDay: false,
  start: "2026-10-12T09:00",
  end: "2026-10-12T10:00",
  timeZone: "America/New_York",
  disambiguation: "reject",
};
describe("event validation", () => {
  it("converts an explicit local timezone into absolute instants", () => {
    const e = makeEvent(draft);
    expect(e.start).toBe("2026-10-12T13:00:00Z");
    expect(e.end).toBe("2026-10-12T14:00:00Z");
    expect(e.timeZone).toBe("America/New_York");
  });
  it.each([
    "2026-02-29T09:00",
    "2026-04-31T09:00",
    "2026-10-12T25:00",
    "2026-10-12T09:00:60",
    "2026-10-12",
    "tomorrow",
  ])("rejects invalid local date %s", (start) =>
    expect(() => makeEvent({ ...draft, start })).toThrow(/date|time/i),
  );
  it("rejects equal or reversed end times", () => {
    expect(() => makeEvent({ ...draft, end: draft.start })).toThrow(/after/i);
    expect(() => makeEvent({ ...draft, end: "2026-10-11T09:00" })).toThrow(
      /after/i,
    );
  });
  it("rejects a nonexistent DST time even when an overlap choice is requested", () => {
    for (const disambiguation of ["reject", "earlier", "later"])
      expect(() =>
        makeEvent({
          ...draft,
          start: "2026-03-08T02:30",
          end: "2026-03-08T04:00",
          disambiguation,
        }),
      ).toThrow(/does not exist/i);
  });
  it("requires an explicit choice for repeated DST time", () => {
    const repeated = {
      ...draft,
      start: "2026-11-01T01:30",
      end: "2026-11-01T02:30",
    };
    expect(() => makeEvent(repeated)).toThrow(/occurs twice/i);
    expect(makeEvent({ ...repeated, disambiguation: "earlier" }).start).toBe(
      "2026-11-01T05:30:00Z",
    );
    expect(makeEvent({ ...repeated, disambiguation: "later" }).start).toBe(
      "2026-11-01T06:30:00Z",
    );
  });
  it("handles non-hour offsets and DST duration", () => {
    expect(makeEvent({ ...draft, timeZone: "Asia/Kathmandu" }).start).toBe(
      "2026-10-12T03:15:00Z",
    );
    const event = makeEvent({
      ...draft,
      start: "2026-03-08T01:30",
      end: "2026-03-08T03:30",
    });
    expect(Date.parse(event.end) - Date.parse(event.start)).toBe(3600000);
  });
  it("keeps all-day dates and converts inclusive last day to exclusive end", () => {
    const e = makeEvent({
      ...draft,
      allDay: true,
      start: "2028-02-29",
      end: "2028-02-29",
    });
    expect([e.start, e.end]).toEqual(["2028-02-29", "2028-03-01"]);
    expect(
      makeEvent({
        ...draft,
        allDay: true,
        start: "2026-12-31",
        end: "2027-01-01",
      }).end,
    ).toBe("2027-01-02");
  });
  it("rejects invalid schemas and time zones", () => {
    for (const change of [
      { title: " " },
      { timeZone: "Mars/Olympus" },
      { title: 12 },
      { allDay: "yes" },
      { disambiguation: "random" },
      { description: "x".repeat(20001) },
    ])
      expect(() => makeEvent({ ...draft, ...change })).toThrow();
  });
  it("preserves identity and increments sequence over repeated edits", () => {
    const first = makeEvent(draft);
    const second = updateEvent(first, { ...draft, title: "Edited" });
    const third = updateEvent(second, { ...draft, title: "Edited again" });
    expect(third.id).toBe(first.id);
    expect(third.uid).toBe(first.uid);
    expect(third.sequence).toBe(2);
    expect(third.title).toBe("Edited again");
  });
});
describe("honest local parsing", () => {
  it("parses only an explicit title/date/range with optional IANA zone and place", () => {
    const e = parseStructuredText(
      "Design review | 2026-10-12 | 09:00-10:30 | America/New_York | Studio 2",
    );
    expect(e.title).toBe("Design review");
    expect(e.start).toBe("2026-10-12T09:00");
    expect(e.location).toBe("Studio 2");
  });
  it("supports date-only all-day ranges", () =>
    expect(
      parseStructuredText("Offsite | 2026-12-31..2027-01-02 | all-day").end,
    ).toBe("2027-01-02"));
  it.each([
    "Meet tomorrow at lunch",
    "Review | 12/10/26 | 9-10",
    "Review | 2026-02-29 | 09:00-10:00",
    "Review | 2026-10-12 | 10:00-09:00",
    "Review | 2026-10-12 | 09:00-10:00 | UTC | Office | surprise",
  ])("does not guess unsupported input %s", (text) =>
    expect(() => parseStructuredText(text)).toThrow(),
  );
});
