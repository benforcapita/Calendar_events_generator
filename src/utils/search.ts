import { CalendarEvent } from '../types';

export function searchEvents(events: CalendarEvent[], query: string): CalendarEvent[] {
  const searchTerms = query.toLowerCase().split(' ');
  
  return events.filter(event => {
    const searchableText = [
      event.title,
      event.description,
      event.location,
      new Date(event.startDate).toLocaleDateString(),
      new Date(event.endDate).toLocaleDateString()
    ].join(' ').toLowerCase();

    return searchTerms.every(term => searchableText.includes(term));
  });
}