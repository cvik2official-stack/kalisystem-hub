import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import { useNotifier } from '../../context/NotificationContext';
import { SupplierBotSettings } from '../../types';

const Accordion: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="bg-gray-800 rounded-lg">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex justify-between items-center w-full p-4"
            >
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform transition-transform text-gray-400 ${isOpen ? 'rotate-180' : 'rotate-0'}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="p-4 pt-0">
                    {children}
                </div>
            </div>
        </div>
    );
};


const TemplatesSettings: React.FC = () => {
    const { state, dispatch } = useContext(AppContext);
    const { notify } = useNotifier();

    const handleTemplateSave = (key: string, newTemplate: string) => {
        const updatedTemplates = { ...state.settings.messageTemplates, [key]: newTemplate };
        dispatch({
            type: 'SAVE_SETTINGS',
            payload: { messageTemplates: updatedTemplates },
        });
        notify('Template saved!', 'success');
    };
    
    const templates = state.settings.messageTemplates || {};

    const templateMetas = [
        { key: 'defaultOrder', title: 'Default Order Message' },
        { key: 'kaliOrder', title: 'KALI Order Message' },
        { key: 'oudomOrder', title: 'OUDOM Order Message' },
        { key: 'telegramReceipt', title: 'Telegram Receipt' },
    ];
    
    return (
        <div className="space-y-6">
            {templateMetas.map(({key, title}) => (
                <Accordion key={key} title={title}>
                    <textarea
                        defaultValue={templates[key] || ''}
                        onBlur={(e) => handleTemplateSave(key, e.target.value)}
                        rows={5}
                        className="w-full bg-gray-900 text-gray-200 rounded-md p-3 font-mono text-xs outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                    />
                </Accordion>
            ))}
        </div>
    );
};

export default TemplatesSettings;