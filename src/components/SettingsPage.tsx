import React, { useState } from 'react';
import ItemsSettings from './settings/ItemsSettings';
import SuppliersSettings from './settings/SuppliersSettings';
import OptionsSettings from './settings/OptionsSettings';
import IntegrationsSettings from './settings/IntegrationsSettings';
import StoresSettings from './settings/StoresSettings';

type SettingsTab = 'items' | 'suppliers' | 'stores' | 'options' | 'integrations';

const SettingsPage: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<SettingsTab>('items');

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'items', label: 'Items' },
    { id: 'suppliers', label: 'Suppliers' },
    { id: 'stores', label: 'Stores' },
    { id: 'options', label: 'Options' },
    { id: 'integrations', label: 'Integrations' },
  ];

  return (
    <div className="mt-6 flex flex-col flex-grow">
      <div className="border-b border-gray-700">
        <nav className="-mb-px flex space-x-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
                selectedTab === tab.id
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
        {selectedTab === 'items' && <ItemsSettings />}
        {selectedTab === 'suppliers' && <SuppliersSettings />}
        {selectedTab === 'stores' && <StoresSettings />}
        {selectedTab === 'options' && <OptionsSettings />}
        {selectedTab === 'integrations' && <IntegrationsSettings />}
      </div>
    </div>
  );
};

export default SettingsPage;