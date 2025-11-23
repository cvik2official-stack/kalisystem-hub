
import React, { useState, useEffect, useRef } from 'react';
import { useNotificationState, useNotificationDispatch } from '../context/NotificationContext';

interface NotificationBellProps {
  isControlled?: boolean;
  isOpen?: boolean;
  setIsOpen?: (isOpen: boolean) => void;
  position?: { top: number; left: number };
}


const NotificationBell: React.FC<NotificationBellProps> = ({ isControlled, isOpen, setIsOpen, position }) => {
  const { notifications, hasUnread } = useNotificationState();
  const { markAllAsRead, clearNotifications } = useNotificationDispatch();
  
  // Use internal state only if not controlled
  const [isInternalPanelOpen, setInternalPanelOpen] = useState(false);
  
  const isPanelOpen = isControlled ? isOpen! : isInternalPanelOpen;
  const setPanelOpen = isControlled ? setIsOpen! : setInternalPanelOpen;
  
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasUnread) {
      setShouldAnimate(true);
      const timer = setTimeout(() => setShouldAnimate(false), 800);
      return () => clearTimeout(timer);
    }
  }, [hasUnread, notifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setPanelOpen(false);
      }
    };
    if (isPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPanelOpen, setPanelOpen]);

  const handleBellClick = () => {
    setPanelOpen(!isPanelOpen);
    if (hasUnread) {
      markAllAsRead();
    }
  };

  const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      clearNotifications();
      setPanelOpen(false);
  }
  
  const panelStyle = isControlled && position
    ? { top: `${position.top}px`, left: `${position.left}px`, position: 'fixed' as 'fixed' }
    : { top: '100%', right: '0', position: 'absolute' as 'absolute' };

  return (
    <div className="relative" ref={wrapperRef}>
      {!isControlled && (
        <button
          onClick={handleBellClick}
          className="text-gray-400 hover:text-white p-1 transition-colors relative"
          aria-label="Notifications"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-colors ${hasUnread ? 'text-yellow-400' : ''} ${shouldAnimate ? 'animate-wobble' : ''}`} viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
          </svg>
        </button>
      )}

      {isPanelOpen && (
        <div 
          style={panelStyle}
          className="mt-2 w-80 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-[100] text-sm ring-1 ring-black/50 flex flex-col animate-in fade-in zoom-in-95 duration-200 backdrop-blur-sm"
        >
          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800 bg-gray-900/50 rounded-t-xl">
            <h3 className="font-bold text-white uppercase tracking-wider text-xs">Notifications</h3>
            {notifications.length > 0 && (
                <button onClick={handleClear} className="text-indigo-400 hover:text-indigo-300 text-xs font-bold transition-colors uppercase tracking-wide">Clear All</button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto hide-scrollbar">
            {notifications.length > 0 ? (
              <ul>
                {notifications.map(n => (
                  <li key={n.id} className="px-4 py-3 border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors last:border-0">
                    <p className="text-gray-300 leading-relaxed">{n.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p className="text-xs font-medium">No new notifications.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
