import React, { useContext, useEffect, useState, useRef } from 'react';
import StoreTabs from './components/StoreTabs';
import OrderWorkspace from './components/OrderWorkspace';
import SettingsPage from './components/SettingsPage';
import { AppContext } from './context/AppContext';
import ToastContainer from './components/ToastContainer';
import { OrderStatus, StoreName, SupplierName, SettingsTab, PaymentMethod, Order } from './types';
import ManagerView from './components/ManagerView';
import { generateKaliUnifyReport, generateKaliZapReport } from './utils/messageFormatter';
import { sendKaliUnifyReport, sendKaliZapReport } from './services/telegramService';
import { useNotifier } from './context/NotificationContext';
import ContextMenu from './components/ContextMenu';
import NotificationBell from './components/NotificationBell';
import KaliReportModal from './components/modals/KaliReportModal';

const App: React.FC = () => {
  const { state, dispatch, actions } = useContext(AppContext);
  const { activeStore, isInitialized, syncStatus, isManagerView, managerStoreFilter, orders, settings, itemPrices, suppliers } = state;
  const { notify } = useNotifier();
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [isSendingZapReport, setIsSendingZapReport] = useState(false);
  const [animateSyncSuccess, setAnimateSyncSuccess] = useState(false);
  const prevSyncStatusRef = useRef<string | undefined>(undefined);
  const [headerMenu, setHeaderMenu] = useState<{ x: number, y: number } | null>(null);
  const [isKaliReportModalOpen, setIsKaliReportModalOpen] = useState(false);

  const todaysKaliOrders = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return orders.filter(order => {
        if (order.status !== OrderStatus.COMPLETED || !order.completedAt) return false;

        const completedDate = new Date(order.completedAt);
        completedDate.setHours(0, 0, 0, 0);
        if (completedDate.getTime() !== today.getTime()) return false;

        const supplier = suppliers.find(s => s.id === order.supplierId);
        const paymentMethod = order.paymentMethod || supplier?.paymentMethod;

        return paymentMethod === PaymentMethod.KALI;
    });
  }, [orders, suppliers]);


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
    const handleVisibilityChange = () => {
      if (document.hidden) {
        dispatch({ type: 'SET_EDIT_MODE', payload: false });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [dispatch]);

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

  const handleSendKaliUnifyReport = async (message: string) => {
    setIsSendingReport(true);
    try {
        if (todaysKaliOrders.length === 0) {
            notify('No completed KALI orders found for today.', 'info');
            return;
        }

        if (!settings.telegramBotToken) {
            notify('Telegram Bot Token is not set in Options.', 'error');
            return;
        }

        await sendKaliUnifyReport(message, settings.telegramBotToken);
        notify('Kali Unify Report sent successfully!', 'success');
        setIsKaliReportModalOpen(false);

    } catch (error: any) {
        notify(`Failed to send report: ${error.message}`, 'error');
    } finally {
        setIsSendingReport(false);
    }
  };
  
  const handleSendKaliZapReport = async () => {
    setIsSendingZapReport(true);
    try {
        const onTheWayKaliOrders = orders.filter(order => 
            (order.supplierName === SupplierName.KALI || order.paymentMethod === PaymentMethod.KALI) &&
            order.status === OrderStatus.ON_THE_WAY
        );

        if (onTheWayKaliOrders.length === 0) {
            notify('No KALI orders are currently on the way.', 'info');
            return;
        }
        
        if (!settings.telegramBotToken) {
            notify('Telegram Bot Token is not set in Options.', 'error');
            return;
        }

        const message = generateKaliZapReport(onTheWayKaliOrders, itemPrices);
        await sendKaliZapReport(message, settings.telegramBotToken);
        notify('Kali "On the Way" report sent!', 'success');
        
    } catch (error: any) {
        notify(`Failed to send Zap report: ${error.message}`, 'error');
    } finally {
        setIsSendingZapReport(false);
    }
  };
  
  const getMenuOptions = () => {
      const options = [
        { label: 'Reports', isHeader: true },
        { label: '  KALI est.', action: handleSendKaliZapReport },
        { label: '  KALI due', action: () => setIsKaliReportModalOpen(true) },
        { label: 'Settings', isHeader: true },
        { label: '  Items', action: () => dispatch({ type: 'NAVIGATE_TO_SETTINGS', payload: 'items' as SettingsTab }) },
        { label: '  Suppliers', action: () => dispatch({ type: 'NAVIGATE_TO_SETTINGS', payload: 'suppliers' as SettingsTab }) },
        { label: '  Stores', action: () => dispatch({ type: 'NAVIGATE_TO_SETTINGS', payload: 'stores' as SettingsTab }) },
        { label: '  Templates', action: () => dispatch({ type: 'NAVIGATE_TO_SETTINGS', payload: 'templates' as SettingsTab }) },
        { label: '  Telegram Bot', action: () => dispatch({ type: 'NAVIGATE_TO_SETTINGS', payload: 'telegram-bot' as SettingsTab }) },
      ];
      if (activeStore !== 'Settings') {
        options.push(
            { label: 'View', isHeader: true },
            { label: '  Manager View', action: handleEnterManagerView }
        );
      }
      return options;
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
        <div className="bg-gray-900 w-full md:w-1/2 md:mx-auto min-h-screen flex flex-col">
            <div className="flex-shrink-0 px-3 py-2 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1.5">
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                  <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                </div>
                <h1 className="text-xs font-semibold text-gray-300">Kali System: Dispatch</h1>
              </div>
              <div className="flex items-center space-x-2">
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
                  <NotificationBell />
                  <button 
                    onClick={(e) => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setHeaderMenu({ x: rect.right - 150, y: rect.bottom + 5 });
                    }}
                    className="text-gray-400 hover:text-white p-1"
                    aria-label="More options"
                    title="More options"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
              </div>
            </div>

            <div className="flex-grow px-3 py-2 flex flex-col">
              <main className="flex-grow flex flex-col">
                <StoreTabs />
                {activeStore === 'Settings' ? <SettingsPage /> : <OrderWorkspace />}
              </main>
            </div>
        </div>
        <ToastContainer />
      </div>
      {headerMenu && (
        <ContextMenu
            x={headerMenu.x}
            y={headerMenu.y}
            options={getMenuOptions()}
            onClose={() => setHeaderMenu(null)}
        />
      )}
      <KaliReportModal
        isOpen={isKaliReportModalOpen}
        onClose={() => setIsKaliReportModalOpen(false)}
        onGenerate={handleSendKaliUnifyReport}
        isSending={isSendingReport}
        orders={todaysKaliOrders}
        itemPrices={itemPrices}
      />
    </>
  );
};

export default App;