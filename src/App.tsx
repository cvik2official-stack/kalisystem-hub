import React, { useContext } from 'react';
import StoreTabs from './components/StoreTabs';
import OrderWorkspace from './components/OrderWorkspace';
import SettingsPage from './components/SettingsPage';
import { AppContext } from './context/AppContext';
import ManagerView from './components/ManagerView';
import ToastContainer from './components/ToastContainer';

const SyncIndicator: React.FC = () => {
    const { state } = useContext(AppContext);
    const { syncStatus, isLoading } = state;

    if (!isLoading) return null;

    let text = 'Syncing...';
    if (syncStatus === 'error') text = 'Sync Error';

    return (
        <div className="flex items-center space-x-2">
            <svg className="animate-spin h-4 w-4 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className={`text-xs font-semibold ${syncStatus === 'error' ? 'text-red-400' : 'text-gray-400'}`}>{text}</span>
        </div>
    );
}


const App: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);
  const { activeStore, isInitialized } = state;

  // Check for manager view URL parameters from the hash
  const urlParams = new URLSearchParams(window.location.hash.slice(1).startsWith('?') ? window.location.hash.slice(2) : window.location.hash.slice(1));
  const view = urlParams.get('view');
  const storeName = urlParams.get('store');

  if (view === 'manager' && storeName) {
    return (
      <>
        <ManagerView storeName={storeName} />
        <ToastContainer />
      </>
    );
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-center">
        <div>
          <svg className="animate-spin h-8 w-8 text-indigo-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-lg font-semibold text-gray-300">Initializing Application...</p>
          <p className="text-sm text-gray-500">Loading local data.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200">
      <div className="bg-gray-800 shadow-2xl w-full lg:w-3/5 lg:mx-auto min-h-screen flex flex-col">
          <div className="flex-shrink-0 p-3 flex items-center justify-between border-b border-gray-700/50">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1.5">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
              </div>
              <h1 className="text-xs font-semibold text-gray-300">Kali System: Dispatch</h1>
            </div>
            <SyncIndicator />
            <button onClick={() => dispatch({ type: 'SET_ACTIVE_STORE', payload: 'Settings' })} className="text-gray-400 hover:text-white" aria-label="Settings">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.532 1.532 0 012.287-.947c1.372.836 2.942-.734-2.106-2.106a1.532 1.532 0 01-.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <div className="flex-grow p-4 flex flex-col">
            <main className="flex-grow flex flex-col">
              <StoreTabs />
              {activeStore === 'Settings' ? <SettingsPage /> : <OrderWorkspace />}
            </main>
          </div>
      </div>
      <ToastContainer />
    </div>
  );
};

export default App;