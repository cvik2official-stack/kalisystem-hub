
import { useEffect, Dispatch } from 'react';
import { AppState, OrderStatus } from '../types';
import { Action } from '../context/AppContext';
import { pollOrderUpdates, updateOrder as supabaseUpdateOrder } from '../services/supabaseService';
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

            // --- Polling Logic (Acknowledgements & Delivery Status) ---
            try {
                const ordersToPoll = state.orders.filter(o => {
                    // Case 1: Waiting for Acknowledgement
                    const waitingForAck = o.status === OrderStatus.ON_THE_WAY && !o.isAcknowledged && (() => {
                         const supplier = state.suppliers.find(s => s.id === o.supplierId);
                         return supplier?.botSettings?.showOkButton === true;
                    })();

                    // Case 2: Waiting for Delivery Confirmation
                    const waitingForDelivery = o.deliveryStatus === 'pending';

                    return waitingForAck || waitingForDelivery;
                });

                if (ordersToPoll.length > 0) {
                    const orderIds = ordersToPoll.map(o => o.id);
                    
                    const updates = await pollOrderUpdates({
                        orderIds,
                        url: state.settings.supabaseUrl,
                        key: state.settings.supabaseKey,
                    });

                    for (const update of updates) {
                        const localOrder = state.orders.find(o => o.id === update.id);
                        if (!localOrder) continue;

                        let hasChanges = false;
                        let updatedOrder = { ...localOrder };

                        // Check Acknowledgement
                        if (update.is_acknowledged && !localOrder.isAcknowledged) {
                            updatedOrder.isAcknowledged = true;
                            notify(`Order ${localOrder.orderId} was acknowledged.`, 'success');
                            hasChanges = true;
                        }

                        // Check Delivery Status
                        if (update.delivery_status && update.delivery_status !== localOrder.deliveryStatus) {
                            updatedOrder.deliveryStatus = update.delivery_status as 'received' | 'not_yet';
                            const msg = update.delivery_status === 'received'
                                ? `Order ${localOrder.orderId} marked as Received.`
                                : `Order ${localOrder.orderId} marked as Not Yet Received.`;
                            const type = update.delivery_status === 'received' ? 'success' : 'error';
                            notify(msg, type);
                            hasChanges = true;
                        }

                        if (hasChanges) {
                            updatedOrder.modifiedAt = new Date().toISOString();
                            dispatch({ type: 'UPDATE_ORDER', payload: updatedOrder });
                        }
                    }
                }
            } catch (e: any) {
              // Be less noisy with fetch errors, which are common when offline
              if (e?.message && !e.message.includes('Failed to fetch')) {
                console.warn('Background sync for updates failed:', e);
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