
import React, { useState, useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { useNotifier } from '../../context/NotificationContext';
import { SupplierName } from '../../types';
import { sendCustomMessageToSupplier } from '../../services/telegramService';

interface StaffFoodModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const StaffFoodModal: React.FC<StaffFoodModalProps> = ({ isOpen, onClose }) => {
  const { state } = useContext(AppContext);
  const { notify } = useNotifier();
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!text.trim()) return;
    const piseySupplier = state.suppliers.find(s => s.name === SupplierName.PISEY);
    if (!piseySupplier) { notify('Supplier "PISEY" not found.', 'error'); return; }
    if (!state.settings.telegramBotToken || !piseySupplier.chatId) { notify('Bot token or PISEY chat ID missing.', 'error'); return; }

    setIsSending(true);
    try {
        const message = `<b>Staff Food Order for ${state.activeStore}</b>\n\n${text.trim()}`;
        await sendCustomMessageToSupplier(piseySupplier, message, state.settings.telegramBotToken);
        notify('Staff food list sent to PISEY.', 'success');
        setText('');
        onClose();
    } catch (e: any) {
        notify(`Failed to send: ${e.message}`, 'error');
    } finally {
        setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" onClick={(e) => e.stopPropagation()}>
        
        <div className="px-5 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
            <div className="flex items-center space-x-3">
                <div className="w-2 h-8 rounded-full bg-pink-500 flex-shrink-0"></div>
                <h2 className="text-lg font-bold text-white">Staff Food</h2>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 bg-gray-800 rounded-full hover:bg-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
        
        <div className="p-5 flex flex-col space-y-4">
            <p className="text-sm text-gray-400">Items below will be sent directly to PISEY.</p>
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full h-48 bg-gray-800 text-white rounded-xl p-4 outline-none border border-transparent focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm placeholder-gray-500 resize-none font-medium"
                placeholder="e.g. 3x Fried Rice..."
                autoFocus
            />
            <div className="flex justify-end pt-2">
                <button
                    onClick={handleSend}
                    disabled={isSending || !text.trim()}
                    className="px-6 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-semibold disabled:bg-gray-800 disabled:text-gray-600 transition-all shadow-lg shadow-pink-900/20 disabled:shadow-none flex items-center"
                >
                    {isSending ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Sending...
                        </>
                    ) : 'Send to PISEY'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default StaffFoodModal;
