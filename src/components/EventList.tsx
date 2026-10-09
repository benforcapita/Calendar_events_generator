import {
  Calendar,
  Clock3,
  Download,
  MapPin,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { Temporal } from "@js-temporal/polyfill";
import { type CalendarEvent } from "../domain/events";
function eventWhen(event: CalendarEvent): string {
  if (event.allDay) {
    const last = Temporal.PlainDate.from(event.end)
      .subtract({ days: 1 })
      .toString();
    return event.start === last
      ? `${event.start} · All day`
      : `${event.start} → ${last} · All day`;
  }
  const format = (value: string) =>
    new Intl.DateTimeFormat("en", {
      timeZone: event.timeZone,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(value));
  return `${format(event.start)} → ${format(event.end)}`;
}
interface Props {
  events: CalendarEvent[];
  query: string;
  onQuery: (value: string) => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
  onExport: (events: CalendarEvent[]) => void;
}
export function EventList({
  events,
  query,
  onQuery,
  onEdit,
  onDelete,
  onExport,
}: Props) {
  const visible = events.filter((event) =>
    [event.title, event.description, event.location]
      .join("\n")
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  return (
    <section className="collection" aria-labelledby="collection-title">
      <div className="section-heading">
        <span className="step">02</span>
        <div>
          <p className="eyebrow">READY WHEN YOU ARE</p>
          <h2 id="collection-title">
            Your events <span className="count">{events.length}</span>
          </h2>
        </div>
      </div>
      <div className="search">
        <Search size={18} aria-hidden="true" />
        <input
          aria-label="Search events"
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Find a title, place, or note"
        />
      </div>
      {!visible.length ? (
        <div className="empty panel">
          <div className="empty-icon">
            <Calendar size={31} aria-hidden="true" />
          </div>
          <h3>
            {events.length
              ? "No matching events"
              : "A little space for what’s next"}
          </h3>
          <p>
            {events.length
              ? "Try another search, or clear the search field."
              : "Save your first event on the left. It’ll be ready to edit, keep, or take to your calendar."}
          </p>
          <div className="empty-rule" />
          <span>
            {events.length
              ? `${events.length} saved on this device`
              : "Your plans stay in your browser"}
          </span>
        </div>
      ) : (
        <div className="event-cards">
          {visible.map((event) => (
            <article
              className="event-card panel"
              key={event.id}
              aria-label={event.title}
            >
              <div className="event-top">
                <span className="event-kind">
                  {event.allDay ? "ALL DAY" : "TIMED EVENT"}
                </span>
                <span className="revision">
                  {event.sequence
                    ? `Edited · v${event.sequence + 1}`
                    : "Ready to export"}
                </span>
              </div>
              <h3>{event.title}</h3>
              <p className="event-date">
                <Clock3 size={16} aria-hidden="true" />
                {eventWhen(event)}
              </p>
              {!event.allDay && <p className="zone">{event.timeZone}</p>}
              {event.location && (
                <p className="event-location">
                  <MapPin size={16} aria-hidden="true" />
                  <span>{event.location}</span>
                </p>
              )}
              {event.description && (
                <p className="event-notes">{event.description}</p>
              )}
              <div className="card-actions">
                <button
                  className="button small"
                  onClick={() => onExport([event])}
                >
                  <Download size={15} aria-hidden="true" />
                  Download ICS
                </button>
                <button className="icon-text" onClick={() => onEdit(event)}>
                  <Pencil size={15} aria-hidden="true" />
                  Edit
                </button>
                <button
                  className="icon-text danger"
                  onClick={() => onDelete(event)}
                >
                  <Trash2 size={15} aria-hidden="true" />
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="export-note">
        <span className="note-dot" />
        <p>
          Import ICS files into your calendar app when you’re ready. No
          invitations are sent. Google Calendar limits imports to 1 MB; use
          individual downloads for large collections.
        </p>
      </div>
    </section>
  );
}
