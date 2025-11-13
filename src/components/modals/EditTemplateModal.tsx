import React, { useState, useEffect } from 'react';
import { Supplier, SupplierBotSettings } from '../../types';

interface EditTemplateModalProps {
  supplier: Supplier;
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplier: Supplier) => Promise<void>;
}

const EditTemplateModal: React.FC<EditTemplateModalProps> = ({ supplier, isOpen, onClose, onSave }) => {
  const [botSettings, setBotSettings] = useState<SupplierBotSettings>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBotSettings(supplier.botSettings || {});
    }
  }, [isOpen, supplier]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ ...supplier, botSettings });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSettingChange = (key: keyof SupplierBotSettings, value: any) => {
    setBotSettings(prev => ({ ...prev, [key]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
      <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg border-t-4 border-indigo-500" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} disabled={isSaving} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <h2 className="text-xl font-bold text-white mb-4">Bot Settings for {supplier.name}</h2>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="message-template" className="block text-sm font-medium text-gray-300 mb-1">Order Message Template</label>
            <textarea
              id="message-template"
              rows={5}
              value={botSettings.messageTemplate || ''}
              onChange={(e) => handleSettingChange('messageTemplate', e.target.value)}
              className="w-full bg-gray-900 text-gray-200 rounded-md p-2 font-mono text-xs outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. <b>#️⃣ Order {{orderId}}</b> for <b>{{storeName}}</b>..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={!!botSettings.showOkButton} onChange={(e) => handleSettingChange('showOkButton', e.target.checked)} className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500"/>
              <span className="text-sm text-gray-300">Show "OK" Button</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={!!botSettings.includeLocation} onChange={(e) => handleSettingChange('includeLocation', e.target.checked)} className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500"/>
              <span className="text-sm text-gray-300">Include Location Link</span>
            </label>
          </div>

          <div className="border-t border-gray-700 pt-4">
             <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" checked={!!botSettings.enableReminderTimer} onChange={(e) => handleSettingChange('enableReminderTimer', e.target.checked)} className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500"/>
                <span className="text-sm text-gray-300">Enable 45min Reminder</span>
             </label>
             {botSettings.enableReminderTimer && (
                <div className="mt-2 pl-6">
                    <label htmlFor="reminder-message-template" className="block text-sm font-medium text-gray-300 mb-1">Reminder Message Template</label>
                    <input
                      id="reminder-message-template"
                      type="text"
                      value={botSettings.reminderMessageTemplate || ''}
                      onChange={(e) => handleSettingChange('reminderMessageTemplate', e.target.value)}
                      className="w-full bg-gray-900 text-gray-200 rounded-md p-2 text-sm outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. 🔔 Reminder: Order {{orderId}}"
                    />
                </div>
             )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-800">
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditTemplateModal;
