import React, { useState, useEffect, useRef } from 'react';
import { useNotificationState, useNotificationDispatch } from '../context/NotificationContext';

const NotificationBell: React.FC = () => {
  const { notifications, hasUnread } = useNotificationState();
  const { markAllAsRead, clearNotifications } = useNotificationDispatch();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasUnread) {
      setShouldAnimate(true);
      const timer = setTimeout(() => setShouldAnimate(false), 800); // Duration of the wobble animation
      return () => clearTimeout(timer);
    }
  }, [hasUnread, notifications]); // Rerun animation on new notification

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setIsPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBellClick = () => {
    setIsPanelOpen(prev => !prev);
    if (hasUnread) {
      markAllAsRead();
    }
  };

  const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      clearNotifications();
      setIsPanelOpen(false);
  }

  return (
    <div className="relative" ref={bellRef}>
      <button
        onClick={handleBellClick}
        className="text-gray-400 hover:text-white p-1"
        aria-label="Notifications"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-colors ${hasUnread ? 'text-yellow-400' : ''} ${shouldAnimate ? 'animate-wobble' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
        </svg>
      </button>

      {isPanelOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-gray-700 rounded-md shadow-2xl z-[100] text-sm">
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
