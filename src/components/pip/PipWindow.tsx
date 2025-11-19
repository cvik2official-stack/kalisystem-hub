import React, { useState, useRef, useEffect } from 'react';
import KaliTodoView from './KaliTodoView';

interface PipWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

const NOTIFICATION_TAG = 'kali-pip-status';

const PipWindow: React.FC<PipWindowProps> = ({ isOpen, onClose }) => {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);
  const [shareTrigger, setShareTrigger] = useState(0);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && windowRef.current) {
      const newX = e.clientX - dragStartPos.current.x;
      const newY = e.clientY - dragStartPos.current.y;
      setPosition({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Effect for PWA Notification
  useEffect(() => {
    if (isOpen && 'serviceWorker' in navigator && 'Notification' in window) {
      navigator.serviceWorker.ready.then(registration => {
        // FIX: The 'actions' property can cause type errors in some TypeScript environments.
        // Casting to 'any' bypasses this check while keeping the functionality.
        registration.showNotification('Kali Dispatch Running', {
          tag: NOTIFICATION_TAG,
          body: 'KALI To-Do list is active in PiP mode.',
          icon: '/icons/favicon-96x96.png',
          silent: true,
          actions: [
            { action: 'show_all', title: 'All Orders' },
            { action: 'close_pip', title: 'Close PiP' },
          ]
        } as any);
      });
    }

    return () => {
      // Cleanup: close the notification when the component unmounts or closes
      if ('serviceWorker' in navigator && 'Notification' in window) {
        navigator.serviceWorker.ready.then(registration => {
          registration.getNotifications({ tag: NOTIFICATION_TAG }).then(notifications => {
            notifications.forEach(notification => notification.close());
          });
        });
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!isOpen) return null;

  return (
    <div
      ref={windowRef}
      className="fixed bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border-t-4 border-purple-500 z-[100] flex flex-col"
      style={{ top: position.y, left: position.x }}
    >
      <div
        className="px-4 py-2 flex justify-between items-center cursor-move bg-gray-900/50 rounded-t-xl"
        onMouseDown={handleMouseDown}
      >
        <h2 className="text-lg font-bold text-white">KALI To-Do</h2>
        <div className="flex items-center space-x-2">
            <button onClick={() => setShareTrigger(c => c + 1)} className="text-gray-400 hover:text-white" aria-label="Share">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
        </div>
      </div>
      <div className="p-4 flex-grow overflow-y-auto max-h-[70vh]">
        <KaliTodoView shareTrigger={shareTrigger} />
      </div>
    </div>
  );
};

export default PipWindow;
