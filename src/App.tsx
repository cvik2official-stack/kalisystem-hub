import React, { useContext, useEffect, useState, useRef, useMemo } from 'react';
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
import TelegramWebhookModal from './components/modals/TelegramWebhookModal';
import { useNotificationState, useNotificationDispatch } from './context/NotificationContext';


const App: React.FC = () => {
  const { state, dispatch, actions } = useContext(AppContext);
  const { activeStore, isInitialized, syncStatus, isManagerView, managerStoreFilter, orders, settings, itemPrices, suppliers, draggedOrderId, draggedItem, activeSettingsTab, activeStatus, isSmartView } = state;
  const { notify } = useNotifier();
  const { hasUnread } = useNotificationState();
  const { markAllAsRead } = useNotificationDispatch();

  // Animations
  const [isRedAnimating, setIsRedAnimating] = useState(false);
  const [isYellowAnimating, setIsYellowAnimating] = useState(false);
  const [isGreenClickAnimating, setIsGreenClickAnimating] = useState(false);
  const prevHasUnreadRef = useRef(hasUnread);
  
  // Panel Control
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const yellowDotRef = useRef<HTMLButtonElement>(null);


  const [isSendingReport, setIsSendingReport] = useState(false);
  const [isSendingZapReport, setIsSendingZapReport] = useState(false);
  const [headerMenu, setHeaderMenu] = useState<{ x: number, y: number } | null>(null);
  const [isKaliReportModalOpen, setIsKaliReportModalOpen] = useState(false);
  const [isTelegramWebhookModalOpen, setIsTelegramWebhookModalOpen] = useState(false);

  const completedKaliOrders = React.useMemo(() => {
    return orders.filter(order => {
        if (order.status !== OrderStatus.COMPLETED) return false;

        const supplier = suppliers.find(s => s.id === order.supplierId);
        const paymentMethod = order.paymentMethod || supplier?.paymentMethod;

        return paymentMethod === PaymentMethod.KALI;
    });
  }, [orders, suppliers]);


  useEffect(() => {
    // Trigger bounce animation only when hasUnread changes from false to true
    if (hasUnread && !prevHasUnreadRef.current) {
        setIsYellowAnimating(true);
        const timer = setTimeout(() => setIsYellowAnimating(false), 800); // Match wobble animation duration
        return () => clearTimeout(timer);
    }
    prevHasUnreadRef.current = hasUnread;
  }, [hasUnread]);

  // Animate red dot on page/view changes
  useEffect(() => {
    setIsRedAnimating(true);
    // Reset the animation after it finishes
    const timer = setTimeout(() => setIsRedAnimating(false), 1500); // Must match animation-duration in CSS
    return () => clearTimeout(timer);
  }, [activeStore, activeSettingsTab, activeStatus, isSmartView, state.columnCount]);


  // Handle one-shot click animation for green dot
  useEffect(() => {
    if (isGreenClickAnimating) {
        const timer = setTimeout(() => setIsGreenClickAnimating(false), 1000); // Animation duration
        return () => clearTimeout(timer);
    }
  }, [isGreenClickAnimating]);

  useEffect(() => {
    const handleFocusLoss = () => {
      const emptyDispatchOrders = state.orders.filter(
        o => o.items.length === 0 && o.status === OrderStatus.DISPATCHING
      );
      if (emptyDispatchOrders.length > 0) {
        emptyDispatchOrders.forEach(order => {
          actions.deleteOrder(order.id);
        });
      }
    };

    window.addEventListener('blur', handleFocusLoss);
    return () => window.removeEventListener('blur', handleFocusLoss);
  }, [actions, state.orders]);

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

    // Auto-switch to Smart View on landscape
  useEffect(() => {
    const handleOrientationChange = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      if (isLandscape && !state.isSmartView) {
        dispatch({ type: 'SET_SMART_VIEW', payload: true });
      }
    };
    
    // Check on mount
    handleOrientationChange();

    window.addEventListener('resize', handleOrientationChange);
    return () => window.removeEventListener('resize', handleOrientationChange);
  }, [state.isSmartView, dispatch]);

  const handleEnterManagerView = () => {
    if (activeStore !== 'Settings') {
        dispatch({ type: 'SET_MANAGER_VIEW', payload: { isManager: true, store: activeStore } });
        dispatch({ type: 'SET_ACTIVE_STATUS', payload: OrderStatus.ON_THE_WAY });
    }
  };

  const handleSendKaliUnifyReport = async (message: string) => {
    setIsSendingReport(true);
    try {
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
        { label: 'TABLES', isHeader: true },
        { label: '  Items', action: () => dispatch({ type: 'NAVIGATE_TO_SETTINGS', payload: 'items' as SettingsTab }) },
        { label: '  Suppliers', action: () => dispatch({ type: 'NAVIGATE_TO_SETTINGS', payload: 'suppliers' as SettingsTab }) },
        { label: '  Stores', action: () => dispatch({ type: 'NAVIGATE_TO_SETTINGS', payload: 'stores' as SettingsTab }) },
        { label: '  Due Report', action: () => dispatch({ type: 'NAVIGATE_TO_SETTINGS', payload: 'due-report' as SettingsTab }) },
      ];
      
      const viewOptions = [
          { label: state.isSmartView ? '  Exit Smart View' : '  Smart View', action: () => dispatch({ type: 'SET_SMART_VIEW', payload: !state.isSmartView }) }
      ];
      if (activeStore !== 'Settings' && !state.isSmartView) {
          viewOptions.push({ label: '  Manager View', action: handleEnterManagerView });
      }
      options.push({ label: 'View', isHeader: true }, ...viewOptions);

      options.push(
        { label: 'SETTINGS', isHeader: true },
        { label: '  Templates', action: () => dispatch({ type: 'NAVIGATE_TO_SETTINGS', payload: 'templates' as SettingsTab }) },
        { label: '  Telegram Bot', action: () => setIsTelegramWebhookModalOpen(true) },
      )
      
      return options;
  };

  const handleRedDotClick = () => {
    const { columnCount, isSmartView } = state;

    if (isSmartView) {
      dispatch({ type: 'SET_SMART_VIEW', payload: false });
      return;
    }

    const isMobileLayout = window.innerWidth < 1024;

    if (isMobileLayout) {
      // Cycle: 1 -> 2 -> 3 -> Smart View -> 1
      if (columnCount === 1) dispatch({ type: 'SET_COLUMN_COUNT', payload: 2 });
      else if (columnCount === 2) dispatch({ type: 'SET_COLUMN_COUNT', payload: 3 });
      else if (columnCount === 3) dispatch({ type: 'SET_SMART_VIEW', payload: true });
    } else {
      // Cycle: 3 -> Smart View -> 3
      dispatch({ type: 'SET_SMART_VIEW', payload: true });
    }
  };
  
  const handleYellowDotClick = () => {
    setIsNotificationPanelOpen(prev => !prev);
    if (hasUnread) {
      markAllAsRead();
    }
  };
  
  const handleGreenDotClick = () => {
    if (syncStatus !== 'syncing') {
      setIsGreenClickAnimating(true);
      actions.syncWithSupabase();
    }
  };

  const isDragging = !!draggedOrderId || !!draggedItem;
  
  const handleDropOnDeleteZone = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedOrderId) {
      actions.deleteOrder(draggedOrderId);
    } else if (draggedItem) {
      actions.deleteItemFromOrder(draggedItem.item, draggedItem.sourceOrderId);
    }
    // Clean up global drag state
    dispatch({ type: 'SET_DRAGGED_ORDER_ID', payload: null });
    dispatch({ type: 'SET_DRAGGED_ITEM', payload: null });
  };

  const greenDotAnimationClass = useMemo(() => {
    if (isGreenClickAnimating) return 'animate-pulse-expand-once';
    if (syncStatus === 'syncing') return 'animate-pulse-syncing';
    return 'sonar-emitter';
  }, [isGreenClickAnimating, syncStatus]);

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

  const yellowDotRect = yellowDotRef.current?.getBoundingClientRect();

  return (
    <>
      {isDragging && (
        <div 
          className="fixed top-0 left-0 right-0 h-24 bg-indigo-900/50 z-50 flex items-center justify-center border-b-2 border-dashed border-indigo-400 transition-opacity duration-300"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropOnDeleteZone}
        >
          <div className="flex flex-col items-center justify-center pointer-events-none">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="text-indigo-300 font-bold text-lg mt-1">Drop to Delete</span>
          </div>
        </div>
      )}
      <div className="min-h-screen bg-gray-900 text-gray-200">
        <div className="bg-gray-900 w-full xl:max-w-7xl xl:mx-auto min-h-screen flex flex-col">
            <div className="flex-shrink-0 px-3 py-2 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-2">
                  <button onClick={handleRedDotClick} aria-label="Cycle column view">
                    <span className={`w-4 h-4 bg-red-500 rounded-full block ${isRedAnimating ? 'animate-spin-coin' : ''}`}></span>
                  </button>
                  <button onClick={handleYellowDotClick} aria-label="Notifications" ref={yellowDotRef}>
                    <span className={`w-4 h-4 bg-yellow-400 rounded-full block ${isYellowAnimating ? 'animate-wobble' : ''}`}>
                    </span>
                  </button>
                  <button onClick={handleGreenDotClick} disabled={syncStatus === 'syncing'} aria-label="Sync with database">
                    <span className={`relative w-4 h-4 bg-green-500 rounded-full block ${greenDotAnimationClass}`}></span>
                  </button>
                </div>
                 {isManagerView && <h1 className="text-xs font-semibold text-gray-300">Kali System: Dispatch</h1>}
              </div>
              
              <div className="flex items-center space-x-2">
                  {isManagerView && (
                    <>
                      <button
                          onClick={() => dispatch({ type: 'CYCLE_COLUMN_COUNT' })}
                          className="text-gray-400 hover:text-white p-1"
                          aria-label="Cycle column view"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                          </svg>
                      </button>
                      <button
                          onClick={() => actions.syncWithSupabase()}
                          disabled={syncStatus === 'syncing'}
                          className="text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed p-1"
                          aria-label="Sync with database"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-colors duration-300 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                          </svg>
                      </button>
                      <NotificationBell />
                    </>
                  )}
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
                {!isSmartView && <StoreTabs />}
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
      {yellowDotRect && (
        <NotificationBell
            isControlled={true}
            isOpen={isNotificationPanelOpen}
            setIsOpen={setIsNotificationPanelOpen}
            position={{ top: yellowDotRect.bottom + 5, left: yellowDotRect.left }}
        />
      )}
      <KaliReportModal
        isOpen={isKaliReportModalOpen}
        onClose={() => setIsKaliReportModalOpen(false)}
        onGenerate={handleSendKaliUnifyReport}
        isSending={isSendingReport}
        orders={completedKaliOrders}
        itemPrices={itemPrices}
      />
      <TelegramWebhookModal
        isOpen={isTelegramWebhookModalOpen}
        onClose={() => setIsTelegramWebhookModalOpen(false)}
      />
    </>
  );
};

export default App;