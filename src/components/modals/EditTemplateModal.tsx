import React, { useState, useEffect, useContext } from 'react';
import { Supplier, SupplierName } from '../../types';
import { AppContext } from '../../context/AppContext';
import { sendCustomMessageToSupplier } from '../../services/telegramService';
import { useNotifier } from '../../context/NotificationContext';

interface EditTemplateModalProps {
  supplier: Supplier;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedSupplier: Supplier) => void;
}

const BotSettingCheckbox: React.FC<{
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}> = ({ id, label, checked, onChange, disabled }) => (
  <div className="flex items-center">
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500"
    />
    <label htmlFor={id} className="ml-2 block text-sm text-gray-300">
      {label}
    </label>
  </div>
);

const Accordion: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="bg-gray-900 rounded-lg">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex justify-between items-center w-full p-3 text-left"
            >
                <h3 className="text-base font-semibold text-white">{title}</h3>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform transition-transform text-gray-400 ${isOpen ? 'rotate-180' : 'rotate-0'}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="px-3 pb-3">
                    {children}
                </div>
            </div>
        </div>
    );
};


const EditTemplateModal: React.FC<EditTemplateModalProps> = ({ supplier, isOpen, onClose, onSave }) => {
    const { state } = useContext(AppContext);
    const { notify } = useNotifier();
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false);
    
    // States for bot settings
    const [showAttachInvoice, setShowAttachInvoice] = useState(false);
    const [showMissingItems, setShowMissingItems] = useState(false);
    const [showOkButton, setShowOkButton] = useState(false);
    const [showDriverOnWayButton, setShowDriverOnWayButton] = useState(false);
    const [includeLocation, setIncludeLocation] = useState(false);
    
    // States for templates
    const [messageTemplate, setMessageTemplate] = useState('');
    const [customMessage, setCustomMessage] = useState('');

    const templates = state.settings.messageTemplates || {};
    let defaultTemplate = templates.defaultOrder || '';
    switch (supplier.name) {
        case SupplierName.KALI:
            defaultTemplate = templates.kaliOrder || defaultTemplate;
            break;
        case SupplierName.OUDOM:
            defaultTemplate = templates.oudomOrder || defaultTemplate;
            break;
    }

    useEffect(() => {
        if (isOpen) {
            const settings = supplier.botSettings || {};
            
            // Initialize checkbox states
            setShowAttachInvoice(!!settings.showAttachInvoice);
            setShowMissingItems(!!settings.showMissingItems);
            setShowOkButton(!!settings.showOkButton);
            setShowDriverOnWayButton(!!settings.showDriverOnWayButton);
            setIncludeLocation(!!settings.includeLocation);

            // Initialize template states
            const currentMessageTemplate = settings.messageTemplate || defaultTemplate;
            setMessageTemplate(currentMessageTemplate);
            setCustomMessage(currentMessageTemplate);
        }
    }, [isOpen, supplier, defaultTemplate]);

    const handleSave = () => {
        setIsSaving(true);
        const updatedSupplier: Supplier = {
            ...supplier,
            botSettings: {
                ...supplier.botSettings,
                messageTemplate: (messageTemplate.trim() === defaultTemplate.trim() || messageTemplate.trim() === '') ? undefined : messageTemplate.trim(),
                showAttachInvoice,
                showMissingItems,
                showOkButton,
                showDriverOnWayButton,
                includeLocation,
            }
        };
        onSave(updatedSupplier);
        setIsSaving(false);
        onClose();
    };

    const handleSendMessage = async () => {
        if (!customMessage.trim()) {
            notify('Cannot send an empty message.', 'error');
            return;
        }
        const { telegramBotToken } = state.settings;
        if (!telegramBotToken) {
            notify('Telegram Bot Token is not set.', 'error');
            return;
        }
        if (!supplier.chatId) {
            notify('Supplier Chat ID is not configured.', 'error');
            return;
        }

        setIsSending(true);
        try {
            await sendCustomMessageToSupplier(supplier, customMessage, telegramBotToken);
            notify('Custom message sent!', 'success');
            onClose();
        } catch (e: any) {
            notify(`Failed to send message: ${e.message}`, 'error');
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-[60] p-4 pt-16 md:pt-4" onClick={onClose}>
            <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <h2 className="text-xl font-bold text-white mb-2">Telegram Bot Options</h2>
                <p className="text-sm text-gray-400 mb-4">for <span className="font-semibold text-gray-300">{supplier.name}</span></p>

                <div className="space-y-4">
                    <div className="border-b border-gray-700 pb-4">
                        <h3 className="text-base font-semibold text-white mb-2">Button Options</h3>
                        <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                            <BotSettingCheckbox id="showOkButton" label="✅ OK" checked={showOkButton} onChange={setShowOkButton} disabled={isSaving || isSending} />
                            <BotSettingCheckbox id="showAttachInvoice" label="📎 Attach Invoice" checked={showAttachInvoice} onChange={setShowAttachInvoice} disabled={isSaving || isSending} />
                            <BotSettingCheckbox id="showDriverOnWayButton" label="🚚 Driver on Way" checked={showDriverOnWayButton} onChange={setShowDriverOnWayButton} disabled={isSaving || isSending} />
                            <BotSettingCheckbox id="showMissingItems" label="❗️ Missing Item" checked={showMissingItems} onChange={setShowMissingItems} disabled={isSaving || isSending} />
                        </div>
                    </div>

                    <div className="border-b border-gray-700 pb-4">
                         <h3 className="text-base font-semibold text-white mb-2">Message Options</h3>
                         <BotSettingCheckbox id="includeLocation" label="Include store location link" checked={includeLocation} onChange={setIncludeLocation} disabled={isSaving || isSending} />
                    </div>
                    
                    <Accordion title="Message Template">
                        <textarea
                            value={messageTemplate}
                            onChange={(e) => setMessageTemplate(e.target.value)}
                            rows={8}
                            className="w-full bg-gray-700 text-gray-200 rounded-md p-2 font-mono text-xs outline-none ring-1 ring-gray-600 focus:ring-2 focus:ring-indigo-500"
                        />
                    </Accordion>
                    
                     <Accordion title="Send Custom Message">
                        <textarea
                            value={customMessage}
                            onChange={(e) => setCustomMessage(e.target.value)}
                            rows={8}
                            className="w-full bg-gray-700 text-gray-200 rounded-md p-2 font-mono text-xs outline-none ring-1 ring-gray-600 focus:ring-2 focus:ring-indigo-500"
                        />
                    </Accordion>
                </div>

                <div className="mt-6 flex justify-end space-x-2">
                    <button onClick={handleSendMessage} disabled={isSaving || isSending} className="px-5 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-800">
                        {isSending ? 'Sending...' : 'Send Message'}
                    </button>
                    <button onClick={handleSave} disabled={isSaving || isSending} className="px-5 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-800">
                        {isSaving ? '...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditTemplateModal;