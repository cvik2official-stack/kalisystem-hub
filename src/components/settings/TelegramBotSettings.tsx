import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../context/AppContext';
import { useNotifier } from '../../context/NotificationContext';
import { setWebhook } from '../../services/telegramService';

const TelegramBotSettings: React.FC = () => {
    const { state, dispatch } = useContext(AppContext);
    const { notify } = useNotifier();
    const [webhookUrl, setWebhookUrl] = useState('');
    const [geminiKey, setGeminiKey] = useState('');
    const [botToken, setBotToken] = useState('');
    const [isSavingWebhook, setIsSavingWebhook] = useState(false);

    useEffect(() => {
        setGeminiKey(state.settings.geminiApiKey || '');
        setBotToken(state.settings.telegramBotToken || '');
    }, [state.settings.geminiApiKey, state.settings.telegramBotToken]);

    const handleSetWebhook = async () => {
        const { telegramBotToken } = state.settings;
        if (!telegramBotToken) {
            notify('Telegram Bot Token is not set in settings.', 'error');
            return;
        }
        if (!webhookUrl.trim() || !webhookUrl.startsWith('https://')) {
            notify('Please enter a valid HTTPS URL for the webhook.', 'error');
            return;
        }
        setIsSavingWebhook(true);
        try {
            await setWebhook(webhookUrl.trim(), telegramBotToken);
            notify('Webhook set successfully!', 'success');
        } catch (e: any) {
            notify(`Failed to set webhook: ${e.message}`, 'error');
        } finally {
            setIsSavingWebhook(false);
        }
    };

    const handleSaveGeminiKey = () => {
        dispatch({ type: 'SAVE_SETTINGS', payload: { geminiApiKey: geminiKey.trim() } });
        notify('Gemini API Key saved.', 'success');
    };

    const handleSaveBotToken = () => {
        dispatch({ type: 'SAVE_SETTINGS', payload: { telegramBotToken: botToken.trim() } });
        notify('Telegram Bot Token saved.', 'success');
    };
    
    return (
        <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-2">Webhook Setup</h3>
                <p className="text-sm text-gray-400 mb-4">
                    Enter the URL of your Supabase Edge Function to receive bot interactions.
                </p>
                <div className="flex items-center space-x-2 max-w-2xl">
                    <input
                        type="text"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        className="flex-grow bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                        placeholder="https://your-supabase-url.co/functions/v1/telegram-bot"
                    />
                    <button
                        onClick={handleSetWebhook}
                        disabled={isSavingWebhook}
                        className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-800 disabled:cursor-wait"
                    >
                        {isSavingWebhook ? 'Saving...' : 'Set Webhook'}
                    </button>
                </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Telegram Bot API</h3>
                <div className="flex items-center space-x-2 max-w-2xl">
                    <input
                        type="password"
                        value={botToken}
                        onChange={(e) => setBotToken(e.target.value)}
                        className="flex-grow bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                        onClick={handleSaveBotToken}
                        className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        Save
                    </button>
                </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Gemini API</h3>
                <div className="flex items-center space-x-2 max-w-2xl">
                    <input
                        type="password"
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        className="flex-grow bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                        onClick={handleSaveGeminiKey}
                        className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TelegramBotSettings;