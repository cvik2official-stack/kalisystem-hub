import React, { useState, useRef, useEffect } from 'react';
import KaliTodoView from './KaliTodoView';

interface PipWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

const PipWindow: React.FC<PipWindowProps> = ({ isOpen, onClose }) => {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

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
        <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-4 flex-grow overflow-y-auto max-h-[70vh]">
        <KaliTodoView />
      </div>
    </div>
  );
};

export default PipWindow;
