
import React, { useContext, useState } from 'react';
import { AppContext, AppState } from '../../context/AppContext';
import { useToasts } from '../../context/ToastContext';

const AccordionItem: React.FC<{ title: string; id: string; children: React.ReactNode; openAccordion: string | null; setOpenAccordion: (id: string | null) => void; }> = ({ title, id, children, openAccordion, setOpenAccordion }) => (
    <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <button
            onClick={() => setOpenAccordion(openAccordion === id ? null : id)}
            className="w-full flex justify-between items-center p-4 text-left font-semibold text-white"
        >
            <span className="text-lg">{title}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 transform transition-transform text-gray-400 ${openAccordion === id ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
        </button>
        {openAccordion === id && (
            <div className="p-6 border-t border-gray-700/50">
                {children}
            </div>
        )}
    </div>
);

const OptionsSettings: React.FC = () => {
    const { state, dispatch } = useContext(AppContext);
    const { addToast } = useToasts();
    const [openAccordion, setOpenAccordion] = useState<string | null>('parsing');

    const isAiEnabled = state.settings.isAiEnabled !== false; // Default to true

    const handleToggleAi = () => {
        const newIsAiEnabled = !isAiEnabled;
        dispatch({
            type: 'SAVE_SETTINGS',
            payload: { ...state.settings, isAiEnabled: newIsAiEnabled }
        });
        addToast(`AI Item Matching ${newIsAiEnabled ? 'enabled' : 'disabled'}.`, 'success');
    };

    const handleSettingChange = (key: keyof AppState['settings'], value: string | boolean) => {
        dispatch({
            type: 'SAVE_SETTINGS',
            payload: {
                ...state.settings,
                [key]: value,
            },
        });
    };

    return (
        <div className="w-full space-y-4">
            <AccordionItem title="Item Parsing" id="parsing" openAccordion={openAccordion} setOpenAccordion={setOpenAccordion}>
                <div className="flex items-center justify-between">
                    <p className="text-gray-200">Enable AI Item Matching</p>
                    <label htmlFor="ai-toggle" className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input
                                type="checkbox"
                                id="ai-toggle"
                                name="ai-toggle"
                                className="sr-only"
                                checked={isAiEnabled}
                                onChange={handleToggleAi}
                            />
                            <div className={`block w-12 h-6 rounded-full transition-colors ${isAiEnabled ? 'bg-indigo-600' : 'bg-gray-600'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out ${isAiEnabled ? 'transform translate-x-6' : ''}`}></div>
                        </div>
                    </label>
                </div>
            </AccordionItem>

            <AccordionItem title="Integrations" id="integrations" openAccordion={openAccordion} setOpenAccordion={setOpenAccordion}>
                 <div className="space-y-4">
                    <div>
                        <label htmlFor="gemini-api-key" className="block text-sm font-medium text-gray-300">Gemini API Key</label>
                        <input
                            type="password"
                            id="gemini-api-key"
                            name="gemini-api-key"
                            value={state.settings.geminiApiKey || ''}
                            onChange={(e) => handleSettingChange('geminiApiKey', e.target.value)}
                            className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="google-api-credentials" className="block text-sm font-medium text-gray-300">Google Service Account JSON</label>
                        <textarea
                            id="google-api-credentials"
                            name="google-api-credentials"
                            value={state.settings.googleApiCredentials || ''}
                            onChange={(e) => handleSettingChange('googleApiCredentials', e.target.value)}
                            className="mt-1 w-full h-32 bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            <b className="text-yellow-400">Warning:</b> This key is stored in your browser and is not secure for production use.
                        </p>
                    </div>
                </div>
            </AccordionItem>
        </div>
    );
};

export default OptionsSettings;