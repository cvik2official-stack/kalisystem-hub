import React, { useEffect, useRef, useState } from 'react';

interface ContextMenuOption {
    label: string;
    action?: () => void;
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
            const windowWidth = window.innerWidth;
            const buffer = 8; // 8px padding from the edge

            let newX = x;

            // Check if the menu would overflow the right edge
            if (x + menuWidth > windowWidth - buffer) {
                // Reposition menu to be fully visible, aligning its right edge.
                newX = windowWidth - menuWidth - buffer;
            }

            // Make sure it doesn't go off the left edge.
            if (newX < buffer) {
                newX = buffer;
            }

            setFinalX(newX);
        }
    }, [x, y]); // Re-run when initial position changes

    return (
        <div
            ref={menuRef}
            className="fixed bg-gray-700 rounded-md shadow-2xl py-1 z-[100] min-w-[150px]"
            style={{ top: y, left: finalX }}
        >
            <ul>
                {options.map((option, index) => {
                    const isIndented = option.label.trim() !== option.label;
                    return (
                        <li key={index}>
                            {option.isHeader ? (
                                <span className="block px-4 pt-2 pb-1 text-xs font-bold text-gray-400 uppercase tracking-wider">{option.label}</span>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (option.action) option.action();
                                        onClose();
                                    }}
                                    className={`w-full text-left py-2 text-sm ${isIndented ? 'pl-8 pr-4' : 'px-4'} ${option.isDestructive ? 'text-red-400 hover:bg-red-500 hover:text-white' : 'text-gray-200 hover:bg-indigo-500 hover:text-white'
                                        }`}
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