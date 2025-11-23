
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
        <div className="space-y-4 max-w-3xl">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Webhook Setup</h3>
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        className="flex-grow bg-gray-800 text-white rounded-xl px-4 py-3 outline-none border border-transparent focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                    />
                    <button
                        onClick={handleSetWebhook}
                        disabled={isSavingWebhook}
                        className="px-6 py-3 text-sm font-semibold rounded-xl text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        {isSavingWebhook ? 'Saving...' : 'Set Webhook'}
                    </button>
                </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Telegram Bot API</h3>
                <div className="flex items-center gap-3">
                    <input
                        type="password"
                        value={botToken}
                        onChange={(e) => setBotToken(e.target.value)}
                        className="flex-grow bg-gray-800 text-white rounded-xl px-4 py-3 outline-none border border-transparent focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-mono"
                    />
                    <button
                        onClick={handleSaveBotToken}
                        className="px-6 py-3 text-sm font-semibold rounded-xl text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-400 transition-all"
                    >
                        Save
                    </button>
                </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Gemini API</h3>
                <div className="flex items-center gap-3">
                    <input
                        type="password"
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        className="flex-grow bg-gray-800 text-white rounded-xl px-4 py-3 outline-none border border-transparent focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-mono"
                    />
                    <button
                        onClick={handleSaveGeminiKey}
                        className="px-6 py-3 text-sm font-semibold rounded-xl text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-400 transition-all"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TelegramBotSettings;
