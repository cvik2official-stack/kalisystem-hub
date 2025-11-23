
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
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">{title}</h3>
        <div className="bg-gray-800/50 rounded-xl border border-gray-800 overflow-hidden max-h-48 overflow-y-auto hide-scrollbar">
            {Object.entries(rules).length > 0 ? Object.entries(rules).map(([from, to], idx) => (
                <div key={from} className={`flex items-center justify-between p-3 ${idx !== Object.keys(rules).length - 1 ? 'border-b border-gray-800' : ''}`}>
                    <div className="flex items-center space-x-3 text-sm overflow-hidden">
                        <span className="text-gray-300 font-medium truncate max-w-[100px]">{from}</span>
                        <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                        <span className="text-indigo-300 truncate max-w-[120px]">{to}</span>
                    </div>
                    <button onClick={() => onDelete(from)} className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-gray-700/50 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )) : <p className="text-gray-600 text-center text-xs py-6">No rules configured.</p>}
        </div>
    </div>
);


const AiRulesModal: React.FC<AiRulesModalProps> = ({ isOpen, onClose }) => {
  const { state, dispatch } = useContext(AppContext);
  const { notify } = useNotifier();
  
  const [newAliasFrom, setNewAliasFrom] = useState('');
  const [newAliasTo, setNewAliasTo] = useState('');
  const [isGlobal, setIsGlobal] = useState(false);

  const activeStore = state.activeStore;
  const currentRules = state.settings.aiParsingRules || {};
  const globalRules = currentRules.global || {};
  const storeRules = activeStore !== 'Settings' ? (currentRules[activeStore] || {}) : {};

  const handleAddAlias = () => {
    const from = newAliasFrom.trim();
    const to = newAliasTo.trim();
    if (!from || !to) {
      notify('Both fields are required.', 'error');
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
    notify('Rule added successfully.', 'success');
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start md:items-center justify-center z-[60] p-4 pt-16 md:pt-4" onClick={onClose}>
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        
        <div className="px-5 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
            <h2 className="text-lg font-bold text-white">Parsing Rules</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 bg-gray-800 rounded-full hover:bg-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
        
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto hide-scrollbar">
            <RuleList title="Global Rules" rules={globalRules} onDelete={handleDeleteGlobalAlias} />
            {activeStore !== 'Settings' && (
                <RuleList title={`${activeStore} Rules`} rules={storeRules} onDelete={handleDeleteStoreAlias} />
            )}
        </div>
        
        <div className="px-6 py-5 bg-gray-800/30 border-t border-gray-800">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Add New Rule</h3>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <input type="text" value={newAliasFrom} onChange={(e) => setNewAliasFrom(e.target.value)} placeholder="User Input (e.g. 'Coke')" className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 outline-none border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm" />
            </div>
             <div className="flex-1">
              <input type="text" value={newAliasTo} onChange={(e) => setNewAliasTo(e.target.value)} placeholder="Database Item (e.g. 'Coca Cola')" className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 outline-none border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm" />
            </div>
          </div>
          <div className="mt-4 flex justify-between items-center">
                <label className="flex items-center cursor-pointer">
                    <input type="checkbox" checked={isGlobal} onChange={(e) => setIsGlobal(e.target.checked)} className="h-4 w-4 rounded bg-gray-800 border-gray-600 text-indigo-600 focus:ring-offset-gray-900" />
                    <span className="ml-2 text-sm text-gray-300">Apply Globally</span>
                </label>
                <button onClick={handleAddAlias} className="px-5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20 transition-all">Add Rule</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiRulesModal;
