import { describe, expect, it } from "vitest";
import { makeEvent, updateEvent } from "./events";
import { loadEvents, saveEvents, STORAGE_KEY } from "./storage";
import { mergeImported, importICS, exportICS } from "./ics";
const draft = {
  title: "Review",
  description: "",
  location: "",
  allDay: false,
  start: "2026-10-12T09:00",
  end: "2026-10-12T10:00",
  timeZone: "UTC",
  disambiguation: "reject",
};
function store(initial: string | null = null) {
  let content = initial;
  return {
    getItem: (key: string) => {
      if (key !== STORAGE_KEY) throw new Error("Unexpected key access");
      return content;
    },
    setItem: (key: string, data: string) => {
      if (key !== STORAGE_KEY) throw new Error("Unexpected key access");
      content = data;
    },
  };
}
describe("local storage boundary", () => {
  it("starts empty without reading old settings or credentials", () =>
    expect(loadEvents(store())).toEqual({ events: [], error: null }));
  it("round trips validated events and repeated edits", () => {
    const storage = store();
    const event = makeEvent(draft);
    saveEvents(storage, [event]);
    const edited = updateEvent(loadEvents(storage).events[0], {
      ...draft,
      title: "Updated",
    });
    saveEvents(storage, [edited]);
    expect(loadEvents(storage).events[0]).toEqual(edited);
  });
  it.each([
    "{oops",
    "{}",
    '{"version":2,"events":[]}',
    '{"version":1,"events":[{}]}',
  ])("does not crash or overwrite unreadable saved content", (content) => {
    const storage = store(content);
    expect(loadEvents(storage).error).toMatch(/saved|storage/i);
    expect(storage.getItem(STORAGE_KEY)).toBe(content);
  });
  it("reports blocked reads and write quota failures", () => {
    expect(
      loadEvents({
        getItem() {
          throw new Error("Blocked");
        },
      }).error,
    ).toMatch(/storage/i);
    expect(() =>
      saveEvents(
        {
          setItem() {
            throw new Error("Quota");
          },
        },
        [makeEvent(draft)],
      ),
    ).toThrow(/not saved/i);
  });
  it("validates saved schemas and duplicate identities", () => {
    const event = makeEvent(draft);
    expect(() => saveEvents(store(), [{ ...event, title: "" }])).toThrow();
    expect(() => saveEvents(store(), [event, event])).toThrow();
  });
  it("does not overwrite edits when the same ICS is imported repeatedly", () => {
    const first = makeEvent(draft);
    const modified = updateEvent(first, {
      ...draft,
      title: "Newer local title",
    });
    const result = mergeImported([modified], importICS(exportICS([first])));
    expect(result.events).toEqual([modified]);
    expect([result.added, result.skipped]).toEqual([0, 1]);
  });
});
