import React, { useContext, useState } from 'react';
import { AppContext, AppState } from '../../context/AppContext';
import { useToasts } from '../../context/ToastContext';
import { processCsvContent } from '../../services/csvService';
import { seedDatabase } from '../../services/supabaseService';

// --- Icon Components for UI polish ---
const SupabaseIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
);

const CsvIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
);

const GeminiIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.293 2.293a1 1 0 010 1.414L10 16l-4 4-4-4 5.293-5.293a1 1 0 011.414 0L13 13m0 0l2.293 2.293a1 1 0 010 1.414L10 21l-4-4 3.707-3.707a1 1 0 011.414 0L13 13z" />
    </svg>
);

const GoogleSheetsIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500" viewBox="0 0 24 24" fill="currentColor">
        <path d="M15.54 11.5h2.96v2.96h-2.96zM15.54 15.54h2.96v2.96h-2.96zM11.5 15.54h2.96v2.96H11.5zM20 10.54V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2h7.5v-3.5h-3.5v-3h3.5v-3h3.5v3h3.5z" />
    </svg>
);

const AccordionItem: React.FC<{ title: string; id: string; icon: React.ReactNode; children: React.ReactNode; openAccordion: string | null; setOpenAccordion: (id: string | null) => void; }> = ({ title, id, icon, children, openAccordion, setOpenAccordion }) => (
    <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <button
            onClick={() => setOpenAccordion(openAccordion === id ? null : id)}
            className="w-full flex justify-between items-center p-4 text-left font-semibold text-white"
        >
            <div className="flex items-center space-x-3">
                {icon}
                <span>{title}</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform transition-transform text-gray-400 ${openAccordion === id ? '' : '-rotate-90'}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
        </button>
        {openAccordion === id && (
            <div className="p-4 border-t border-gray-700/50">
                {children}
            </div>
        )}
    </div>
);


