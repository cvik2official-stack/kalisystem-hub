
import React, { useState, useEffect, useContext } from 'react';
import { Supplier, SupplierName, StoreName } from '../../types';
import { AppContext } from '../../context/AppContext';
import { sendCustomMessageToSupplier } from '../../services/telegramService';
import { useNotifier } from '../../context/NotificationContext';
import { escapeHtml, replacePlaceholders } from '../../utils/messageFormatter';

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
  <div className="flex items-center p-2 hover:bg-gray-800 rounded-lg transition-colors">
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-offset-gray-900 focus:ring-indigo-500 cursor-pointer"
    />
    <label htmlFor={id} className="ml-3 block text-sm text-gray-300 cursor-pointer flex-grow">
      {label}
    </label>
  </div>
);

const Accordion: React.FC<{ title: string; children: React.ReactNode; isOpen: boolean; onToggle: () => void; }> = ({ title, children, isOpen, onToggle }) => {
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <button
                onClick={onToggle}
                className="flex justify-between items-center w-full p-4 text-left hover:bg-gray-800/50 transition-colors"
            >
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wide">{title}</h3>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform transition-transform text-gray-500 ${isOpen ? 'rotate-180' : 'rotate-0'}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
            <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="px-4 pb-4 border-t border-gray-800">
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
    
    const [showAttachInvoice, setShowAttachInvoice] = useState(false);
    const [showMissingItems, setShowMissingItems] = useState(false);
    const [showOkButton, setShowOkButton] = useState(false);
    const [showDriverOnWayButton, setShowDriverOnWayButton] = useState(false);
    const [includeLocation, setIncludeLocation] = useState(false);
    
    const [messageTemplate, setMessageTemplate] = useState('');
    
    const [customMessage, setCustomMessage] = useState('');
    const [selectedStore, setSelectedStore] = useState<StoreName | ''>('');
    const [activeAccordions, setActiveAccordions] = useState<Set<string>>(new Set());
    
    const [tempShowOk, setTempShowOk] = useState(false);
    const [tempShowDriver, setTempShowDriver] = useState(false);
    const [tempShowInvoice, setTempShowInvoice] = useState(false);
    const [tempShowMissing, setTempShowMissing] = useState(false);
    const [tempIncludeLocation, setTempIncludeLocation] = useState(false);

    const templates = state.settings.messageTemplates || {};
    const defaultTemplate = templates.defaultOrder || '';
    
    useEffect(() => {
        if (isOpen) {
            const settings = supplier.botSettings || {};
            setShowAttachInvoice(!!settings.showAttachInvoice);
            setShowMissingItems(!!settings.showMissingItems);
            setShowOkButton(!!settings.showOkButton);
            setShowDriverOnWayButton(!!settings.showDriverOnWayButton);
            setIncludeLocation(!!settings.includeLocation);

            const currentMessageTemplate = settings.messageTemplate || defaultTemplate;
            setMessageTemplate(currentMessageTemplate);
            setCustomMessage(currentMessageTemplate);
            
            setSelectedStore(state.activeStore as StoreName);
            setActiveAccordions(new Set());
            setTempShowOk(false);
            setTempShowDriver(false);
            setTempShowInvoice(false);
            setTempShowMissing(false);
            setTempIncludeLocation(false);
        }
    }, [isOpen, supplier, defaultTemplate, state.activeStore]);
    
    const toggleAccordion = (id: string) => {
        setActiveAccordions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const handleSave = () => {
        setIsSaving(true);
        const updatedSupplier: Supplier = {
            ...supplier,
            botSettings: {
                ...supplier.botSettings,
                messageTemplate: messageTemplate.trim() === defaultTemplate.trim() ? undefined : messageTemplate.trim(),
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
        const { telegramBotToken } = state.settings;
        if (!telegramBotToken || !supplier.chatId) { notify('Bot Token or Supplier Chat ID is not configured.', 'error'); return; }

        let messageToSend = customMessage.trim();
        if (!messageToSend) { notify('Cannot send an empty message.', 'error'); return; }

        const needsStore = messageToSend.includes('{{storeName}}');
        if (needsStore && !selectedStore) { notify('Please select a store for this message.', 'error'); return; }
        
        const timeId = `${new Date().getHours()}${String(new Date().getMinutes()).padStart(2, '0')}${String(new Date().getSeconds()).padStart(2, '0')}`;

        let finalStoreDisplay = selectedStore || '';
        if (tempIncludeLocation && selectedStore) {
            const store = state.stores.find(s => s.name === selectedStore);
            if (store?.locationUrl) finalStoreDisplay = `<a href="${escapeHtml(store.locationUrl)}">${escapeHtml(selectedStore)}</a>`;
        } else {
            finalStoreDisplay = escapeHtml(finalStoreDisplay);
        }

        const replacements = { orderId: `MSG-${timeId}`, storeName: finalStoreDisplay, supplierName: escapeHtml(supplier.name), items: '' };
        messageToSend = replacePlaceholders(messageToSend, replacements);
        
        const buttons: { text: string; callback_data: string }[] = [];
        if (tempShowOk) buttons.push({ text: "✅ OK", callback_data: `custom_ok_${timeId}` });
        if (tempShowDriver) buttons.push({ text: "🚚 Driver on Way", callback_data: `custom_driver_${timeId}` });
        if (tempShowInvoice) buttons.push({ text: "📎 Attach Invoice", callback_data: `custom_invoice_${timeId}` });
        if (tempShowMissing) buttons.push({ text: "❗️ Missing Item", callback_data: `custom_missing_${timeId}` });

        let replyMarkup: { inline_keyboard: any[][] } | undefined = undefined;
        if (buttons.length > 0) {
            const keyboard: any[][] = [];
            for (let i = 0; i < buttons.length; i += 2) keyboard.push(buttons.slice(i, i + 2));
            replyMarkup = { inline_keyboard: keyboard };
        }

        setIsSending(true);
        try {
            await sendCustomMessageToSupplier(supplier, messageToSend, telegramBotToken, replyMarkup);
            notify('Custom message sent!', 'success');
            onClose();
        } catch (e: any) {
            notify(`Failed to send message: ${e.message}`, 'error');
        } finally {
            setIsSending(false);
        }
    };
    
    const isCustomMessageEdited = customMessage.trim() !== (supplier.botSettings?.messageTemplate || defaultTemplate).trim();
    const needsStoreForMessage = customMessage.includes('{{storeName}}');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start md:items-center justify-center z-[60] p-4 pt-16 md:pt-4" onClick={onClose}>
            <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                
                <div className="px-5 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                    <div>
                        <h2 className="text-lg font-bold text-white">Bot Settings</h2>
                        <p className="text-xs text-gray-400">for <span className="text-indigo-400">{supplier.name}</span></p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 bg-gray-800 rounded-full hover:bg-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-5 space-y-5 flex-grow overflow-y-auto hide-scrollbar">
                    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-800">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Buttons</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <BotSettingCheckbox id="showOkButton" label="✅ OK" checked={showOkButton} onChange={setShowOkButton} disabled={isSaving || isSending} />
                            <BotSettingCheckbox id="showAttachInvoice" label="📎 Invoice" checked={showAttachInvoice} onChange={setShowAttachInvoice} disabled={isSaving || isSending} />
                            <BotSettingCheckbox id="showDriverOnWayButton" label="🚚 Driver" checked={showDriverOnWayButton} onChange={setShowDriverOnWayButton} disabled={isSaving || isSending} />
                            <BotSettingCheckbox id="showMissingItems" label="❗️ Missing" checked={showMissingItems} onChange={setShowMissingItems} disabled={isSaving || isSending} />
                        </div>
                    </div>

                    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-800">
                         <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Content</h3>
                         <BotSettingCheckbox id="includeLocation" label="Include location link" checked={includeLocation} onChange={setIncludeLocation} disabled={isSaving || isSending} />
                    </div>
                    
                    <Accordion title="Message Template" isOpen={activeAccordions.has('template')} onToggle={() => toggleAccordion('template')}>
                        <textarea value={messageTemplate} onChange={(e) => setMessageTemplate(e.target.value)} rows={6} className="w-full bg-gray-800 text-gray-200 rounded-lg p-3 font-mono text-xs outline-none border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 leading-relaxed" />
                    </Accordion>
                    
                     <Accordion title="Send Custom Message" isOpen={activeAccordions.has('custom')} onToggle={() => toggleAccordion('custom')}>
                        <div className="space-y-3 pt-2">
                            <textarea value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} rows={5} className="w-full bg-gray-800 text-gray-200 rounded-lg p-3 font-mono text-xs outline-none border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 leading-relaxed" />
                            <div className="border-t border-gray-800 pt-3">
                                 <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">One-time Options</h4>
                                 <div className="grid grid-cols-2 gap-2">
                                     <BotSettingCheckbox id="tempShowOk" label="✅ OK" checked={tempShowOk} onChange={setTempShowOk} />
                                     <BotSettingCheckbox id="tempShowInvoice" label="📎 Invoice" checked={tempShowInvoice} onChange={setTempShowInvoice} />
                                     <BotSettingCheckbox id="tempShowDriver" label="🚚 Driver" checked={tempShowDriver} onChange={setTempShowDriver} />
                                     <BotSettingCheckbox id="tempShowMissing" label="❗️ Missing" checked={tempShowMissing} onChange={setTempShowMissing} />
                                 </div>
                                 <div className="mt-2">
                                    <BotSettingCheckbox id="tempIncludeLocation" label="Include location" checked={tempIncludeLocation} onChange={setTempIncludeLocation} />
                                 </div>
                            </div>
                        </div>
                    </Accordion>
                </div>

                <div className="px-5 py-4 bg-gray-800/30 border-t border-gray-800 flex justify-end items-center space-x-3">
                    {activeAccordions.has('custom') && isCustomMessageEdited && (
                        <>
                           {needsStoreForMessage && (
                             <select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value as StoreName)} className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none border border-gray-700 focus:border-indigo-500">
                                <option value="" disabled>Select Store...</option>
                                {state.stores.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                             </select>
                           )}
                           <button onClick={handleSendMessage} disabled={isSaving || isSending || (needsStoreForMessage && !selectedStore)} className="px-5 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:bg-gray-800 disabled:text-gray-500 shadow-lg shadow-blue-900/20 transition-all">
                               {isSending ? 'Sending...' : 'Send Message'}
                           </button>
                        </>
                    )}
                    <button onClick={handleSave} disabled={isSaving || isSending} className="px-6 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-gray-800 disabled:text-gray-500 shadow-lg shadow-indigo-900/20 transition-all">
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditTemplateModal;
