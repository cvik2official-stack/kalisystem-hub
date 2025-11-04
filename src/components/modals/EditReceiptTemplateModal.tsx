import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { useToasts } from '../../context/ToastContext';

interface EditReceiptTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: string;
}

const EditReceiptTemplateModal: React.FC<EditReceiptTemplateModalProps> = ({ isOpen, onClose, template }) => {
  const { state, dispatch } = useContext(AppContext);
  const { addToast } = useToasts();
  const [editedTemplate, setEditedTemplate] = useState(template);

  useEffect(() => {
    if (isOpen) {
      setEditedTemplate(template);
    }
  }, [isOpen, template]);

  const handleSave = () => {
    dispatch({
      type: 'SAVE_SETTINGS',
      payload: {
        receiptTemplates: {
          ...state.settings.receiptTemplates,
          'default': editedTemplate,
        }
      }
    });
    addToast('Receipt template saved!', 'success');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-[70] p-4 pt-16 md:pt-4" onClick={onClose}>
      <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-2xl border-t-4 border-indigo-500" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <h2 className="text-xl font-bold text-white mb-4">Edit Receipt Template</h2>
        <p className="text-sm text-gray-400 mb-4">
          Edit the HTML template below. Use placeholders like <code>{'{{store}}'}</code>, <code>{'{{grandTotal}}'}</code>, etc., for dynamic content.
        </p>

        <textarea
          value={editedTemplate}
          onChange={(e) => setEditedTemplate(e.target.value)}
          className="w-full h-96 bg-gray-900 text-gray-200 rounded-md p-3 font-mono text-xs outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
        />

        <div className="mt-6 flex justify-end items-center">
          <button onClick={handleSave} className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white">Save Template</button>
        </div>
      </div>
    </div>
  );
};

export default EditReceiptTemplateModal;
