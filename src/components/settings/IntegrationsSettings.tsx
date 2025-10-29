import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import { useToasts } from '../../context/ToastContext';
import { processCsvContent } from '../../services/csvService';
import { seedDatabase } from '../../services/supabaseService';

// --- Icon Components for UI polish ---
const SupabaseIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7c0-1.1.9-2 2-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7zm16 4l-3-3m0 0l-3 3m3-3v12" />
    </svg>
);

const TelegramIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
);

const CsvIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 18h.01" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 18h.01" />
    </svg>
);

const IntegrationsSettings: React.FC = () => {
    const { state, dispatch } = useContext(AppContext);
    const { addToast } = useToasts();

    const [settings, setSettings] = useState(state.settings);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);
    const [openAccordion, setOpenAccordion] = useState<string | null>('csv');

    const handleSaveIntegrationSettings = () => {
        dispatch({ type: 'SAVE_SETTINGS', payload: settings });
        addToast('Integration settings saved successfully.', 'success');
    };

    const handleSyncCsv = async () => {
        if (!settings.csvUrl) {
          addToast('Please enter a CSV URL.', 'error');
          return;
        }
        setIsSyncing(true);
        addToast('Syncing database from CSV...', 'info');
        try {
            const response = await fetch(settings.csvUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch CSV file. Status: ${response.status}`);
            }
            const csvText = await response.text();

            if (csvText === state.settings.lastSyncedCsvContent) {
                addToast('Database is already up to date.', 'info');
                setIsSyncing(false);
                return;
            }

            // Fix: processCsvContent returns suppliers as well, which is needed for the dispatch payload.
            const { items, suppliers } = processCsvContent(csvText);
            
            // Fix: The 'REPLACE_ITEM_DATABASE' action requires the 'suppliers' property in its payload.
            dispatch({ type: 'REPLACE_ITEM_DATABASE', payload: { items, suppliers, rawCsv: csvText } });
          
            addToast(`Sync successful: ${items.length} items loaded.`, 'success');
    
        } catch (error: any) {
          addToast(`Error syncing items: ${error.message}`, 'error');
        } finally {
          setIsSyncing(false);
        }
    };
    
    const handleSeedDatabase = async () => {
        if (!settings.supabaseUrl || !settings.supabaseKey) {
            addToast('Please provide Supabase URL and Key.', 'error');
            return;
        }
        if (state.items.length === 0) {
            addToast('No local data to seed. Sync from CSV first.', 'info');
            return;
        }
        setIsSeeding(true);
        addToast('Seeding data to Supabase...', 'info');
        try {
            // Fix: The seedDatabase function requires the 'suppliers' property.
            const { itemsUpserted } = await seedDatabase({
                items: state.items,
                suppliers: state.suppliers,
                url: settings.supabaseUrl,
                key: settings.supabaseKey,
            });
            addToast(`Seed successful: ${itemsUpserted} items upserted.`, 'success');
        } catch (error: any) {
            addToast(`Seeding failed: ${error.message}`, 'error');
        } finally {
            setIsSeeding(false);
        }
    };
    
    return (
        <div className="w-full lg:w-1/2">
            <div className="space-y-4">
                {/* CSV Import Accordion */}
                <div className="bg-gray-800 rounded-xl shadow-lg">
                    <button onClick={() => setOpenAccordion(openAccordion === 'csv' ? null : 'csv')} className="w-full flex justify-between items-center p-4 focus:outline-none">
                        <div className="flex items-center space-x-3">
                            <CsvIcon />
                            <span className="font-semibold text-white">CSV Item Database</span>
                        </div>
                        <span className={`transform transition-transform text-gray-400 ${openAccordion === 'csv' ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {openAccordion === 'csv' && (
                        <div className="p-4 border-t border-gray-700">
                            <label htmlFor="csv-url" className="block text-sm font-medium text-gray-300">Google Sheet CSV URL</label>
                            <div className="mt-1 flex space-x-2">
                                <input
                                    type="text"
                                    id="csv-url"
                                    value={settings.csvUrl || ''}
                                    onChange={(e) => setSettings({ ...settings, csvUrl: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-gray-200 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                <button
                                    onClick={handleSyncCsv}
                                    disabled={isSyncing}
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed"
                                >
                                    {isSyncing ? 'Syncing...' : 'Sync'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Supabase Accordion */}
                <div className="bg-gray-800 rounded-xl shadow-lg">
                    <button onClick={() => setOpenAccordion(openAccordion === 'supabase' ? null : 'supabase')} className="w-full flex justify-between items-center p-4 focus:outline-none">
                        <div className="flex items-center space-x-3">
                            <SupabaseIcon />
                            <span className="font-semibold text-white">Supabase Integration</span>
                        </div>
                        <span className={`transform transition-transform text-gray-400 ${openAccordion === 'supabase' ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {openAccordion === 'supabase' && (
                        <div className="p-4 border-t border-gray-700 space-y-3">
                        <div>
                            <label htmlFor="supabase-url" className="block text-sm font-medium text-gray-300">Supabase URL</label>
                            <input
                                type="text"
                                id="supabase-url"
                                value={settings.supabaseUrl || ''}
                                onChange={(e) => setSettings({ ...settings, supabaseUrl: e.target.value })}
                                className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-gray-200 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="supabase-key" className="block text-sm font-medium text-gray-300">Supabase Anon Key</label>
                            <input
                                type="text"
                                id="supabase-key"
                                value={settings.supabaseKey || ''}
                                onChange={(e) => setSettings({ ...settings, supabaseKey: e.target.value })}
                                className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-gray-200 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div className="pt-2">
                             <button
                                onClick={handleSeedDatabase}
                                disabled={isSeeding || !settings.supabaseKey || !settings.supabaseUrl}
                                className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed"
                            >
                                {isSeeding ? 'Seeding...' : 'Seed Supabase with Local Data'}
                            </button>
                        </div>
                        </div>
                    )}
                </div>
                
                {/* Telegram Accordion */}
                <div className="bg-gray-800 rounded-xl shadow-lg">
                    <button onClick={() => setOpenAccordion(openAccordion === 'telegram' ? null : 'telegram')} className="w-full flex justify-between items-center p-4 focus:outline-none">
                        <div className="flex items-center space-x-3">
                            <TelegramIcon />
                            <span className="font-semibold text-white">Telegram Bot</span>
                        </div>
                        <span className={`transform transition-transform text-gray-400 ${openAccordion === 'telegram' ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {openAccordion === 'telegram' && (
                        <div className="p-4 border-t border-gray-700">
                            <label htmlFor="telegram-token" className="block text-sm font-medium text-gray-300">Bot Token</label>
                            <input
                                type="text"
                                id="telegram-token"
                                value={settings.telegramToken || ''}
                                onChange={(e) => setSettings({ ...settings, telegramToken: e.target.value })}
                                className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-gray-200 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                    )}
                </div>
                <div className="pt-4">
                    <button onClick={handleSaveIntegrationSettings} className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
                        Save Integration Settings
                    </button>
                </div>
            </div>
        </div>
    );
};

export default IntegrationsSettings;