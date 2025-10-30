import { SendMessageParams } from '../types';

export const sendTelegramMessage = async ({ botToken, chatId, text, parseMode }: SendMessageParams): Promise<boolean> => {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    // Guard clause to prevent sending empty or whitespace-only messages.
    if (!text || text.trim() === '') {
        console.error("Attempted to send an empty message to Telegram.");
        return false;
    }

    const body: { chat_id: string; text: string; parse_mode?: string } = {
        chat_id: chatId,
        text: text,
    };

    if (parseMode) {
        body.parse_mode = parseMode;
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (data.ok) {
            console.log("Message sent successfully:", data);
            return true;
        } else {
            console.error("Telegram API Error:", data);
            return false;
        }
    } catch (error) {
        console.error("Failed to send Telegram message:", error);
        return false;
    }
};