const IntegrationsSettings: React.FC = () => {
    const { state, dispatch } = useContext(AppContext);
    const { addToast } = useToasts();

    const [isSyncing, setIsSyncing] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);
    const [openAccordion, setOpenAccordion] = useState<string | null>('csv');

    const handleSettingChange = (key: keyof AppState['settings'], value: string | boolean) => {
        dispatch({
            type: 'SAVE_SETTINGS',
            payload: {
                ...state.settings,
                [key]: value,
            },
        });
    };

    const handleSyncCsv = async () => {
        if (!state.settings.csvUrl) {
          addToast('Please enter a CSV URL.', 'error');
          return;
        }
        setIsSyncing(true);
        addToast('Syncing database from CSV...', 'info');
        try {
            const response = await fetch(state.settings.csvUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch CSV file. Status: ${response.status}`);
            }
            const csvText = await response.text();

            if (csvText === state.settings.lastSyncedCsvContent) {
                addToast('Database is already up to date.', 'info');
                setIsSyncing(false);
                return;
            }

            const { items, suppliers } = processCsvContent(csvText);
            
            dispatch({ type: 'REPLACE_ITEM_DATABASE', payload: { items, suppliers, rawCsv: csvText } });
          
            addToast(`Sync successful: ${items.length} items loaded.`, 'success');
    
        } catch (error: any) {
          addToast(`Error syncing items: ${error.message}`, 'error');
        } finally {
          setIsSyncing(false);
        }
    };
    
    const handleSeedDatabase = async () => {
        if (!state.settings.supabaseUrl || !state.settings.supabaseKey) {
            addToast('Please provide Supabase URL and Key.', 'error');
            return;
        }
        if (state.items.length === 0) {
            addToast('No local data to seed. Sync from CSV first.', 'info');
            return;
        }
        setIsSeeding(true);
        addToast('Seeding database with local item data...', 'info');
        try {
            const { itemsUpserted } = await seedDatabase({
                url: state.settings.supabaseUrl,
                key: state.settings.supabaseKey,
                items: state.items,
                suppliers: state.suppliers,
            });
            addToast(`Database seeded. ${itemsUpserted} items were updated or inserted.`, 'success');
        } catch (error: any) {
            addToast(`Error seeding database: ${error.message}`, 'error');
        } finally {
            setIsSeeding(false);
        }
    };

    return (
        <div className="w-full lg:w-2/3 space-y-4 pb-8">
            <AccordionItem title="Master Item List (CSV)" id="csv" icon={<CsvIcon />} openAccordion={openAccordion} setOpenAccordion={setOpenAccordion}>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="csv-url" className="block text-sm font-medium text-gray-300">Google Sheet CSV URL</label>
                        <input
                            type="text"
                            id="csv-url"
                            name="csv-url"
                            placeholder="Enter public Google Sheet CSV link"
                            value={state.settings.csvUrl || ''}
                            onChange={(e) => handleSettingChange('csvUrl', e.target.value)}
                            className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="flex justify-end">
                        <button onClick={handleSyncCsv} disabled={isSyncing} className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-800">
                            {isSyncing ? 'Syncing...' : 'Sync Now'}
                        </button>
                    </div>
                     <div className="text-xs text-gray-500 mt-2">
                        <p><strong>Instructions:</strong></p>
                        <ol className="list-decimal list-inside space-y-1 mt-1">
                            <li>In Google Sheets, go to <strong>File &gt; Share &gt; Publish to web</strong>.</li>
                            <li>Select the correct sheet, and choose <strong>Comma-separated values (.csv)</strong>.</li>
                            <li>Click <strong>Publish</strong> and copy the generated URL here.</li>
                            <li>The CSV must have columns named <strong>"Name"</strong> and <strong>"Supplier"</strong>.</li>
                        </ol>
                    </div>
                </div>
            </AccordionItem>
            
            <AccordionItem title="Supabase" id="supabase" icon={<SupabaseIcon />} openAccordion={openAccordion} setOpenAccordion={setOpenAccordion}>
                <div className="space-y-4">
                     <div className="text-xs text-gray-500">
                        <p><strong>Table Setup:</strong> Ensure you have the following tables in Supabase. Run this SQL in the Supabase SQL Editor.</p>
                        <pre className="mt-2 text-xs bg-gray-900 rounded-md p-2 overflow-x-auto">
                            <code>
{`-- Create stores_config table
CREATE TABLE public.stores_config (
  store_name text NOT NULL,
  telegram_chat_id text NULL,
  spreadsheet_id text NULL,
  CONSTRAINT stores_config_pkey PRIMARY KEY (store_name)
);
-- Enable RLS and create policy
ALTER TABLE public.stores_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access for anon users on stores_config"
ON public.stores_config FOR ALL TO anon USING (true) WITH CHECK (true);
`}
                            </code>
                        </pre>
                    </div>
                    <div className="flex justify-end">
                        <button onClick={handleSeedDatabase} disabled={isSeeding} className="px-4 py-2 text-sm font-medium rounded-md bg-green-600 hover:bg-green-700 text-white disabled:bg-green-800">
                            {isSeeding ? 'Seeding...' : 'Seed Database from Local Data'}
                        </button>
                    </div>
                </div>
            </AccordionItem>

            <AccordionItem title="Gemini AI" id="gemini" icon={<GeminiIcon />} openAccordion={openAccordion} setOpenAccordion={setOpenAccordion}>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="gemini-api-key" className="block text-sm font-medium text-gray-300">Gemini API Key</label>
                        <input
                            type="password"
                            id="gemini-api-key"
                            name="gemini-api-key"
                            placeholder="Enter your Gemini API Key"
                            value={state.settings.geminiApiKey || ''}
                            onChange={(e) => handleSettingChange('geminiApiKey', e.target.value)}
                            className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>
            </AccordionItem>
            
            <AccordionItem title="Google Sheets" id="sheets" icon={<GoogleSheetsIcon />} openAccordion={openAccordion} setOpenAccordion={setOpenAccordion}>
                 <div className="text-xs text-gray-500">
                    <p><strong>Instructions:</strong> Add the following secret to your Supabase project under <strong>Project Settings &gt; Edge Functions</strong> to enable daily reporting.</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                        <li><code>GOOGLE_SERVICE_ACCOUNT_JSON</code>: The full JSON content of your Google Cloud Service Account key.</li>
                    </ul>
                     <p className="mt-2">Ensure the service account has "Editor" access to the Google Sheets you want to write to.</p>
                </div>
            </AccordionItem>
        </div>
    );
};

export default IntegrationsSettings;