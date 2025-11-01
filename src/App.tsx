import React, { useContext, useEffect } from 'react';
import StoreTabs from './components/StoreTabs';
import OrderWorkspace from './components/OrderWorkspace';
import SettingsPage from './components/SettingsPage';
import { AppContext } from './context/AppContext';
import ToastContainer from './components/ToastContainer';
import { OrderStatus, StoreName } from './types';
import ManagerView from './components/ManagerView';

const App: React.FC = () => {
  const { state, dispatch, actions } = useContext(AppContext);
  const { activeStore, isInitialized, syncStatus, isManagerView, managerStoreFilter } = state;

  useEffect(() => {
    const hash = window.location.hash;
    const queryString = hash.includes('?') ? hash.substring(hash.indexOf('?') + 1) : '';
    const urlParams = new URLSearchParams(queryString);
    const view = urlParams.get('view');
    const storeParam = urlParams.get('store');

    if (view === 'manager' && storeParam) {
        const isValidStore = Object.values(StoreName).includes(storeParam as StoreName);
        if (isValidStore) {
            const managerStore = storeParam as StoreName;
            dispatch({ type: 'SET_MANAGER_VIEW', payload: { isManager: true, store: managerStore } });
            dispatch({ type: 'SET_ACTIVE_STORE', payload: managerStore });
            dispatch({ type: 'SET_ACTIVE_STATUS', payload: OrderStatus.ON_THE_WAY });

            // Clean the URL hash so a refresh doesn't re-trigger this in a confusing way
            const newUrl = window.location.pathname + window.location.search;
            window.history.replaceState({}, '', newUrl);
        }
    }
  }, [dispatch]);

  useEffect(() => {
    const checkAndRunReport = async () => {
        const now = new Date();
        const lastReportKey = 'lastDailyReportDate';
        const lastReportDate = localStorage.getItem(lastReportKey);
        const todayStr = now.toISOString().split('T')[0];

        // Don't run if a report for today has already been generated
        if (lastReportDate === todayStr) {
            return;
        }

        // Run if it's 8 PM (20:00) or later
        if (now.getHours() >= 20) {
            console.log('Time to run daily report...');
            try {
                await actions.runDailyReports();
                localStorage.setItem(lastReportKey, todayStr);
            } catch (e) {
                console.error("Failed to run daily reports:", e);
                // Don't set the flag if it fails, so it can retry later or tomorrow
            }
        }
    };

    // Check every 5 minutes to see if it's time to run the report
    const intervalId = setInterval(checkAndRunReport, 5 * 60 * 1000); 
    checkAndRunReport(); // Also run on initial load

    return () => clearInterval(intervalId);
  }, [actions]);


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

  if (isManagerView && managerStoreFilter) {
    return <ManagerView storeName={managerStoreFilter} />;
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
            <div className="flex items-center space-x-4">
                <button
                    onClick={() => actions.syncWithSupabase()}
                    disabled={syncStatus === 'syncing'}
                    className="text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed p-1"
                    aria-label="Sync with database"
                    title="Sync with database"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                    </svg>
                </button>
                <button onClick={() => dispatch({ type: 'SET_ACTIVE_STORE', payload: 'Settings' })} className="text-gray-400 hover:text-white" aria-label="Settings">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.532 1.532 0 012.287-.947c1.372.836 2.942-.734-2.106-2.106a1.532 1.532 0 01-.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                </button>
            </div>
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