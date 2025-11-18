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
            notify('Telegram Bot Token is not set in settings.', 'error');
            return;
        }
        if (!webhookUrl.trim() || !webhookUrl.startsWith('https://')) {
            notify('Please enter a valid HTTPS URL for the webhook.', 'error');
            return;
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
         <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
            <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-2xl border-t-4 border-indigo-500" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} disabled={isSaving} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <h2 className="text-xl font-bold text-white mb-4">Webhook Setup</h2>
                <div className="flex items-center space-x-2">
                    <input
                        type="text"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        className="flex-grow bg-gray-900 text-gray-200 rounded-md p-2 outline-none"
                        autoFocus
                    />
                    <button
                        onClick={handleSetWebhook}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-800 disabled:cursor-wait"
                    >
                        {isSaving ? 'Saving...' : 'Set Webhook'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TelegramWebhookModal;