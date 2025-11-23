import React, { useEffect, useRef, useState } from 'react';

interface ContextMenuOption {
    label: string;
    action?: (event: React.MouseEvent) => void;
    isDestructive?: boolean;
    isHeader?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    options: ContextMenuOption[];
    onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, options, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [finalX, setFinalX] = useState(x);
    const [finalY, setFinalY] = useState(y);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEsc);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [onClose]);

    // This effect runs after the component renders and adjusts its position if it overflows.
    useEffect(() => {
        if (menuRef.current) {
            const menuWidth = menuRef.current.offsetWidth;
            const menuHeight = menuRef.current.offsetHeight;
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const buffer = 12; // Increased padding from the edge

            let newX = x;
            let newY = y;

            // Check if the menu would overflow the right edge
            if (x + menuWidth > windowWidth - buffer) {
                newX = windowWidth - menuWidth - buffer;
            }

            // Make sure it doesn't go off the left edge.
            if (newX < buffer) {
                newX = buffer;
            }
            
            // Check if the menu would overflow the bottom edge
            if (y + menuHeight > windowHeight - buffer) {
                // Reposition menu to open upwards.
                newY = y - menuHeight;
                // Safety check to ensure it doesn't go off the top of the screen.
                if (newY < buffer) {
                    newY = buffer;
                }
            }


            setFinalX(newX);
            setFinalY(newY);
        }
    }, [x, y, options]); // Added options to dependency to recalc if content changes

    return (
        <div
            ref={menuRef}
            className="fixed bg-gray-900 border border-gray-700 rounded-xl shadow-2xl py-1.5 z-[100] min-w-[180px] backdrop-blur-sm ring-1 ring-black/50 flex flex-col animate-in fade-in zoom-in-95 duration-100"
            style={{ top: finalY, left: finalX }}
        >
            <ul>
                {options.map((option, index) => {
                    const isIndented = option.label.trim() !== option.label;
                    return (
                        <li key={index}>
                            {option.isHeader ? (
                                <div className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-800 mb-1 mt-1 first:mt-0 bg-gray-900/50">
                                    {option.label}
                                </div>
                            ) : (
                                <button
                                    onClick={(e) => {
                                        if (option.action) option.action(e);
                                        onClose();
                                    }}
                                    className={`w-full text-left py-2.5 text-sm font-medium transition-colors flex items-center 
                                        ${isIndented ? 'pl-8 pr-4' : 'px-4'} 
                                        ${option.isDestructive 
                                            ? 'text-red-400 hover:bg-red-900/20 hover:text-red-300' 
                                            : 'text-gray-300 hover:bg-indigo-600 hover:text-white'
                                        }
                                    `}
                                >
                                    {option.label.trim()}
                                </button>
                            )}
                        </li>
                    )
                })}
            </ul>
        </div>
    );
};

export default ContextMenu;