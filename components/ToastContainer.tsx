import React from 'react';
import { useToastState } from '../context/ToastContext';

const Toast: React.FC<{ message: string, type: string }> = ({ message, type }) => {
    const baseClasses = 'flex items-center w-full max-w-xs p-4 mb-4 text-white rounded-lg shadow-lg';
    const typeClasses: { [key: string]: string } = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        info: 'bg-blue-600',
    };
    const icon: { [key: string]: string } = {
        success: '✓',
        error: '✖',
        info: 'ℹ'
    }

    return (
        <div className={`${baseClasses} ${typeClasses[type] || 'bg-gray-700'}`} role="alert">
            <div className="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 text-lg font-bold">
                {icon[type]}
            </div>
            <div className="ml-3 text-sm font-normal">{message}</div>
        </div>
    )
}

const ToastContainer: React.FC = () => {
  const toasts = useToastState();

  return (
    <div className="fixed top-5 right-5 z-[100] space-y-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} />
      ))}
    </div>
  );
};

export default ToastContainer;