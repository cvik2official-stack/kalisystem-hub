
import React, { useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { useToasts } from '../../context/ToastContext';

const OptionsSettings: React.FC = () => {
    const { state, dispatch } = useContext(AppContext);
    const { addToast } = useToasts();
    
    const isAiEnabled = state.settings.isAiEnabled !== false; // Default to true

    const handleToggleAi = () => {
        const newIsAiEnabled = !isAiEnabled;
        dispatch({
            type: 'SAVE_SETTINGS',
            payload: { ...state.settings, isAiEnabled: newIsAiEnabled }
        });
        addToast(`AI Item Matching ${newIsAiEnabled ? 'enabled' : 'disabled'}.`, 'success');
    };

    return (
        <div className="w-full lg:w-1/2">
            <div className="bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Item Parsing</h3>
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
            </div>
        </div>
    );
};

export default OptionsSettings;