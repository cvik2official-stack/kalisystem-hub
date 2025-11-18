import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import { useNotifier } from '../../context/NotificationContext';
import { SupplierBotSettings } from '../../types';

const Accordion: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="bg-gray-800 rounded-xl">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex justify-between items-center w-full p-3"
            >
                <div className="flex items-center space-x-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform transition-transform text-gray-400 ${isOpen ? 'rotate-0' : '-rotate-90'}`} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <h3 className="font-bold text-white text-base">{title}</h3>
                </div>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
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
        { key: 'telegramReceipt', title: 'Telegram Receipt' },
    ];
    
    return (
        <div className="md:w-1/2">
            <div className="space-y-4">
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
        </div>
    );
};

export default TemplatesSettings;