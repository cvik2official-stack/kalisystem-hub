import React, { useState } from 'react';
import EditReceiptTemplateModal from './EditReceiptTemplateModal';

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptHtml: string | null;
  receiptTemplate: string;
}

const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({ isOpen, onClose, receiptHtml, receiptTemplate }) => {
  const [isEditTemplateModalOpen, setEditTemplateModalOpen] = useState(false);

  const handlePrint = () => {
    const iframe = document.getElementById('receipt-iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-[60] p-4 pt-16 md:pt-4" onClick={onClose}>
        <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm border-t-4 border-indigo-500" onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-xl font-bold text-white mb-4">Invoice Preview</h2>
          
          <div className="bg-white rounded-md p-2 h-96 overflow-y-auto">
            {receiptHtml && (
              <iframe
                id="receipt-iframe"
                srcDoc={receiptHtml}
                title="Receipt Preview"
                className="w-full h-full border-0"
              />
            )}
          </div>

          <div className="mt-6 flex justify-between items-center">
            <button
              onClick={() => setEditTemplateModalOpen(true)}
              className="px-4 py-2 text-sm font-medium rounded-md bg-gray-600 hover:bg-gray-500 text-gray-200"
            >
              Edit Template
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Print
            </button>
          </div>
        </div>
      </div>
      <EditReceiptTemplateModal 
        isOpen={isEditTemplateModalOpen} 
        onClose={() => setEditTemplateModalOpen(false)} 
        template={receiptTemplate}
      />
    </>
  );
};

export default InvoicePreviewModal;
