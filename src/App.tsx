
import React, { useContext, useEffect, useState, useRef, useMemo } from 'react';
import StoreTabs from './components/StoreTabs';
import OrderWorkspace from './components/OrderWorkspace';
import SettingsPage from './components/SettingsPage';
import { AppContext } from './context/AppContext';
import ToastContainer from './components/ToastContainer';
import { OrderStatus, StoreName, SupplierName, SettingsTab, PaymentMethod, Order, Supplier } from './types';
import ManagerView from './components/ManagerView';
import { generateKaliUnifyReport, generateKaliZapReport } from './utils/messageFormatter';
import { sendKaliUnifyReport, sendKaliZapReport } from './services/telegramService';
import { useNotifier } from './context/NotificationContext';
import ContextMenu from './components/ContextMenu';
import NotificationBell from './components/NotificationBell';
import KaliReportModal from './components/modals/KaliReportModal';
import TelegramWebhookModal from './components/modals/TelegramWebhookModal';
import { useNotificationState, useNotificationDispatch } from './context/NotificationContext';
import PipWindow from './components/pip/PipWindow';
import SelectStoreForShareModal from './components/modals/SelectStoreForShareModal';
import AddSupplierModal from './components/modals/AddSupplierModal';
import SaveQuickOrderModal from './components/modals/SaveQuickOrderModal';
import QuickOrderListModal from './components/modals/QuickOrderListModal';


