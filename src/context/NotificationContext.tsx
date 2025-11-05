import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { useToasts, ToastType } from './ToastContext';

interface Notification {
  id: number;
  message: string;
}

interface NotificationState {
    notifications: Notification[];
    hasUnread: boolean;
    hasUnreadActivity: boolean;
}

interface NotificationDispatch {
    addNotification: (message: string, type: 'standard' | 'activity') => void;
    addQueuedToast: (message: string) => void;
    showQueuedToasts: () => void;
    markAllAsRead: () => void;
    clearNotifications: () => void;
}

const NotificationStateContext = createContext<NotificationState | undefined>(undefined);
const NotificationDispatchContext = createContext<NotificationDispatch | undefined>(undefined);

let notificationId = 0;
let queuedToastId = 0;

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [hasUnread, setHasUnread] = useState(false);
    const [hasUnreadActivity, setHasUnreadActivity] = useState(false);
    const [queuedToasts, setQueuedToasts] = useState<Omit<Notification, 'id'>[]>([]);
    const { addToast } = useToasts();


    const addNotification = useCallback((message: string, type: 'standard' | 'activity') => {
        const newNotification = { id: notificationId++, message };
        setNotifications(current => [newNotification, ...current].slice(0, 50)); // Keep last 50
        if (type === 'activity') {
            setHasUnreadActivity(true);
        } else {
            setHasUnread(true);
        }
    }, []);
    
    const addQueuedToast = useCallback((message: string) => {
        setQueuedToasts(current => [...current, { message }]);
        setHasUnreadActivity(true); // Also trigger the green bell for actions that queue toasts
    }, []);

    const showQueuedToasts = useCallback(() => {
        if (queuedToasts.length > 0) {
            queuedToasts.forEach(toast => addToast(toast.message, 'success'));
            setQueuedToasts([]);
        }
    }, [queuedToasts, addToast]);

    const markAllAsRead = useCallback(() => {
        setHasUnread(false);
        setHasUnreadActivity(false);
    }, []);

    const clearNotifications = useCallback(() => {
        setNotifications([]);
        setHasUnread(false);
        setHasUnreadActivity(false);
    }, []);
    
    return (
        <NotificationStateContext.Provider value={{ notifications, hasUnread, hasUnreadActivity }}>
            <NotificationDispatchContext.Provider value={{ addNotification, addQueuedToast, showQueuedToasts, markAllAsRead, clearNotifications }}>
                {children}
            </NotificationDispatchContext.Provider>
        </NotificationStateContext.Provider>
    );
};

export const useNotificationState = () => {
  const context = useContext(NotificationStateContext);
  if (context === undefined) throw new Error('useNotificationState must be used within a NotificationProvider');
  return context;
};

export const useNotificationDispatch = () => {
  const context = useContext(NotificationDispatchContext);
  if (context === undefined) throw new Error('useNotificationDispatch must be used within a NotificationProvider');
  return context;
};

// This is the new primary hook for all components to use for notifications.
export const useNotifier = () => {
    const { addToast } = useToasts();
    const { addNotification, addQueuedToast } = useNotificationDispatch();

    const notify = useCallback((message: string, type: ToastType | 'activity' | 'activity-toast') => {
        if (type === 'error') {
            addToast(message, type);
        } else if (type === 'activity') {
            addNotification(message, 'activity');
        } else if (type === 'activity-toast') {
            addQueuedToast(message);
        } else { // 'success' or 'info'
            addNotification(message, 'standard');
        }
    }, [addToast, addNotification, addQueuedToast]);

    return { notify };
};