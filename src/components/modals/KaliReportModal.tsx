import React, { useState, useEffect } from 'react';

interface KaliReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (previousDue: number, topUp: number) => void;
  isSending: boolean;
}

const KaliReportModal: React.FC<KaliReportModalProps> = ({ isOpen, onClose, onGenerate, isSending }) => {
  const [previousDue, setPreviousDue] = useState('');
  const [topUp, setTopUp] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPreviousDue('');
      setTopUp('');
    }
  }, [isOpen]);

  const handleGenerateClick = () => {
    const due = parseFloat(previousDue) || 0;
    const topup = parseFloat(topUp) || 0;
    onGenerate(due, topup);
  };
  
  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty string, numbers, and a single decimal point
    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
      setter(value);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
      <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm border-t-4 border-purple-500" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} disabled={isSending} className="absolute top-4 right-4 text-gray-400 hover:text-white disabled:text-gray-600" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-xl font-bold text-white mb-4">KALI Due Report</h2>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="previous-due" className="block text-sm font-medium text-gray-300">Previous Due Amount</label>
            <input
              type="text"
              id="previous-due"
              name="previous-due"
              inputMode="decimal"
              value={previousDue}
              onChange={handleInputChange(setPreviousDue)}
              autoFocus
              className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
              disabled={isSending}
            />
          </div>
          <div>
            <label htmlFor="top-up" className="block text-sm font-medium text-gray-300">Top Up Amount</label>
            <input
              type="text"
              id="top-up"
              name="top-up"
              inputMode="decimal"
              value={topUp}
              onChange={handleInputChange(setTopUp)}
              className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
              disabled={isSending}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button 
            onClick={handleGenerateClick} 
            disabled={isSending}
            className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-800 disabled:cursor-wait"
          >
            {isSending ? 'Sending...' : 'Generate & Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KaliReportModal;