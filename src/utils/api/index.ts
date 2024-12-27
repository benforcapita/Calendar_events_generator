import { AppSettings, AIProcessingResult } from '../../types';
import { openAIProvider } from './openai';
import { anthropicProvider } from './anthropic';

const providers = {
  openai: openAIProvider,
  anthropic: anthropicProvider
};

export async function processEventText(text: string, settings: AppSettings): Promise<AIProcessingResult> {
  try {
    const provider = providers[settings.apiProvider];
    if (!provider) {
      throw new Error('Invalid API provider');
    }

    const prompt = `Extract event details from this text: "${text}"
      Return a JSON object with:
      - title: A clear, concise event title
      - description: Full event description
      - startDate: ISO date string
      - endDate: ISO date string
      - location: Location if mentioned (optional)`;

    const event = await provider.processEvent(prompt, settings.apiKey);

    return {
      success: true,
      event
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process request'
    };
  }
}