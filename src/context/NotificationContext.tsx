import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { useToasts, ToastType } from './ToastContext';

interface Notification {
  id: number;
  message: string;
}

interface NotificationState {
    notifications: Notification[];
    hasUnread: boolean;
}

interface NotificationDispatch {
    addNotification: (message: string) => void;
    markAllAsRead: () => void;
    clearNotifications: () => void;
}

const NotificationStateContext = createContext<NotificationState | undefined>(undefined);
const NotificationDispatchContext = createContext<NotificationDispatch | undefined>(undefined);

let notificationId = 0;

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [hasUnread, setHasUnread] = useState(false);

    const addNotification = useCallback((message: string) => {
        const newNotification = { id: notificationId++, message };
        setNotifications(current => [newNotification, ...current].slice(0, 50)); // Keep last 50
        setHasUnread(true);
    }, []);

    const markAllAsRead = useCallback(() => {
        setHasUnread(false);
    }, []);

    const clearNotifications = useCallback(() => {
        setNotifications([]);
        setHasUnread(false);
    }, []);
    
    return (
        <NotificationStateContext.Provider value={{ notifications, hasUnread }}>
            <NotificationDispatchContext.Provider value={{ addNotification, markAllAsRead, clearNotifications }}>
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
    const { addNotification } = useNotificationDispatch();

    const notify = useCallback((message: string, type: ToastType) => {
        if (type === 'error') {
            addToast(message, type);
        } else {
            addNotification(message);
        }
    }, [addToast, addNotification]);

    return { notify };
};
