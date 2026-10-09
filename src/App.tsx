import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Download,
  FileUp,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { EventEditor } from "./components/EventEditor";
import { EventList } from "./components/EventList";
import {
  blankDraft,
  type CalendarEvent,
  type EventDraft,
  makeEvent,
  MAX_EVENTS,
  parseStructuredText,
  toDraft,
  updateEvent,
} from "./domain/events";
import {
  exportICS,
  importICS,
  MAX_ICS_BYTES,
  mergeImported,
} from "./domain/ics";
import { loadBrowserEvents, saveEvents, STORAGE_KEY } from "./domain/storage";
const SAMPLE =
  "Design review | 2026-10-12 | 09:00-10:30 | America/New_York | Studio 2";
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Your existing events are unchanged.";
}
export function App() {
  const [initial] = useState(loadBrowserEvents);
  const [events, setEvents] = useState(initial.events);
  const [storageWarning, setStorageWarning] = useState(initial.error);
  const [readOnlyStorage, setReadOnlyStorage] = useState(!!initial.error);
  const [draft, setDraft] = useState(blankDraft);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [deleted, setDeleted] = useState<CalendarEvent | null>(null);
  const [pendingImport, setPendingImport] = useState<CalendarEvent[] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty || storageWarning) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    // Another tab must not silently clobber an open editor's newer changes.
    const changed = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        setReadOnlyStorage(true);
        setStorageWarning(
          "Saved events changed in another tab. This tab will not overwrite them. Download any new work, then reload to see the latest saved events.",
        );
      }
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("storage", changed);
    };
  }, [dirty, storageWarning]);
  function persist(next: CalendarEvent[]) {
    if (!readOnlyStorage) {
      try {
        saveEvents(window.localStorage, next);
        setStorageWarning(null);
      } catch (failure) {
        setStorageWarning(message(failure));
      }
    }
    setEvents(next);
  }
  function canDiscard() {
    return (
      !dirty || window.confirm("Discard the unsaved changes in the editor?")
    );
  }
  function changeDraft(next: EventDraft) {
    setDraft(next);
    setDirty(true);
    setError(null);
  }
  function reset() {
    setDraft(blankDraft());
    setEditing(null);
    setDirty(false);
    setError(null);
  }
  function focusEditor() {
    document.getElementById("event-title")?.focus();
  }
  function loadDraft(next: EventDraft, event: CalendarEvent | null = null) {
    if (!canDiscard()) return;
    setDraft(next);
    setEditing(event);
    setDirty(!event);
    setError(null);
    focusEditor();
  }
  function save(event: FormEvent) {
    event.preventDefault();
    try {
      if (!editing && events.length >= MAX_EVENTS)
        throw new Error(
          `You can save up to ${MAX_EVENTS} events. Export a backup, then remove some events.`,
        );
      const saved = editing ? updateEvent(editing, draft) : makeEvent(draft);
      persist(
        editing
          ? events.map((e) => (e.id === editing.id ? saved : e))
          : [saved, ...events],
      );
      setNotice(
        editing
          ? "Event updated."
          : "Event added. Download it whenever you’re ready.",
      );
      setDeleted(null);
      reset();
    } catch (failure) {
      setError(message(failure));
    }
  }
  function download(items: CalendarEvent[]) {
    try {
      const content = exportICS(items);
      const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        items.length === 1
          ? `${items[0].title.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 70) || "event"}.ics`
          : "calendar-events.ics";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      setNotice(
        "ICS download started. Import the file into your calendar to add the events.",
      );
    } catch (failure) {
      setNotice(message(failure));
    }
  }
  async function readImport(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    setPendingImport(null);
    try {
      if (file.size > MAX_ICS_BYTES)
        throw new Error("Choose an ICS file smaller than 40 MB.");
      setPendingImport(importICS(await file.text()));
      setNotice("Review the import below. Your saved events have not changed.");
    } catch (failure) {
      setNotice(message(failure));
    } finally {
      setLoading(false);
      if (importInput.current) importInput.current.value = "";
    }
  }
  function confirmImport() {
    if (!pendingImport) return;
    try {
      const result = mergeImported(events, pendingImport);
      persist(result.events);
      setNotice(
        `Imported ${result.added} event${result.added === 1 ? "" : "s"}. ${result.skipped} existing UID${result.skipped === 1 ? "" : "s"} skipped; your edits are preserved.`,
      );
      setPendingImport(null);
      setDeleted(null);
    } catch (failure) {
      setNotice(message(failure));
    }
  }
  function remove(event: CalendarEvent) {
    if (editing?.id === event.id && !canDiscard()) return;
    persist(events.filter((e) => e.id !== event.id));
    setDeleted(event);
    setNotice(
      `Deleted “${event.title}”. You can undo this deletion until your next save, import, or delete.`,
    );
    if (editing?.id === event.id) reset();
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#main">
          <span className="brand-icon">
            <CalendarDays size={22} aria-hidden="true" />
          </span>
          <span>
            Calendar<span className="brand-light"> / studio</span>
          </span>
        </a>
        <span className="private-badge">
          <LockKeyhole size={14} aria-hidden="true" />
          LOCAL-FIRST
        </span>
      </header>
      <main id="main">
        <section className="hero">
          <div>
            <p className="eyebrow">
              <span className="tiny-line" /> FROM A PLAN TO YOUR CALENDAR
            </p>
            <h1>
              Good plans deserve
              <br />a place on the calendar<span className="accent">.</span>
            </h1>
            <p className="hero-description">
              Gather the details. Make them yours. Take a clean calendar file
              anywhere, without connecting an account.
            </p>
            <button
              className="text-button"
              onClick={() => loadDraft(parseStructuredText(SAMPLE))}
            >
              Try an example
              <ArrowUpRight size={17} aria-hidden="true" />
            </button>
          </div>
          <div className="hero-aside" aria-hidden="true">
            <div className="paper-date">
              <div>MAKE A LITTLE TIME</div>
              <span>→</span>
              <p>for what matters.</p>
            </div>
            <span className="hero-caption">Your schedule. Your device.</span>
          </div>
        </section>
        <div className="workspace-toolbar">
          <div className="local-status">
            <span className="status-dot" />
            {storageWarning ? "Working in this tab" : "Saved on this device"}
            <span className="toolbar-note">No account needed</span>
          </div>
          <div className="toolbar-actions">
            <button
              className="button small"
              disabled={loading}
              onClick={() => importInput.current?.click()}
            >
              <FileUp size={16} aria-hidden="true" />
              {loading ? "Reading file…" : "Import ICS"}
            </button>
            <input
              className="visually-hidden"
              ref={importInput}
              type="file"
              accept=".ics,text/calendar"
              aria-label="Import calendar file"
              onChange={(e) => void readImport(e.target.files?.[0])}
            />
            <button
              className="button small dark"
              disabled={!events.length}
              onClick={() => download(events)}
            >
              <Download size={16} aria-hidden="true" />
              Export all
            </button>
          </div>
        </div>
        {storageWarning && (
          <div className="warning" role="alert">
            {storageWarning}
          </div>
        )}
        <div
          className={`notice ${notice ? "shown" : ""}`}
          role="status"
          aria-live="polite"
        >
          {notice}
          {deleted && (
            <button
              className="text-button"
              onClick={() => {
                if (events.length >= MAX_EVENTS) {
                  setNotice("Remove an event before restoring this deletion.");
                  return;
                }
                persist([deleted, ...events]);
                setDeleted(null);
                setNotice("Event restored.");
              }}
            >
              Undo delete
            </button>
          )}
        </div>
        {pendingImport && (
          <section className="import-review panel" aria-label="Review import">
            <h2>
              Bring in {pendingImport.length} event
              {pendingImport.length === 1 ? "" : "s"}?
            </h2>
            <p>
              Existing UIDs are skipped, so importing again won’t overwrite your
              edits.
            </p>
            <ul>
              {pendingImport.slice(0, 5).map((event) => (
                <li key={event.id}>{event.title}</li>
              ))}
            </ul>
            {pendingImport.length > 5 && (
              <p>And {pendingImport.length - 5} more.</p>
            )}
            <div className="form-actions">
              <button className="button primary" onClick={confirmImport}>
                Add imported events
              </button>
              <button
                className="button quiet"
                onClick={() => {
                  setPendingImport(null);
                  setNotice("Import cancelled. No events were added.");
                }}
              >
                Cancel import
              </button>
            </div>
          </section>
        )}
        <details className="structured panel">
          <summary>
            <Sparkles size={18} aria-hidden="true" />
            Start from structured text<span>A shortcut for clear details</span>
          </summary>
          <div className="structured-body">
            <p>
              This local parser reads the explicit format below. It doesn’t
              guess dates, relative phrases, or arbitrary natural language.
              External AI is not configured.
            </p>
            <label>
              Structured event text
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={SAMPLE}
                rows={2}
              />
            </label>
            <p className="format-example">
              Title | YYYY-MM-DD | HH:MM-HH:MM | IANA time zone | Location
            </p>
            <p className="field-help">
              Zone and location are optional; the default zone is UTC. For date
              ranges: Offsite | 2026-12-31..2027-01-02 | all-day
            </p>
            <button
              className="button small"
              onClick={() => {
                try {
                  const next = parseStructuredText(text);
                  if (!canDiscard()) return;
                  setDraft(next);
                  setDirty(true);
                  setEditing(null);
                  setError(null);
                  setNotice("Details filled. Review the editor, then save.");
                  focusEditor();
                } catch (failure) {
                  setNotice(message(failure));
                }
              }}
            >
              Fill editor
            </button>
          </div>
        </details>
        <div className="workspace">
          <EventEditor
            draft={draft}
            editing={!!editing}
            onChange={changeDraft}
            onSave={save}
            onCancel={() => {
              if (canDiscard()) reset();
            }}
            error={error}
          />
          <EventList
            events={events}
            query={query}
            onQuery={setQuery}
            onEdit={(event) => loadDraft(toDraft(event), event)}
            onDelete={remove}
            onExport={download}
          />
        </div>
        <footer>
          <div className="footer-brand">
            <CalendarDays size={18} aria-hidden="true" /> Calendar / studio
          </div>
          <p>Private by design. Portable by default.</p>
          <details>
            <summary>Privacy & file compatibility</summary>
            <p>
              Event text stays in this browser. Saved events are not encrypted
              and can be read by other users of this browser profile. Keep ICS
              backups; clearing site data removes saved events.
            </p>
            <p>
              No AI service, analytics, account connection, or calendar
              invitations. Old provider settings and API keys are never read. If
              you used an older version, remove its saved credentials through
              your browser’s site-data controls.
            </p>
            <p>
              ICS import supports standalone events with UTC or explicit IANA
              timezone dates, or all-day dates. It rejects invitations,
              recurring events, alarms, custom timezone definitions, floating
              times, and unsupported properties, rather than quietly dropping
              them. Exported files use UTC for timed events and preserve all-day
              boundaries.
            </p>
          </details>
        </footer>
      </main>
    </div>
  );
}
export default App;
