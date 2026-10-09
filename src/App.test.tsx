import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { STORAGE_KEY } from "./domain/storage";
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
async function fillSample() {
  await userEvent.click(screen.getByRole("button", { name: "Try an example" }));
}
describe("event editor", () => {
  it("creates, repeatedly edits, searches, cancels and deletes with undo", async () => {
    render(<App />);
    await fillSample();
    await userEvent.click(screen.getByRole("button", { name: "Save event" }));
    let card = screen.getByRole("article", { name: "Design review" });
    await userEvent.click(within(card).getByRole("button", { name: "Edit" }));
    const title = screen.getByLabelText("Event title");
    fireEvent.change(title, { target: { value: "Edited review" } });
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    card = screen.getByRole("article", { name: "Edited review" });
    await userEvent.click(within(card).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Event title"), {
      target: { value: "Discard this" },
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await userEvent.click(
      screen.getByRole("button", { name: "Cancel editing" }),
    );
    expect(screen.queryByRole("article", { name: "Discard this" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Search events"), {
      target: { value: "nothing matches" },
    });
    expect(screen.getByText("No matching events")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search events"), {
      target: { value: "" },
    });
    await userEvent.click(
      within(screen.getByRole("article", { name: "Edited review" })).getByRole(
        "button",
        { name: "Delete" },
      ),
    );
    expect(screen.queryByRole("article", { name: "Edited review" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Undo delete" }));
    expect(screen.getByRole("article", { name: "Edited review" })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).events).toHaveLength(
      1,
    );
  });
  it("survives a remount with saved events", async () => {
    const first = render(<App />);
    await fillSample();
    await userEvent.click(screen.getByRole("button", { name: "Save event" }));
    first.unmount();
    render(<App />);
    expect(screen.getByRole("article", { name: "Design review" })).toBeTruthy();
  });
  it("explains invalid input without saving it", async () => {
    render(<App />);
    await fillSample();
    fireEvent.change(screen.getByLabelText("End date and time"), {
      target: { value: "2026-10-11T10:00" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Save event" }));
    expect(screen.getByRole("alert").textContent).toMatch(/after the start/i);
    expect(screen.queryByRole("article")).toBeNull();
  });
  it("parses explicit text into a reviewable draft rather than saving silently", async () => {
    render(<App />);
    await userEvent.click(screen.getByText("Start from structured text"));
    fireEvent.change(screen.getByLabelText("Structured event text"), {
      target: { value: "Trip | 2026-12-31..2027-01-02 | all-day" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Fill editor" }));
    expect(
      (screen.getByLabelText("Event title") as HTMLInputElement).value,
    ).toBe("Trip");
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.getByText(/External AI is not configured/i)).toBeTruthy();
  });
  it("does not overwrite corrupt storage when working in memory", async () => {
    localStorage.setItem(STORAGE_KEY, "{corrupt");
    render(<App />);
    await fillSample();
    await userEvent.click(screen.getByRole("button", { name: "Save event" }));
    expect(screen.getByRole("article", { name: "Design review" })).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("{corrupt");
    expect(screen.getByText(/Existing data is untouched/i)).toBeTruthy();
  });
  it("keeps rejected discard intact", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Event title"), {
      target: { value: "Unfinished draft" },
    });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await fillSample();
    expect(
      (screen.getByLabelText("Event title") as HTMLInputElement).value,
    ).toBe("Unfinished draft");
  });
});
