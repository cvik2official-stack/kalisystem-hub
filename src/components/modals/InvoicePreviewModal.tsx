import React from 'react';
import { useToasts } from '../../context/ToastContext';

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  base64Image: string | null;
}

const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({ isOpen, onClose, base64Image }) => {
  const { addToast } = useToasts();
  
  if (!isOpen || !base64Image) return null;

  const imageUrl = `data:image/png;base64,${base64Image}`;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head><title>Print Invoice</title></head>
          <body style="margin:0; padding:0;">
            <img src="${imageUrl}" style="max-width:100%;" onload="window.print(); setTimeout(function(){window.close();}, 100);" />
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `invoice-${new Date().toISOString().split('T')[0]}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleShare = async () => {
    if (!navigator.share) {
      addToast('Web Share API is not supported in your browser.', 'info');
      try {
        const blob = await (await fetch(imageUrl)).blob();
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]);
        addToast('Invoice image copied to clipboard.', 'success');
      } catch (error) {
        addToast('Could not copy image to clipboard.', 'error');
      }
      return;
    }

    try {
      const blob = await (await fetch(imageUrl)).blob();
      const file = new File([blob], 'invoice.png', { type: 'image/png' });

      await navigator.share({
        title: 'Invoice',
        text: 'Here is the invoice for the order.',
        files: [file],
      });
    } catch (error) {
      console.error('Error sharing:', error);
      addToast('Could not share the image.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg border-t-4 border-green-500" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <h2 className="text-xl font-bold text-white mb-4">Receipt Preview</h2>
        
        <div className="bg-gray-900 rounded-md p-2 max-h-[60vh] overflow-y-auto">
          <img src={imageUrl} alt="Generated Invoice" className="w-full h-auto rounded" />
        </div>

        <div className="mt-6 flex justify-end items-center space-x-2">
          <button onClick={handlePrint} className="px-4 py-2 text-sm font-medium rounded-md bg-gray-600 hover:bg-gray-500 text-gray-200">Print</button>
          <button onClick={handleDownload} className="px-4 py-2 text-sm font-medium rounded-md bg-gray-600 hover:bg-gray-500 text-gray-200">Download</button>
          <button onClick={handleShare} className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white">Share</button>
        </div>
      </div>
    </div>
  );
};

export default InvoicePreviewModal;