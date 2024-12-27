export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location?: string;
  rawInput: string;
  createdAt: string;
}

export interface AppSettings {
  apiProvider: 'openai' | 'anthropic';
  apiKey: string;
  theme: 'light' | 'dark';
}

export interface AIProcessingResult {
  success: boolean;
  event?: Omit<CalendarEvent, 'id' | 'createdAt' | 'rawInput'>;
  error?: string;
}