const App: React.FC = () => {
  const { state, dispatch, actions } = useContext(AppContext);
  const { activeStore, isInitialized, syncStatus, isManagerView, managerStoreFilter, orders, settings, itemPrices, suppliers, draggedOrderId, draggedItem, activeSettingsTab, activeStatus, isSmartView } = state;
  const { notify } = useNotifier();
  const { hasUnread } = useNotificationState();
  const { markAllAsRead } = useNotificationDispatch();

  // Animations
  const [isRedAnimating, setIsRedAnimating] = useState(false);
  const [isYellowAnimating, setIsYellowAnimating] = useState(false);
  const prevHasUnreadRef = useRef(hasUnread);
  
  // Panel Control
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const yellowDotRef = useRef<HTMLButtonElement>(null);


  const [isSendingReport, setIsSendingReport] = useState(false);
  const [isSendingZapReport, setIsSendingZapReport] = useState(false);
  const [headerMenu, setHeaderMenu] = useState<{ x: number, y: number } | null>(null);
  const [isKaliReportModalOpen, setIsKaliReportModalOpen] = useState(false);
  const [isTelegramWebhookModalOpen, setIsTelegramWebhookModalOpen] = useState(false);
  const [isKaliPipOpen, setIsKaliPipOpen] = useState(false);
  
  // State for share target
  const [isSelectStoreForShareModalOpen, setIsSelectStoreForShareModalOpen] = useState(false);
  const [sharedText, setSharedText] = useState<string | null>(null);

  // State for Drag-to-Change Supplier
  const [isChangeSupplierModalOpen, setChangeSupplierModalOpen] = useState(false);
  const [orderIdToChangeSupplier, setOrderIdToChangeSupplier] = useState<string | null>(null);
  
  // State for Quick Orders
  const [isSaveQuickOrderModalOpen, setIsSaveQuickOrderModalOpen] = useState(false);
  const [isQuickOrderListModalOpen, setIsQuickOrderListModalOpen] = useState(false);
  const [orderIdToSave, setOrderIdToSave] = useState<string | null>(null);


  const completedKaliOrders = React.useMemo(() => {
    return orders.filter(order => {
        if (order.status !== OrderStatus.COMPLETED) return false;

        const supplier = suppliers.find(s => s.id === order.supplierId);
        const paymentMethod = order.paymentMethod || supplier?.paymentMethod;

        return paymentMethod === PaymentMethod.KALI;
    });
  }, [orders, suppliers]);

  // Sync KALI To-Do list whenever orders or suppliers change
  useEffect(() => {
    if (isInitialized) {
      dispatch({ type: 'SYNC_KALI_TODO' });
    }
  }, [orders, suppliers, isInitialized, dispatch]);
  
  // Listen for messages from the service worker (for notification actions)
  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
        if (event.data && event.data.action) {
            switch (event.data.action) {
                case 'CLOSE_PIP':
                    setIsKaliPipOpen(false);
                    break;
                case 'SHOW_ALL':
                    dispatch({ type: 'SET_ACTIVE_STORE', payload: 'ALL' });
                    break;
            }
        }
    };
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    return () => {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [dispatch]);


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
    if (!isInitialized) return;

    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const text = params.get('text');

    if (action) {
      if (action === 'kali-report') {
        setIsKaliReportModalOpen(true);
      } else if (action === 'paste-list' || action === 'add-card') {
         setIsSelectStoreForShareModalOpen(true);
         dispatch({ type: 'SET_INITIAL_ACTION', payload: action });
      } else if (action === 'show_all') {
        dispatch({ type: 'SET_ACTIVE_STORE', payload: 'ALL' });
      }
      window.history.replaceState({}, '', window.location.pathname);
    } else if (text) { // From share_target
      setSharedText(text);
      setIsSelectStoreForShareModalOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [isInitialized, dispatch]);

  const handleStoreSelectedForShare = (store: StoreName) => {
    setIsSelectStoreForShareModalOpen(false);
    dispatch({ type: 'SET_ACTIVE_STORE', payload: store });
    if (sharedText) {
      actions.pasteItemsForStore(sharedText, store);
      setSharedText(null);
    }
    // The initialAction will be handled by OrderWorkspace once the store is active
  };


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
    // FIX: Manager view must be for a specific store, not 'ALL' or 'Settings'.
    if (activeStore !== 'Settings' && activeStore !== 'ALL') {
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
      
      const viewOptions = [];

      if (state.isSmartView) {
        viewOptions.push({ label: '  Exit Smart View', action: () => dispatch({ type: 'SET_SMART_VIEW', payload: false }) });
      } else {
        viewOptions.push({ label: '  Smart View', action: () => dispatch({ type: 'SET_SMART_VIEW', payload: true }) });
      }
      
      viewOptions.push({ label: '  Quick Orders', action: () => setIsQuickOrderListModalOpen(true) });

      // Always allow switching to Manager View, unless already in it.
      if (activeStore !== 'Settings' && !isManagerView) {
          viewOptions.push({ label: '  Manager View', action: handleEnterManagerView });
      }

      viewOptions.push({ label: '  KALI PiP', action: () => setIsKaliPipOpen(true) });
      
      options.push({ label: 'View', isHeader: true }, ...viewOptions);

      options.push(
        { label: 'SETTINGS', isHeader: true },
        { label: '  Templates', action: () => dispatch({ type: 'NAVIGATE_TO_SETTINGS', payload: 'templates' as SettingsTab }) },
        { label: '  Telegram Bot', action: () => setIsTelegramWebhookModalOpen(true) },
      )
      
      return options;
  };

  const handleRedDotClick = () => {
      // If we are on the settings page, always exit to the default view
      if (activeStore === 'Settings') {
          dispatch({ type: 'SET_SMART_VIEW', payload: false });
          dispatch({ type: 'SET_ACTIVE_STORE', payload: StoreName.CV2 });
          return;
      }
      // Otherwise, toggle Smart View
      dispatch({ type: 'SET_SMART_VIEW', payload: !isSmartView });
  };
  
  const handleYellowDotClick = () => {
    setIsNotificationPanelOpen(prev => !prev);
    if (hasUnread) {
      markAllAsRead();
    }
  };
  
  const handleGreenDotClick = () => {
    if (syncStatus !== 'syncing') {
      actions.syncWithSupabase();
    }
  };

  const isDragging = !!draggedOrderId || !!draggedItem;
  
  const handleDropOnDeleteZone = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent main drop zone from firing
    if (draggedOrderId) {
      actions.deleteOrder(draggedOrderId);
    } else if (draggedItem) {
      actions.deleteItemFromOrder(draggedItem.item, draggedItem.sourceOrderId);
    }
    // Clean up global drag state
    dispatch({ type: 'SET_DRAGGED_ORDER_ID', payload: null });
    dispatch({ type: 'SET_DRAGGED_ITEM', payload: null });
  };

  const handleDropOnChangeSupplierZone = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedOrderId) {
      setOrderIdToChangeSupplier(draggedOrderId);
      setChangeSupplierModalOpen(true);
      dispatch({ type: 'SET_DRAGGED_ORDER_ID', payload: null });
    }
  };

  const handleDropOnSaveZone = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (draggedOrderId) {
          setOrderIdToSave(draggedOrderId);
          setIsSaveQuickOrderModalOpen(true);
          dispatch({ type: 'SET_DRAGGED_ORDER_ID', payload: null });
      }
  };

  const handleChangeSupplierFromDrop = async (supplier: Supplier) => {
     if (orderIdToChangeSupplier) {
        const order = state.orders.find(o => o.id === orderIdToChangeSupplier);
        if (order) {
             let supplierToUse = supplier;
            if (supplier.id.startsWith('new_')) {
                const newSupplierFromDb = await actions.addSupplier({ name: supplier.name });
                supplierToUse = newSupplierFromDb;
            }
            await actions.updateOrder({ ...order, supplierId: supplierToUse.id, supplierName: supplierToUse.name, paymentMethod: supplierToUse.paymentMethod });
            notify(`Order moved to ${supplierToUse.name}`, 'success');
        }
     }
     setChangeSupplierModalOpen(false);
     setOrderIdToChangeSupplier(null);
  };

  const greenDotAnimationClass = useMemo(() => {
    if (syncStatus === 'syncing') return 'animate-spin';
    return 'sonar-emitter';
  }, [syncStatus]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-center">
        <div>
          <svg className="animate-spin h-8 w-8 text-indigo-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-400">Initializing...</p>
        </div>
      </div>
    );
  }

  if (isManagerView) {
    return <ManagerView />;
  }

  return (
    <>
      <div 
        className={`min-h-screen bg-gray-900 text-gray-200 flex flex-col font-sans transition-opacity duration-500 ${isDragging ? 'opacity-80' : 'opacity-100'}`}
        onDragOver={(e) => { e.preventDefault(); }}
      >
        <ToastContainer />
        
        <main className="flex flex-col flex-grow p-4 md:p-6 lg:px-[10%] max-w-full mx-auto w-full">
            <header className="flex-shrink-0 flex items-center justify-between mb-4 sticky top-0 bg-gray-900/80 backdrop-blur-sm z-30 py-2">
                <div className="flex items-center space-x-2">
                    <button onClick={handleRedDotClick} className="w-4 h-4 bg-red-500 rounded-full block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-red-500 relative" title="Toggle Smart View / Exit Settings">
                        {isRedAnimating && <span className="absolute inset-0 rounded-full bg-red-500 animate-ping-once"></span>}
                    </button>
                    <button ref={yellowDotRef} onClick={handleYellowDotClick} className="relative w-4 h-4 bg-yellow-400 rounded-full block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-yellow-400" title="Notifications">
                        {hasUnread && <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full ${isYellowAnimating ? 'animate-wobble' : ''}`}></span>}
                    </button>
                    <button onClick={handleGreenDotClick} className="relative w-4 h-4 bg-green-500 rounded-full block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-green-500" title="Sync with Database">
                        <span className={`absolute inset-0 rounded-full bg-green-500 ${greenDotAnimationClass}`}></span>
                    </button>
                </div>
                <StoreTabs />
                <div className="flex items-center space-x-2">
                    <button onClick={(e) => setHeaderMenu({ x: e.clientX - 200, y: e.clientY + 20 })} className="text-gray-400 hover:text-white p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                    </button>
                </div>
            </header>

            <div className="flex-grow flex flex-col">
                {activeStore === 'Settings' ? <SettingsPage /> : <OrderWorkspace />}
            </div>

            {isDragging && (
                <>
                  <div className="fixed bottom-4 left-4 z-40 flex items-center space-x-2">
                      {draggedOrderId && (
                          <>
                              <div 
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDropOnSaveZone}
                                className="h-24 w-40 flex flex-col items-center justify-center bg-green-900/50 border-2 border-dashed border-green-500 rounded-xl"
                                title="Save as Quick Order"
                              >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                                  <span className="text-xs text-green-300 font-semibold">Save as Quick Order</span>
                              </div>
                               <div 
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDropOnChangeSupplierZone}
                                className="h-24 w-40 flex flex-col items-center justify-center bg-indigo-900/50 border-2 border-dashed border-indigo-500 rounded-xl"
                                title="Change Supplier"
                              >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                  <span className="text-xs text-indigo-300 font-semibold">Change Supplier</span>
                              </div>
                          </>
                      )}
                  </div>
                  
                  <div 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDropOnDeleteZone}
                    className="fixed bottom-4 right-4 z-40 h-24 w-24 flex items-center justify-center bg-red-900/50 border-2 border-dashed border-red-500 rounded-full"
                    title="Delete"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </div>
                </>
            )}
        </main>
      </div>
      <NotificationBell isControlled isOpen={isNotificationPanelOpen} setIsOpen={setIsNotificationPanelOpen} position={{top: 50, left: yellowDotRef.current?.getBoundingClientRect().left ?? 0}} />
      {headerMenu && <ContextMenu x={headerMenu.x} y={headerMenu.y} options={getMenuOptions()} onClose={() => setHeaderMenu(null)} />}
      <KaliReportModal isOpen={isKaliReportModalOpen} onClose={() => setIsKaliReportModalOpen(false)} onGenerate={handleSendKaliUnifyReport} isSending={isSendingReport} orders={completedKaliOrders} itemPrices={itemPrices} />
      <TelegramWebhookModal isOpen={isTelegramWebhookModalOpen} onClose={() => setIsTelegramWebhookModalOpen(false)} />
      <PipWindow isOpen={isKaliPipOpen} onClose={() => setIsKaliPipOpen(false)} />
      {isSelectStoreForShareModalOpen && (
        <SelectStoreForShareModal
          isOpen={isSelectStoreForShareModalOpen}
          onClose={() => { setIsSelectStoreForShareModalOpen(false); setSharedText(null); dispatch({ type: 'CLEAR_INITIAL_ACTION' }); }}
          onStoreSelect={handleStoreSelectedForShare}
        />
      )}
      <AddSupplierModal 
          isOpen={isChangeSupplierModalOpen} 
          onClose={() => { setChangeSupplierModalOpen(false); setOrderIdToChangeSupplier(null); }} 
          onSelect={handleChangeSupplierFromDrop}
          title="Change Supplier To..."
      />
      {orderIdToSave && <SaveQuickOrderModal isOpen={isSaveQuickOrderModalOpen} onClose={() => { setIsSaveQuickOrderModalOpen(false); setOrderIdToSave(null); }} orderId={orderIdToSave} />}
      <QuickOrderListModal isOpen={isQuickOrderListModalOpen} onClose={() => setIsQuickOrderListModalOpen(false)} />
    </>
  );
};

export default App;
