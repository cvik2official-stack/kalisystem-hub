interface SendMessageParams {
    botToken: string;
    chatId: string;
    text: string;
}

export const sendTelegramMessage = async ({ botToken, chatId, text }: SendMessageParams): Promise<boolean> => {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    // Telegram's sendMessage API requires a specific format.
    // We'll use a simplified version of Markdown that Telegram supports.
    const body = {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
    };

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