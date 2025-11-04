import React, { useRef, useState } from 'react';
import { useToasts } from '../../context/ToastContext';
import EditReceiptTemplateModal from './EditReceiptTemplateModal';

declare const html2canvas: any;

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptHtml: string | null;
  receiptTemplate: string;
}

const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({ isOpen, onClose, receiptHtml, receiptTemplate }) => {
  const { addToast } = useToasts();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [zoom, setZoom] = useState(1);
  const [isTemplateEditorOpen, setTemplateEditorOpen] = useState(false);

  if (!isOpen || !receiptHtml) return null;

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    }
  };

  const getCanvas = async (): Promise<HTMLCanvasElement | null> => {
    if (iframeRef.current && iframeRef.current.contentDocument?.body) {
      try {
        const canvas = await html2canvas(iframeRef.current.contentDocument.body, {
            scale: 2 // Higher scale for better quality
        });
        return canvas;
      } catch (error) {
        console.error('Error generating canvas:', error);
        addToast('Failed to generate image.', 'error');
        return null;
      }
    }
    return null;
  };
  
  const handleDownload = async () => {
    const canvas = await getCanvas();
    if (canvas) {
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `invoice-${new Date().toISOString().split('T')[0]}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };

  const handleShare = async () => {
    const canvas = await getCanvas();
    if (!canvas) return;

    canvas.toBlob(async (blob) => {
        if (!blob) {
            addToast('Could not create image blob.', 'error');
            return;
        }

        const file = new File([blob], 'invoice.png', { type: 'image/png' });
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    title: 'Invoice',
                    text: 'Here is the invoice for the order.',
                    files: [file],
                });
            } catch (error) {
                console.error('Error sharing:', error);
                // Don't show an error if user cancels the share dialog
                if ((error as Error).name !== 'AbortError') {
                    addToast('Could not share the image.', 'error');
                }
            }
        } else {
             try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                addToast('Web Share not supported. Invoice image copied to clipboard.', 'success');
              } catch (error) {
                addToast('Could not copy image to clipboard.', 'error');
              }
        }
    }, 'image/png');
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4" onClick={onClose}>
        <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-xl border-t-4 border-green-500 flex flex-col" onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Receipt Preview</h2>
            <div className="flex items-center space-x-2">
                <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-1 bg-gray-700 rounded-md hover:bg-gray-600" title="Zoom Out">-</button>
                <span className="text-sm font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1 bg-gray-700 rounded-md hover:bg-gray-600" title="Zoom In">+</button>
            </div>
          </div>
          
          <div className="bg-gray-700 rounded-md p-2 flex-grow min-h-0 overflow-auto">
            <div className="flex justify-center items-start">
               <iframe
                    ref={iframeRef}
                    srcDoc={receiptHtml}
                    title="Receipt Preview"
                    className="bg-white rounded-sm border-none origin-top"
                    style={{
                        width: '302px', // 80mm paper width approx
                        height: '1000px', // A tall default height
                        transform: `scale(${zoom})`,
                        transformOrigin: 'top center',
                    }}
                    onLoad={() => {
                        // Adjust height after content loads
                        if (iframeRef.current && iframeRef.current.contentWindow) {
                            const body = iframeRef.current.contentWindow.document.body;
                            const html = iframeRef.current.contentWindow.document.documentElement;
                            const height = Math.max( body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight );
                            iframeRef.current.style.height = `${height + 20}px`;
                        }
                    }}
               />
            </div>
          </div>

          <div className="mt-6 flex justify-between items-center">
            <button onClick={() => setTemplateEditorOpen(true)} className="px-4 py-2 text-sm font-medium rounded-md bg-gray-600 hover:bg-gray-500 text-gray-200">Edit Template</button>
            <div className="flex items-center space-x-2">
              <button onClick={handlePrint} className="px-4 py-2 text-sm font-medium rounded-md bg-gray-600 hover:bg-gray-500 text-gray-200">Print</button>
              <button onClick={handleDownload} className="px-4 py-2 text-sm font-medium rounded-md bg-gray-600 hover:bg-gray-500 text-gray-200">Download</button>
              <button onClick={handleShare} className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white">Share</button>
            </div>
          </div>
        </div>
      </div>
      <EditReceiptTemplateModal isOpen={isTemplateEditorOpen} onClose={() => setTemplateEditorOpen(false)} template={receiptTemplate} />
    </>
  );
};

export default InvoicePreviewModal;
