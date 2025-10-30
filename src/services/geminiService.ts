import { Item, ParsedItem } from '../types';

// These are public keys, safe to include in client-side code.
const SUPABASE_URL = 'https://expwmqozywxbhewaczju.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4cHdtcW96eXd4Ymhld2Fjemp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2Njc5MjksImV4cCI6MjA3NzI0MzkyOX0.Tf0g0yIZ3pd-OcNrmLEdozDt9eT7Fn0Mjlu8BHt1vyg';

const parseItemListWithGemini = async (text: string, existingItems: Item[]): Promise<ParsedItem[]> => {
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/telegram-bot`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                endpoint: '/parse-with-ai',
                text,
                existingItems,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "AI parsing service failed.");
        }

        const data = await response.json();
        return data.parsedItems as ParsedItem[];

    } catch (error) {
        console.error("Error invoking Gemini parsing function:", error);
        throw error;
    }
};

export default parseItemListWithGemini;
