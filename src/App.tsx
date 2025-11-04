import React, { useContext, useEffect, useState, useRef } from 'react';
import StoreTabs from './components/StoreTabs';
import OrderWorkspace from './components/OrderWorkspace';
import SettingsPage from './components/SettingsPage';
import { AppContext } from './context/AppContext';
import ToastContainer from './components/ToastContainer';
import { OrderStatus, StoreName, SupplierName } from './types';
import ManagerView from './components/ManagerView';
import { generateKaliUnifyReport, generateKaliZapReport } from './utils/messageFormatter';
import { sendKaliUnifyReport, sendKaliZapReport } from './services/telegramService';
import { useToasts } from './context/ToastContext';

const App: React.FC = () => {
  const { state, dispatch, actions } = useContext(AppContext);
  const { activeStore, isInitialized, syncStatus, isManagerView, managerStoreFilter, orders, settings, itemPrices } = state;
  const { addToast } = useToasts();
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [isSendingZapReport, setIsSendingZapReport] = useState(false);
  const [animateSyncSuccess, setAnimateSyncSuccess] = useState(false);
  const prevSyncStatusRef = useRef<string | undefined>(undefined);


  useEffect(() => {
    if (prevSyncStatusRef.current === 'syncing' && syncStatus === 'idle') {
      setAnimateSyncSuccess(true);
      const timer = setTimeout(() => {
        setAnimateSyncSuccess(false);
      }, 1500); // Animation + color visible for 1.5s
      return () => clearTimeout(timer);
    }
    prevSyncStatusRef.current = syncStatus;
  }, [syncStatus]);

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

  const handleEnterManagerView = () => {
    if (activeStore !== 'Settings') {
        dispatch({ type: 'SET_MANAGER_VIEW', payload: { isManager: true, store: activeStore } });
        dispatch({ type: 'SET_ACTIVE_STATUS', payload: OrderStatus.ON_THE_WAY });
    }
  };

  const handleSendKaliUnifyReport = async () => {
    setIsSendingReport(true);
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todaysKaliOrders = orders.filter(order => {
            const completedDate = order.completedAt ? new Date(order.completedAt) : null;
            if (!completedDate) return false;
            completedDate.setHours(0, 0, 0, 0);

            return order.supplierName === SupplierName.KALI &&
                   order.status === OrderStatus.COMPLETED &&
                   completedDate.getTime() === today.getTime();
        });

        if (todaysKaliOrders.length === 0) {
            addToast('No completed KALI orders found for today.', 'info');
            return;
        }

        if (!settings.telegramBotToken) {
            addToast('Telegram Bot Token is not set in Options.', 'error');
            return;
        }

        const message = generateKaliUnifyReport(todaysKaliOrders);
        await sendKaliUnifyReport(message, settings.telegramBotToken);
        addToast('Kali Unify Report sent successfully!', 'success');

    } catch (error: any) {
        addToast(`Failed to send report: ${error.message}`, 'error');
    } finally {
        setIsSendingReport(false);
    }
  };
  
  const handleSendKaliZapReport = async () => {
    setIsSendingZapReport(true);
    try {
        const onTheWayKaliOrders = orders.filter(order => 
            order.supplierName === SupplierName.KALI &&
            order.status === OrderStatus.ON_THE_WAY
        );

        if (onTheWayKaliOrders.length === 0) {
            addToast('No KALI orders are currently on the way.', 'info');
            return;
        }
        
        if (!settings.telegramBotToken) {
            addToast('Telegram Bot Token is not set in Options.', 'error');
            return;
        }

        const message = generateKaliZapReport(onTheWayKaliOrders, itemPrices);
        await sendKaliZapReport(message, settings.telegramBotToken);
        addToast('Kali "On the Way" report sent!', 'success');
        
    } catch (error: any) {
        addToast(`Failed to send Zap report: ${error.message}`, 'error');
    } finally {
        setIsSendingZapReport(false);
    }
  };

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
    <>
      <div className="min-h-screen bg-gray-900 text-gray-200">
        <div className="bg-gray-800 shadow-2xl w-full md:w-1/2 md:mx-auto min-h-screen flex flex-col">
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
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-colors duration-300 ${syncStatus === 'syncing' ? 'animate-spin' : ''} ${animateSyncSuccess ? 'text-green-400 bounce-once-animation' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                      </svg>
                  </button>
                  <button
                      onClick={handleSendKaliZapReport}
                      disabled={isSendingZapReport}
                      className="text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
                      aria-label="Send Kali On The Way Report"
                      title="Send Kali On The Way Report"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M11.983 1.904a1.25 1.25 0 00-2.262 0l-5.25 10.5a1.25 1.25 0 001.131 1.85h3.331l-2.006 4.512a1.25 1.25 0 002.262 1.004l5.25-10.5a1.25 1.25 0 00-1.13-1.85h-3.332l2.006-4.512z" />
                      </svg>
                  </button>
                  <button
                      onClick={handleSendKaliUnifyReport}
                      disabled={isSendingReport}
                      className="text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
                      aria-label="Send Kali Unify Report"
                      title="Send Kali Unify Report"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                      </svg>
                  </button>
                   <button 
                      onClick={handleEnterManagerView} 
                      disabled={activeStore === 'Settings'}
                      className="text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed" 
                      aria-label="Manager View" 
                      title={activeStore === 'Settings' ? 'Cannot enter manager view from settings' : 'Manager View'}
                    >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 2a2 2 0 00-2 2v1H6a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2V4a2 2 0 00-2-2zM8 5V4a1 1 0 112 0v1H8z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button onClick={() => dispatch({ type: 'SET_ACTIVE_STORE', payload: 'Settings' })} className="text-gray-400 hover:text-white" aria-label="Settings" title="Settings">
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
    </>
  );
};

export default App;