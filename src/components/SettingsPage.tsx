
import React, { useContext, useState } from 'react';
import ItemsSettings from './settings/ItemsSettings';
import SuppliersSettings from './settings/SuppliersSettings';
import StoresSettings from './settings/StoresSettings';
import { AppContext } from '../context/AppContext';
import { SettingsTab } from '../types';
import ContextMenu from './ContextMenu';
import DueReportSettings from './settings/DueReportSettings';
import TelegramBotSettings from './settings/TelegramBotSettings';

const SettingsPage: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);
  const { activeSettingsTab } = state;
  const [menu, setMenu] = useState<{ x: number, y: number, options: any[] } | null>(null);
  const [menuOptions, setMenuOptions] = useState<any[]>([]);

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'items', label: 'Items' },
    { id: 'suppliers', label: 'Suppliers' },
    { id: 'stores', label: 'Stores' },
    { id: 'due-report', label: 'Due Report' },
    { id: 'integrations', label: 'Integrations' },
  ];
  
  const handleOpenMenu = (e: React.MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setMenu({ x: rect.right - 150, y: rect.bottom + 5, options: menuOptions });
  };
  
  const renderContent = () => {
    switch (activeSettingsTab) {
      case 'items':
        return <ItemsSettings setMenuOptions={setMenuOptions} />;
      case 'suppliers':
        return <SuppliersSettings setMenuOptions={setMenuOptions} />;
      case 'stores':
        return <StoresSettings />;
      case 'integrations':
        return <TelegramBotSettings />;
      case 'due-report':
        return <DueReportSettings setMenuOptions={setMenuOptions} />;
      default:
        return null;
    }
  };


  return (
    <div className="mt-2 flex flex-col flex-grow">
      <div>
        <nav className="-mb-px flex space-x-2 md:space-x-6 items-center overflow-x-auto hide-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => dispatch({ type: 'SET_ACTIVE_SETTINGS_TAB', payload: tab.id })}
              className={`whitespace-nowrap py-3 px-1 md:px-2 border-b-2 font-medium text-xs md:text-sm ${
                activeSettingsTab === tab.id
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
          {menuOptions.length > 0 && (
              <button
                onClick={handleOpenMenu}
                className="text-gray-400 hover:text-white p-1 ml-auto"
                aria-label="Table options"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
          )}
        </nav>
      </div>

      <div className="mt-4">
        {renderContent()}
      </div>

      {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}
    </div>
  );
};

export default SettingsPage;
