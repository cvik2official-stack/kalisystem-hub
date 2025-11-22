
import React, { useContext, useEffect, useState, useRef, useMemo } from 'react';
import StoreTabs from './components/StoreTabs';
import OrderWorkspace from './components/OrderWorkspace';
import SettingsPage from './components/SettingsPage';
import { AppContext } from './context/AppContext';
import ToastContainer from './components/ToastContainer';
import { OrderStatus, StoreName, SupplierName, SettingsTab, PaymentMethod, Order, Supplier } from './types';
import { generateKaliZapReport, generateOrderMessage } from './utils/messageFormatter';
import { sendKaliZapReport, sendOrderToSupplierOnTelegram } from './services/telegramService';
import { useNotifier } from './context/NotificationContext';
import ContextMenu from './components/ContextMenu';
import NotificationBell from './components/NotificationBell';
import TelegramWebhookModal from './components/modals/TelegramWebhookModal';
import { useNotificationState, useNotificationDispatch } from './context/NotificationContext';
import AddSupplierModal from './components/modals/AddSupplierModal';
import SaveQuickOrderModal from './components/modals/SaveQuickOrderModal';
import QuickOrderListModal from './components/modals/QuickOrderListModal';


const App: React.FC = () => {
  const { state, dispatch, actions } = useContext(AppContext);
  const { activeStore, isInitialized, syncStatus, orders, settings, itemPrices, suppliers, draggedOrderId, draggedItem, activeSettingsTab, activeStatus } = state;
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

  const [isSendingZapReport, setIsSendingZapReport] = useState(false);
  const [headerMenu, setHeaderMenu] = useState<{ x: number, y: number } | null>(null);
  const [isTelegramWebhookModalOpen, setIsTelegramWebhookModalOpen] = useState(false);
  
  // State for Drag-to-Change Supplier
  const [isChangeSupplierModalOpen, setChangeSupplierModalOpen] = useState(false);
  const [orderIdToChangeSupplier, setOrderIdToChangeSupplier] = useState<string | null>(null);
  
  // State for Quick Orders
  const [isSaveQuickOrderModalOpen, setIsSaveQuickOrderModalOpen] = useState(false);
  const [isQuickOrderListModalOpen, setIsQuickOrderListModalOpen] = useState(false);
  const [orderIdToSave, setOrderIdToSave] = useState<string | null>(null);
  
  // Listen for messages from the service worker (for notification actions)
  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
        if (event.data && event.data.action) {
            switch (event.data.action) {
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
  }, [activeStore, activeSettingsTab, activeStatus, state.columnCount]);


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

  // Function to send Kali Zap report
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

  const handleTriggerQuickOrder = async (quickOrderName: string) => {
      // Case insensitive search
      const targetQO = state.quickOrders.find(qo => qo.name.toLowerCase() === quickOrderName.toLowerCase());
      if (!targetQO) {
          notify(`Quick Order "${quickOrderName}" not found.`, 'error');
          return;
      }
      
      try {
          const supplier = state.suppliers.find(s => s.id === targetQO.supplierId);
          if (!supplier) throw new Error('Supplier not found');

          const newOrder = await actions.addOrder(supplier, targetQO.store, targetQO.items, OrderStatus.DISPATCHING);

          if (state.settings.telegramBotToken && supplier.chatId) {
             await sendOrderToSupplierOnTelegram(newOrder, supplier, generateOrderMessage(newOrder, 'html', state.suppliers, state.stores, state.settings), state.settings.telegramBotToken);
          }
          
          await actions.updateOrder({ ...newOrder, status: OrderStatus.ON_THE_WAY, isSent: true });
          notify(`Quick Order "${targetQO.name}" executed!`, 'success');
      } catch (e: any) {
          notify(`Failed: ${e.message}`, 'error');
      }
  };

  useEffect(() => {
    if (!isInitialized) return;

    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');

    if (action) {
      if (action === 'show_all') {
        dispatch({ type: 'SET_ACTIVE_STORE', payload: 'ALL' });
      } else if (action === 'kali-est') {
          handleSendKaliZapReport();
      } else if (action === 'salmon') {
          handleTriggerQuickOrder('CV2_CHARONAI_SALMON');
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [isInitialized, dispatch, orders, itemPrices, settings, state.quickOrders]); 

  
  const handleHeaderMenuClick = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHeaderMenu({ x: rect.right - 150, y: rect.bottom + 5 });
  };

  const handleRedDotClick = () => {
      // If we are on the settings page, always exit to the default view
      if (activeStore === 'Settings') {
          dispatch({ type: 'SET_ACTIVE_STORE', payload: StoreName.CV2 });
          return;
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

  return (
    <>
      <div 
        className={`min-h-screen bg-gray-900 text-gray-200 flex flex-col font-sans transition-opacity duration-500 ${isDragging ? 'opacity-80' : 'opacity-100'}`}
        onDragOver={(e) => { e.preventDefault(); }}
      >
        <ToastContainer />
        
        <main className="flex flex-col flex-grow p-2 lg:px-[10%] max-w-full mx-auto w-full">
            <header className="flex-shrink-0 mb-4 sticky top-0 bg-gray-900/80 backdrop-blur-sm z-30 py-2 flex flex-col md:flex-row md:items-center md:justify-between md:flex-nowrap">
                {/* Mobile Top Row Wrapper / Desktop 'Contents' to unwrap children into parent flex container */}
                <div className="flex items-center justify-between w-full md:w-auto md:contents">
                    {/* Left: Status Dots (Order 1 on Desktop) */}
                    <div className="flex items-center space-x-2 md:order-1">
                        <button onClick={handleRedDotClick} className="w-4 h-4 bg-red-500 rounded-full block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-red-500 relative" title="Exit Settings">
                            {isRedAnimating && <span className="absolute inset-0 rounded-full bg-red-500 animate-ping-once"></span>}
                        </button>
                        <button ref={yellowDotRef} onClick={handleYellowDotClick} className="relative w-4 h-4 bg-yellow-400 rounded-full block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-yellow-400" title="Notifications">
                            {hasUnread && <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full ${isYellowAnimating ? 'animate-wobble' : ''}`}></span>}
                        </button>
                        <button onClick={handleGreenDotClick} className="relative w-4 h-4 bg-green-500 rounded-full block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-green-500" title="Sync with Database">
                            <span className={`absolute inset-0 rounded-full bg-green-500 ${greenDotAnimationClass}`}></span>
                        </button>
                    </div>

                    {/* Right: Menu Button (Order 3 on Desktop) */}
                    <div className="flex items-center space-x-2 md:order-3">
                        <button onClick={handleHeaderMenuClick} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white rounded-full hover:bg-gray-800 focus:outline-none transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Store Tabs (Order 2 on Desktop) - Will wrap to new line on mobile because parent is flex-col */}
                <div className="w-full mt-2 md:mt-0 md:w-auto md:flex-grow md:px-4 md:order-2">
                    <StoreTabs />
                </div>
            </header>

            <div className="flex-grow flex flex-col">
                {activeStore === 'Settings' ? (
                    <SettingsPage /> 
                ) : (
                    <OrderWorkspace />
                )}
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
      {headerMenu && (
          <ContextMenu
              x={headerMenu.x}
              y={headerMenu.y}
              options={[
                  { label: 'Kali Est', action: handleSendKaliZapReport },
                  { label: 'Quick Orders', action: () => setIsQuickOrderListModalOpen(true) },
                  { label: 'Settings', action: () => dispatch({ type: 'NAVIGATE_TO_SETTINGS', payload: 'items' }) },
                  { label: 'Telegram Webhook', action: () => setIsTelegramWebhookModalOpen(true) },
              ]}
              onClose={() => setHeaderMenu(null)}
          />
      )}
      <TelegramWebhookModal isOpen={isTelegramWebhookModalOpen} onClose={() => setIsTelegramWebhookModalOpen(false)} />
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
