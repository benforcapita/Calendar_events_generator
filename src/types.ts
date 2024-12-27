export interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  description: string;
  location: string;
  rawInput: string;
  createdAt: string;
}

export interface AppSettings {
  apiProvider: string;
  apiKey: string;
  theme: 'light' | 'dark';
}

export type Theme = 'light' | 'dark';
