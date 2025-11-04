import React, { useState, useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { useToasts } from '../../context/ToastContext';

interface AiRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AiRulesModal: React.FC<AiRulesModalProps> = ({ isOpen, onClose }) => {
  const { state, dispatch } = useContext(AppContext);
  const { addToast } = useToasts();
  
  const [newAliasFrom, setNewAliasFrom] = useState('');
  const [newAliasTo, setNewAliasTo] = useState('');

  const aliases = state.settings.aiParsingRules?.aliases || {};

  const handleAddAlias = () => {
    const from = newAliasFrom.trim();
    const to = newAliasTo.trim();
    if (!from || !to) {
      addToast('Both "From" and "To" fields are required.', 'error');
      return;
    }
    
    const updatedAliases = { ...aliases, [from]: to };

    dispatch({ 
      type: 'SAVE_SETTINGS', 
      payload: { 
        aiParsingRules: { 
          aliases: updatedAliases 
        } 
      } 
    });
    addToast('AI parsing rule added!', 'success');

    setNewAliasFrom('');
    setNewAliasTo('');
  };

  const handleDeleteAlias = (fromKey: string) => {
    const newAliases = { ...aliases };
    delete newAliases[fromKey];
    
    dispatch({ 
      type: 'SAVE_SETTINGS', 
      payload: { 
        aiParsingRules: { 
          aliases: newAliases
        } 
      } 
    });
    addToast('AI parsing rule removed.', 'success');
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-[60] p-4 pt-16 md:pt-4" onClick={onClose}>
      <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg border-t-4 border-indigo-500" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <h2 className="text-xl font-bold text-white mb-4">Ai parsing rules</h2>
        
        <div className="bg-gray-900 rounded-md p-3 max-h-60 overflow-y-auto hide-scrollbar space-y-2">
          {Object.entries(aliases).length > 0 ? Object.entries(aliases).map(([from, to]) => (
            <div key={from} className="flex items-center justify-between bg-gray-800 p-2 rounded">
              <div className="flex items-center space-x-2">
                <span className="text-gray-300 font-medium">{from}</span>
                <span className="text-gray-500">→</span>
                <span className="text-indigo-300">{to}</span>
              </div>
              <button onClick={() => handleDeleteAlias(from)} className="text-red-400 hover:text-red-300 p-1 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )) : <p className="text-gray-500 text-center text-sm py-4">No custom rules yet.</p>}
        </div>

        <div className="mt-4 border-t border-gray-700 pt-4">
          <h3 className="text-lg font-semibold text-white mb-2">Add New Rule</h3>
          <div className="flex items-end space-x-2">
            <div className="flex-1">
              <label htmlFor="alias-from" className="block text-xs text-gray-400 mb-1">From (User Input)</label>
              <input
                id="alias-from"
                type="text"
                value={newAliasFrom}
                onChange={(e) => setNewAliasFrom(e.target.value)}
                className="w-full bg-gray-700 text-gray-200 rounded-md p-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="alias-to" className="block text-xs text-gray-400 mb-1">To (Database Item Name)</label>
              <input
                id="alias-to"
                type="text"
                value={newAliasTo}
                onChange={(e) => setNewAliasTo(e.target.value)}
                className="w-full bg-gray-700 text-gray-200 rounded-md p-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <button onClick={handleAddAlias} className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white">Add</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiRulesModal;