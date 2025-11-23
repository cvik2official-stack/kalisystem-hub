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
    
    if (!piseySupplier) {
        notify('Supplier "PISEY" not found.', 'error');
        return;
    }
    
    if (!state.settings.telegramBotToken || !piseySupplier.chatId) {
        notify('Bot token or PISEY chat ID missing.', 'error');
        return;
    }

    setIsSending(true);
    try {
        // Construct a simple message with header
        const message = `<b>Staff Food Order for ${state.activeStore}</b>\n\n${text.trim()}`;
        
        await sendCustomMessageToSupplier(
            piseySupplier, 
            message, 
            state.settings.telegramBotToken
        );
        
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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
      <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg border-t-4 border-pink-500" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <h2 className="text-xl font-bold text-white mb-4">Staff Food List</h2>
        <p className="text-sm text-gray-400 mb-4">Paste the staff food items below. This will be sent directly to PISEY.</p>
        
        <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-40 bg-gray-900 text-gray-200 rounded-md p-3 outline-none focus:ring-2 focus:ring-pink-500"
            placeholder="e.g. 3x Fried Rice..."
            autoFocus
        />
        
        <div className="mt-6 flex justify-end">
            <button
                onClick={handleSend}
                disabled={isSending || !text.trim()}
                className="px-4 py-2 text-sm font-medium rounded-md bg-pink-600 hover:bg-pink-700 text-white disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center"
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
  );
};

export default StaffFoodModal;