
import { useEffect, Dispatch } from 'react';
import { AppState, OrderStatus } from '../types';
import { Action } from '../context/AppContext';
import { getAcknowledgedOrderUpdates, updateOrder as supabaseUpdateOrder } from '../services/supabaseService';
import { sendReminderToSupplier } from '../services/telegramService';
import { ToastType } from '../context/ToastContext';

export const useBackgroundSync = (
    state: AppState,
    dispatch: Dispatch<Action>,
    notify: (message: string, type: ToastType) => void
) => {
    useEffect(() => {
        const intervalId = setInterval(async () => {
            if (!navigator.onLine || !state.isInitialized) return;

            // --- Acknowledgement Polling ---
            try {
                const unacknowledgedOnTheWay = state.orders
                    .filter(o => {
                        if (o.status !== OrderStatus.ON_THE_WAY || o.isAcknowledged) {
                            return false;
                        }
                        const supplier = state.suppliers.find(s => s.id === o.supplierId);
                        // Only poll for suppliers who have the OK button enabled
                        return supplier?.botSettings?.showOkButton === true;
                    })
                    .map(o => o.id);

                if (unacknowledgedOnTheWay.length > 0) {
                    const acknowledgedUpdates = await getAcknowledgedOrderUpdates({
                        orderIds: unacknowledgedOnTheWay,
                        url: state.settings.supabaseUrl,
                        key: state.settings.supabaseKey,
                    });

                    for (const ackUpdate of acknowledgedUpdates) {
                        const localOrder = state.orders.find(o => o.id === ackUpdate.id);
                        if (localOrder && !localOrder.isAcknowledged) {
                            notify(`Order ${ackUpdate.order_id} was acknowledged.`, 'success');
                            dispatch({ type: 'UPDATE_ORDER', payload: { ...localOrder, isAcknowledged: true, modifiedAt: new Date().toISOString() } });
                        }
                    }
                }
            } catch (e: any) {
              // Be less noisy with fetch errors, which are common when offline
              if (e?.message && !e.message.includes('Failed to fetch')) {
                console.warn('Background sync for acknowledgements failed:', e);
              }
            }

            // --- Reminder Polling ---
            try {
                const FORTY_FIVE_MINUTES = 45 * 60 * 1000;
                const ordersToRemind = state.orders.filter(o => {
                    if (o.status !== OrderStatus.ON_THE_WAY || o.isAcknowledged || o.reminderSentAt) return false;
                    const supplier = state.suppliers.find(s => s.id === o.supplierId);
                    if (!supplier?.botSettings?.showOkButton || !supplier.botSettings.enableReminderTimer) return false;
                    const timeDiff = new Date().getTime() - new Date(o.modifiedAt).getTime();
                    return timeDiff > FORTY_FIVE_MINUTES;
                });
                
                if (ordersToRemind.length > 0 && state.settings.telegramBotToken) {
                    for (const order of ordersToRemind) {
                        const supplier = state.suppliers.find(s => s.id === order.supplierId)!;
                        await sendReminderToSupplier(order, supplier, state.settings.telegramBotToken);
                        const updatedOrder = await supabaseUpdateOrder({ order: { ...order, reminderSentAt: new Date().toISOString() }, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
                        dispatch({ type: 'UPDATE_ORDER', payload: updatedOrder });
                    }
                }
            } catch (e) { console.warn('Background check for reminders failed:', e); }

        }, 30000); // Poll every 30 seconds

        return () => clearInterval(intervalId);
    }, [state.isInitialized, state.settings, state.orders, state.suppliers, dispatch, notify]);
};
