import { CalendarEvent } from '../../types';

export type EventData = Omit<CalendarEvent, 'id' | 'createdAt' | 'rawInput'>;

export interface AIProvider {
  processEvent: (prompt: string, apiKey: string) => Promise<EventData>;
}