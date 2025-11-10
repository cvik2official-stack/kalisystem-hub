import React, { useContext } from 'react';
import ItemsSettings from './settings/ItemsSettings';
import SuppliersSettings from './settings/SuppliersSettings';
import StoresSettings from './settings/StoresSettings';
import { AppContext } from '../context/AppContext';
import { SettingsTab } from '../types';
import TemplatesSettings from './settings/TemplatesSettings';

const SettingsPage: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);
  const { activeSettingsTab } = state;

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'items', label: 'Items' },
    { id: 'suppliers', label: 'Suppliers' },
    { id: 'stores', label: 'Stores' },
    { id: 'templates', label: 'Templates' },
  ];

  return (
    <div className="mt-6 flex flex-col flex-grow">
      <div className="border-b border-gray-700">
        <nav className="-mb-px flex space-x-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => dispatch({ type: 'SET_ACTIVE_SETTINGS_TAB', payload: tab.id })}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
                activeSettingsTab === tab.id
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-4 flex-grow flex flex-col">
        {activeSettingsTab === 'items' && <ItemsSettings />}
        {activeSettingsTab === 'suppliers' && <SuppliersSettings />}
        {activeSettingsTab === 'stores' && <StoresSettings />}
        {activeSettingsTab === 'templates' && <TemplatesSettings />}
      </div>
    </div>
  );
};

export default SettingsPage;
