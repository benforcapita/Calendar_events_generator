import { AIProvider } from './types';

export const anthropicProvider: AIProvider = {
  async processEvent(prompt: string, apiKey: string) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-opus-20240229',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Anthropic API error');
      }

      return JSON.parse(data.content[0].text);
    } catch (error) {
      if (error instanceof Error && error.message.includes('CORS')) {
        throw new Error('CORS error: Please check your API key and try again');
      }
      throw error;
    }
  }
};