import { describe, expect, it } from "vitest";
import { sampleCalendar, sampleEvents, validateCalendar } from "./sampleCalendar";

describe("generated sample calendar", () => {
  it("is a deterministic RFC 5545 file that ICAL.js and the importer accept", () => {
    const text = sampleCalendar();
    const again = sampleCalendar();
    expect(again).toBe(text);
    expect(text).toContain("DTSTART:20261012T130000Z");
    expect(text).toContain("DTEND:20261012T143000Z");
    expect(text).toContain("DTSTART;VALUE=DATE:20261231");
    expect(text).toContain("DTEND;VALUE=DATE:20270103");
    expect(text).not.toMatch(/^(ATTENDEE|ORGANIZER|RRULE|METHOD):/m);

    const report = validateCalendar(text, sampleEvents());
    expect(report).toMatchObject({
      valid: true,
      events: 2,
      version: "2.0",
      prodid: "-//Calendar Events Studio//Local-first 1.0//EN",
      calscale: "GREGORIAN",
      lineEndings: "CRLF",
      summaries: ["Design review", "Offsite"],
      roundTrip: true,
      parser: "ical.js",
    });
    expect(report.maxLineOctets).toBeLessThanOrEqual(75);
    console.log(`ICS validation report\n${JSON.stringify(report, null, 2)}`);
  });
});
