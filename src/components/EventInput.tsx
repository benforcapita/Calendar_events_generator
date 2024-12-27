import React, { useState } from 'react';
import { Send } from 'lucide-react';

interface EventInputProps {
  onSubmit: (text: string) => void;
  isProcessing: boolean;
}

export function EventInput({ onSubmit, isProcessing }: EventInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onSubmit(input.trim());
      setInput('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <textarea
          className="w-full p-4 pr-12 rounded-lg border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[120px] resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          placeholder="Enter your event description... (e.g., 'Lunch with John at Cafe Milano next Tuesday at 1pm for 2 hours')"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isProcessing}
        />
        <button
          type="submit"
          disabled={isProcessing || !input.trim()}
          className="absolute right-3 bottom-3 p-2 rounded-full bg-blue-500 text-white disabled:bg-gray-300 dark:disabled:bg-gray-600 hover:bg-blue-600 transition-colors"
        >
          {isProcessing ? (
            <div className="animate-spin w-5 h-5">
              <svg className="w-full h-full text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : (
            <Send size={20} />
          )}
        </button>
      </div>
      {isProcessing && (
        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center animate-pulse">
          Processing with AI...
        </div>
      )}
    </form>
  );
}