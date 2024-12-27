import React from 'react';
import { CalendarEvent } from '../types';
import { Calendar, Clock, MapPin } from 'lucide-react';

interface EventHistoryProps {
  events: CalendarEvent[];
  onExport: (event: CalendarEvent) => void;
}

export function EventHistory({ events, onExport }: EventHistoryProps) {
  if (events.length === 0) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
        No events created yet. Start by entering an event description above.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <div
          key={event.id}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-md transition-shadow"
        >
          <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">{event.title}</h3>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex items-center gap-2">
              <Calendar size={16} />
              <span>{new Date(event.startDate).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} />
              <span>
                {new Date(event.startDate).toLocaleTimeString()} - 
                {new Date(event.endDate).toLocaleTimeString()}
              </span>
            </div>
            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin size={16} />
                <span>{event.location}</span>
              </div>
            )}
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => onExport(event)}
              className="text-sm px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Export to Calendar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}