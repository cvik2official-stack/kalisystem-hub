import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type: ToastType) => void;
}

// Separate contexts to prevent consumers that only dispatch from re-rendering
const ToastDispatchContext = createContext<ToastContextType | undefined>(undefined);
const ToastStateContext = createContext<Toast[]>([]);

let id = 0;

export const ToastProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const newToast = { id: id++, message, type };
    setToasts(currentToasts => [newToast, ...currentToasts]);
    setTimeout(() => {
      setToasts(currentToasts => currentToasts.filter(t => t.id !== newToast.id));
    }, 4000); // Toasts disappear after 4 seconds
  }, []);

  return (
    <ToastDispatchContext.Provider value={{ addToast }}>
        <ToastStateContext.Provider value={toasts}>
            {children}
        </ToastStateContext.Provider>
    </ToastDispatchContext.Provider>
  );
};

export const useToasts = () => {
  const context = useContext(ToastDispatchContext);
  if (context === undefined) {
    throw new Error('useToasts must be used within a ToastProvider');
  }
  return context;
};

// Hook to get the toast state, used by the ToastContainer
export const useToastState = () => {
    return useContext(ToastStateContext);
}