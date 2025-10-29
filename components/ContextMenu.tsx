
import React, { useEffect, useRef } from 'react';

interface ContextMenuOption {
    label: string;
    action: () => void;
    isDestructive?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    options: ContextMenuOption[];
    onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, options, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

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

    return (
        <div
            ref={menuRef}
            className="fixed bg-gray-700 rounded-md shadow-2xl py-1 z-[100] min-w-[150px]"
            style={{ top: y, left: x }}
        >
            <ul>
                {options.map((option, index) => (
                    <li key={index}>
                        <button
                            onClick={() => {
                                option.action();
                                onClose();
                            }}
                            className={`w-full text-left px-4 py-2 text-sm ${option.isDestructive ? 'text-red-400 hover:bg-red-500 hover:text-white' : 'text-gray-200 hover:bg-indigo-500 hover:text-white'
                                }`}
                        >
                            {option.label}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default ContextMenu;
