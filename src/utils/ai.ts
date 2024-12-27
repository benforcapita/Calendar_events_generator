import type { AppSettings, AIProcessingResult } from '../types/index';
import Anthropic from '@anthropic-ai/sdk';

export async function processEventText(text: string, settings: AppSettings): Promise<AIProcessingResult> {
  try {
    const now = new Date();
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    const prompt = `Current date and time: ${now.toISOString()}
User timezone: ${userTimezone}
User input: "${text}"

Extract event details and return a JSON object. For dates:
- Use the current date and time as reference
- "tomorrow" refers to the next day from current date
- Times should be in the user's timezone
- Return dates in ISO format with the correct timezone offset

Required JSON format:
{
  "title": "Clear, concise event title",
  "description": "Full event description",
  "startDate": "ISO date string with correct timezone",
  "endDate": "ISO date string with correct timezone",
  "location": "Location if mentioned (optional)"
}`;

    if (settings.apiProvider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4-1106-preview',
          messages: [
            {
              role: 'system',
              content: 'You are a calendar assistant that extracts event details from text and returns them in JSON format. Always use the current date and time as reference for relative dates like "tomorrow" or "next week".'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'OpenAI API error');
      
      console.log('OpenAI Response:', data);
      return {
        success: true,
        event: JSON.parse(data.choices[0].message.content)
      };
    } else {
      const anthropic = new Anthropic({
        apiKey: settings.apiKey,
        dangerouslyAllowBrowser: true
      });

      const message = await anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: prompt
        }],
        system: "You are a calendar assistant that extracts event details from text and returns them in JSON format. Always use the current date and time as reference for relative dates like 'tomorrow' or 'next week'."
      });

      console.log('Anthropic Response:', message);
      
      const contentStr = message.content[0].toString();
      let eventData;
      try {
        eventData = JSON.parse(contentStr);
      } catch {
        const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          eventData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Failed to parse AI response as JSON');
        }
      }
      
      return {
        success: true,
        event: eventData
      };
    }
  } catch (error) {
    console.error('AI Processing Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process event'
    };
  }
}