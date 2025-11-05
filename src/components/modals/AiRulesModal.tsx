import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import { useNotifier } from '../../context/NotificationContext';
import { StoreName } from '../../types';

interface AiRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RuleList: React.FC<{ title: string, rules: Record<string, string>, onDelete: (key: string) => void }> = ({ title, rules, onDelete }) => (
    <div>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <div className="bg-gray-900 rounded-md p-3 max-h-40 overflow-y-auto hide-scrollbar space-y-2">
            {Object.entries(rules).length > 0 ? Object.entries(rules).map(([from, to]) => (
                <div key={from} className="flex items-center justify-between bg-gray-800 p-2 rounded">
                    <div className="flex items-center space-x-2">
                        <span className="text-gray-300 font-medium">{from}</span>
                        <span className="text-gray-500">→</span>
                        <span className="text-indigo-300">{to}</span>
                    </div>
                    <button onClick={() => onDelete(from)} className="text-red-400 hover:text-red-300 p-1 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )) : <p className="text-gray-500 text-center text-sm py-4">No {title.toLowerCase()} yet.</p>}
        </div>
    </div>
);


const AiRulesModal: React.FC<AiRulesModalProps> = ({ isOpen, onClose }) => {
  const { state, dispatch } = useContext(AppContext);
  const { notify } = useNotifier();
  
  const [newAliasFrom, setNewAliasFrom] = useState('');
  const [newAliasTo, setNewAliasTo] = useState('');
  const [isGlobal, setIsGlobal] = useState(false);

  // FIX: Removed incorrect type assertion. `activeStore` can be 'Settings', so casting to `StoreName` was causing comparison errors.
  const activeStore = state.activeStore;
  const currentRules = state.settings.aiParsingRules || {};
  const globalRules = currentRules.global || {};
  const storeRules = activeStore !== 'Settings' ? (currentRules[activeStore] || {}) : {};

  const handleAddAlias = () => {
    const from = newAliasFrom.trim();
    const to = newAliasTo.trim();
    if (!from || !to) {
      notify('Both "From" and "To" fields are required.', 'error');
      return;
    }
    
    let updatedRules = { ...currentRules };
    if (isGlobal) {
        updatedRules.global = { ...(updatedRules.global || {}), [from]: to };
    } else if (activeStore !== 'Settings') {
        updatedRules[activeStore] = { ...(updatedRules[activeStore] || {}), [from]: to };
    } else {
        notify('Cannot add a store-specific rule from this view.', 'error');
        return;
    }

    dispatch({ type: 'SAVE_SETTINGS', payload: { aiParsingRules: updatedRules } });
    notify('AI parsing rule added!', 'success');

    setNewAliasFrom('');
    setNewAliasTo('');
  };

  const handleDeleteGlobalAlias = (fromKey: string) => {
    const updatedGlobalRules = { ...globalRules };
    delete updatedGlobalRules[fromKey];
    dispatch({ type: 'SAVE_SETTINGS', payload: { aiParsingRules: { ...currentRules, global: updatedGlobalRules } } });
    notify('Global rule removed.', 'success');
  };
  
  const handleDeleteStoreAlias = (fromKey: string) => {
    if (activeStore === 'Settings') return;
    const updatedStoreRules = { ...storeRules };
    delete updatedStoreRules[fromKey];
    dispatch({ type: 'SAVE_SETTINGS', payload: { aiParsingRules: { ...currentRules, [activeStore]: updatedStoreRules } } });
    notify(`Rule for ${activeStore} removed.`, 'success');
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-[60] p-4 pt-16 md:pt-4" onClick={onClose}>
      <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-2xl border-t-4 border-indigo-500" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <h2 className="text-xl font-bold text-white mb-4">AI Parsing Rules</h2>
        
        <div className="space-y-4">
            <RuleList title="Global Rules" rules={globalRules} onDelete={handleDeleteGlobalAlias} />
            {activeStore !== 'Settings' && (
                <RuleList title={`Rules for ${activeStore}`} rules={storeRules} onDelete={handleDeleteStoreAlias} />
            )}
        </div>
        
        <div className="mt-6 border-t border-gray-700 pt-4">
          <h3 className="text-lg font-semibold text-white mb-2">Add New Rule</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label htmlFor="alias-from" className="block text-xs text-gray-400 mb-1">From (User Input)</label>
              <input id="alias-from" type="text" value={newAliasFrom} onChange={(e) => setNewAliasFrom(e.target.value)} className="w-full bg-gray-700 text-gray-200 rounded-md p-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"/>
            </div>
             <div>
              <label htmlFor="alias-to" className="block text-xs text-gray-400 mb-1">To (Database Item Name)</label>
              <input id="alias-to" type="text" value={newAliasTo} onChange={(e) => setNewAliasTo(e.target.value)} className="w-full bg-gray-700 text-gray-200 rounded-md p-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
            </div>
          </div>
          <div className="mt-4 flex justify-between items-center">
                <div className="flex items-center">
                    <input id="is-global-rule" type="checkbox" checked={isGlobal} onChange={(e) => setIsGlobal(e.target.checked)} className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                    <label htmlFor="is-global-rule" className="ml-2 block text-sm text-gray-300">Make this rule global</label>
                </div>
                <button onClick={handleAddAlias} className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white">Add Rule</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiRulesModal;