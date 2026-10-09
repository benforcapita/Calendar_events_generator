import { type FormEvent } from "react";
import { ArrowRight, CalendarDays } from "lucide-react";
import { type Disambiguation, type EventDraft } from "../domain/events";
interface Props {
  draft: EventDraft;
  editing: boolean;
  onChange: (next: EventDraft) => void;
  onSave: (event: FormEvent) => void;
  onCancel: () => void;
  error: string | null;
}
export function EventEditor({
  draft,
  editing,
  onChange,
  onSave,
  onCancel,
  error,
}: Props) {
  const field = (key: keyof EventDraft, value: string | boolean) =>
    onChange({ ...draft, [key]: value });
  return (
    <section className="panel editor" aria-labelledby="editor-title">
      <div className="section-heading">
        <span className="step">01</span>
        <div>
          <p className="eyebrow">THE DETAILS</p>
          <h2 id="editor-title">
            {editing ? "Edit your event" : "Make time for it"}
          </h2>
        </div>
        <CalendarDays size={24} aria-hidden="true" />
      </div>
      <form onSubmit={onSave} noValidate>
        <label>
          Event title
          <input
            autoComplete="off"
            id="event-title"
            value={draft.title}
            maxLength={300}
            placeholder="Something worth putting on the calendar"
            onChange={(e) => field("title", e.target.value)}
          />
        </label>
        <div className="kind-picker">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={draft.allDay}
              onChange={(e) => {
                const allDay = e.target.checked;
                onChange({
                  ...draft,
                  allDay,
                  start: allDay
                    ? draft.start.slice(0, 10)
                    : draft.start + "T09:00",
                  end: allDay ? draft.end.slice(0, 10) : draft.end + "T10:00",
                  disambiguation: "reject",
                  endDisambiguation: "reject",
                });
              }}
            />{" "}
            All-day event
          </label>
          <span>
            {draft.allDay
              ? "Dates only, everywhere"
              : "A specific time & place"}
          </span>
        </div>
        <div className="field-pair">
          <label>
            {draft.allDay ? "Start date" : "Start date and time"}
            <input
              type={draft.allDay ? "date" : "datetime-local"}
              step={draft.allDay ? undefined : 1}
              value={draft.start}
              onChange={(e) =>
                onChange({
                  ...draft,
                  start: e.target.value,
                  disambiguation: "reject",
                })
              }
            />
          </label>
          <label>
            {draft.allDay ? "Last day (included)" : "End date and time"}
            <input
              type={draft.allDay ? "date" : "datetime-local"}
              step={draft.allDay ? undefined : 1}
              value={draft.end}
              onChange={(e) =>
                onChange({
                  ...draft,
                  end: e.target.value,
                  endDisambiguation: "reject",
                })
              }
            />
          </label>
        </div>
        {draft.allDay ? (
          <p className="field-help">
            A one-day event uses the same start and last day. We handle the
            calendar file’s exclusive end date.
          </p>
        ) : (
          <>
            <label>
              Time zone
              <input
                list="time-zones"
                autoComplete="off"
                value={draft.timeZone}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    timeZone: e.target.value,
                    disambiguation: "reject",
                    endDisambiguation: "reject",
                  })
                }
                placeholder="Europe/London"
              />
            </label>
            <datalist id="time-zones">
              {[
                "UTC",
                "America/New_York",
                "America/Los_Angeles",
                "Europe/London",
                "Europe/Paris",
                "Asia/Jerusalem",
                "Asia/Tokyo",
                "Asia/Kolkata",
                "Asia/Kathmandu",
                "Australia/Sydney",
              ].map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
            <p className="field-help">
              Use an IANA name. Exports keep the exact instant, so calendar apps
              can display their own local time.
            </p>
            <details className="dst-options">
              <summary>Daylight-saving time options</summary>
              <p className="field-help">
                If the clock repeats a time, choose its occurrence for each
                endpoint. Times skipped by the clock are always rejected.
              </p>
              <div className="field-pair">
                {(["disambiguation", "endDisambiguation"] as const).map(
                  (key, index) => (
                    <label key={key}>
                      {index ? "End occurrence" : "Start occurrence"}
                      <select
                        value={draft[key] ?? "reject"}
                        onChange={(e) =>
                          field(key, e.target.value as Disambiguation)
                        }
                      >
                        <option value="reject">Ask if repeated</option>
                        <option value="earlier">First occurrence</option>
                        <option value="later">Second occurrence</option>
                      </select>
                    </label>
                  ),
                )}
              </div>
            </details>
          </>
        )}
        <label>
          Location <span className="optional">optional</span>
          <input
            value={draft.location}
            maxLength={1000}
            placeholder="A room, an address, or a meeting link"
            onChange={(e) => field("location", e.target.value)}
          />
        </label>
        <label>
          Notes <span className="optional">optional</span>
          <textarea
            value={draft.description}
            maxLength={20000}
            rows={3}
            placeholder="The little things you’ll want to remember"
            onChange={(e) => field("description", e.target.value)}
          />
        </label>
        {error && (
          <p className="error" role="alert" id="editor-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button className="button primary" type="submit">
            {editing ? "Save changes" : "Save event"}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <button className="button quiet" type="button" onClick={onCancel}>
            {editing ? "Cancel editing" : "Clear draft"}
          </button>
        </div>
      </form>
    </section>
  );
}
