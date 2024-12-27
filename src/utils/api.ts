import { AppSettings, CalendarEvent } from '../types';

interface ApiResponse {
  success: boolean;
  event?: CalendarEvent;
  error?: string;
}

export async function processEventText(text: string, _settings: AppSettings): Promise<ApiResponse> {
  try {
    if (!text.trim()) {
      throw new Error('Please enter some text to create an event');
    }

    // Simple client-side processing
    const eventParts = text.split(',').map(part => part.trim());
    const now = new Date();
    
    const event: CalendarEvent = {
      id: Date.now().toString(),
      title: eventParts[0] || 'Untitled Event',
      startDate: eventParts[1] || now.toISOString(),
      endDate: eventParts[1] || now.toISOString(), // Same as start date if not specified
      description: eventParts[2] || '',
      location: eventParts[3] || '',
      rawInput: text,
      createdAt: now.toISOString()
    };

    return {
      success: true,
      event
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process event'
    };
  }
}