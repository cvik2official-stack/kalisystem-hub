
import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import { useNotifier } from '../../context/NotificationContext';
import { setWebhook } from '../../services/telegramService';

interface TelegramWebhookModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const TelegramWebhookModal: React.FC<TelegramWebhookModalProps> = ({ isOpen, onClose }) => {
    const { state } = useContext(AppContext);
    const { notify } = useNotifier();
    const [webhookUrl, setWebhookUrl] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSetWebhook = async () => {
        const { telegramBotToken } = state.settings;
        if (!telegramBotToken) {
            notify('Telegram Bot Token is not set in settings.', 'error'); return;
        }
        if (!webhookUrl.trim() || !webhookUrl.startsWith('https://')) {
            notify('Please enter a valid HTTPS URL.', 'error'); return;
        }
        setIsSaving(true);
        try {
            await setWebhook(webhookUrl.trim(), telegramBotToken);
            notify('Webhook set successfully!', 'success');
            onClose();
        } catch (e: any) {
            notify(`Failed to set webhook: ${e.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    if (!isOpen) return null;

    return (
         <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
            <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
                
                <div className="px-5 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                    <h2 className="text-lg font-bold text-white">Webhook Setup</h2>
                    <button onClick={onClose} disabled={isSaving} className="text-gray-500 hover:text-white transition-colors p-1 bg-gray-800 rounded-full hover:bg-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-400">Enter your Supabase Edge Function URL to enable interactive bot features.</p>
                    <div className="flex items-center space-x-3">
                        <input
                            type="text"
                            value={webhookUrl}
                            onChange={(e) => setWebhookUrl(e.target.value)}
                            className="flex-grow bg-gray-800 text-white rounded-xl px-4 py-3 outline-none border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-gray-600"
                            placeholder="https://..."
                            autoFocus
                        />
                        <button
                            onClick={handleSetWebhook}
                            disabled={isSaving}
                            className="px-6 py-3 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-gray-800 disabled:text-gray-500 shadow-lg shadow-indigo-900/20 transition-all whitespace-nowrap"
                        >
                            {isSaving ? 'Setting...' : 'Set Webhook'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TelegramWebhookModal;
