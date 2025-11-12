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
          className="text-gray-400 hover:text-white p-1"
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
          className="mt-2 w-72 bg-gray-700 rounded-md shadow-2xl z-[100] text-sm"
        >
          <div className="flex justify-between items-center p-3 border-b border-gray-600">
            <h3 className="font-semibold text-white">Notifications</h3>
            {notifications.length > 0 && (
                <button onClick={handleClear} className="text-indigo-400 hover:text-indigo-300 text-xs font-medium">Clear All</button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto hide-scrollbar">
            {notifications.length > 0 ? (
              <ul>
                {notifications.map(n => (
                  <li key={n.id} className="p-3 border-b border-gray-600/50">
                    <p className="text-gray-300">{n.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 text-center p-6">No new notifications.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;