import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Calendar as CalendarIcon, Moon, Sun } from 'lucide-react';
import { EventInput } from './components/EventInput';
import { EventHistory } from './components/EventHistory';
import { Settings } from './components/Settings';
import { SearchBar } from './components/SearchBar';
import { storage } from './utils/storage';
import { processEventText } from './utils/ai';
import { downloadICSFile } from './utils/calendar';
import { searchEvents } from './utils/search';
import { AppSettings, CalendarEvent } from './types';
import { useTheme } from './contexts/ThemeContext';

export function App() {
  const { theme, toggleTheme } = useTheme();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [settings, setSettings] = useState<AppSettings>(storage.getSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEvents(storage.getEvents());
  }, []);

  const handleEventSubmit = async (text: string) => {
    setIsProcessing(true);
    setError(null);

    const result = await processEventText(text, settings);
    
    if (result.success && result.event) {
      const newEvent: CalendarEvent = {
        ...result.event,
        id: Date.now().toString(),
        rawInput: text,
        createdAt: new Date().toISOString()
      };
      
      storage.saveEvent(newEvent);
      setEvents(storage.getEvents());
    } else {
      setError(result.error || 'Failed to process event');
    }
    
    setIsProcessing(false);
  };

  const handleExport = (event: CalendarEvent) => {
    downloadICSFile(event);
  };

  const handleSettingsSave = (newSettings: AppSettings) => {
    storage.saveSettings(newSettings);
    setSettings(newSettings);
    setShowSettings(false);
  };

  const filteredEvents = searchQuery ? searchEvents(events, searchQuery) : events;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="h-8 w-8 text-blue-500" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Calendar Event Creator</h1>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {theme === 'dark' ? (
                  <Sun className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                ) : (
                  <Moon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                )}
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <SettingsIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        
        {showSettings ? (
          <Settings settings={settings} onSave={handleSettingsSave} />
        ) : (
          <div className="space-y-8">
            <EventInput onSubmit={handleEventSubmit} isProcessing={isProcessing} />
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
            <EventHistory events={filteredEvents} onExport={handleExport} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;