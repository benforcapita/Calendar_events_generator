import { AppSettings, CalendarEvent } from '../types';

const EVENTS_KEY = 'calendar_events';
const SETTINGS_KEY = 'app_settings';

export const storage = {
  getEvents: (): CalendarEvent[] => {
    const events = localStorage.getItem(EVENTS_KEY);
    return events ? JSON.parse(events) : [];
  },

  saveEvent: (event: CalendarEvent) => {
    const events = storage.getEvents();
    events.unshift(event);
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  },

  getSettings: (): AppSettings => {
    const settings = localStorage.getItem(SETTINGS_KEY);
    return settings ? JSON.parse(settings) : {
      apiProvider: 'openai',
      apiKey: '',
      theme: 'light'
    };
  },

  saveSettings: (settings: AppSettings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
};