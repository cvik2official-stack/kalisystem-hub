
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ContextMenu from '../ContextMenu';

interface ColumnDef<T> {
  id: string;
  header: string;
  title?: string;
  initialWidth: number;
  cell: (data: T) => React.ReactNode;
}

interface ResizableTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  tableKey: string;
  toolbar?: React.ReactNode;
  rightAlignedActions?: React.ReactNode;
}

const ResizableTable = <T extends { id: string }>({ columns, data, tableKey, toolbar, rightAlignedActions }: ResizableTableProps<T>) => {
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [isReady, setIsReady] = useState(false);
  const [menu, setMenu] = useState<{ x: number, y: number } | null>(null);

  const tableRef = useRef<HTMLTableElement>(null);
  const activeIndex = useRef<number | null>(null);

  useEffect(() => {
    const savedSettings = localStorage.getItem(tableKey);
    const initialWidths: Record<string, number> = {};
    const initialVisibility: Record<string, boolean> = {};

    columns.forEach(col => {
      initialWidths[col.id] = col.initialWidth;
      initialVisibility[col.id] = true;
    });

    if (savedSettings) {
      const { savedWidths, savedVisibility } = JSON.parse(savedSettings);
      Object.assign(initialWidths, savedWidths);
      Object.assign(initialVisibility, savedVisibility);
    }
    
    setWidths(initialWidths);
    setVisibility(initialVisibility);
    setIsReady(true);
  }, [columns, tableKey]);

  useEffect(() => {
    if (!isReady) return;
    const settings = { savedWidths: widths, savedVisibility: visibility };
    localStorage.setItem(tableKey, JSON.stringify(settings));
  }, [widths, visibility, tableKey, isReady]);

  const visibleColumns = useMemo(() => columns.filter(c => visibility[c.id]), [columns, visibility]);

  const handleMouseDown = (index: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    activeIndex.current = index;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (activeIndex.current === null || !tableRef.current) return;
    
    const gridColumns = visibleColumns.map((col, i) => {
        if (i === activeIndex.current) {
            const th = tableRef.current?.querySelectorAll('th')[i];
            if (th) {
                const newWidth = e.clientX - th.getBoundingClientRect().left;
                if (newWidth > 40) { // Minimum width
                    setWidths(prev => ({...prev, [col.id]: newWidth}));
                    return `${newWidth}px`;
                }
            }
        }
        return `${widths[col.id]}px`;
    });

    if (tableRef.current) {
        tableRef.current.style.gridTemplateColumns = gridColumns.join(' ');
    }
  }, [visibleColumns, widths]);

  const handleMouseUp = useCallback(() => {
    activeIndex.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleMouseMove]);

  const toggleVisibility = (id: string) => {
    setVisibility(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getMenuOptions = () => {
    return columns.map(col => ({
      label: `${visibility[col.id] ? '✓' : '    '} ${col.header}`,
      action: () => toggleVisibility(col.id),
    }));
  };

  if (!isReady) {
    return null; // or a loading spinner
  }

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden flex-grow flex flex-col w-full">
      <div className="px-4 pt-4 flex justify-between items-center">
        {toolbar || <div />}
        <div className="flex items-center space-x-2">
            {rightAlignedActions}
            <button
                onClick={(e) => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setMenu({ x: rect.left, y: rect.bottom + 5 });
                }}
                className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700"
                aria-label="Toggle column visibility"
                title="Show/hide columns"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
            </button>
        </div>
      </div>
      <div className="flex-grow overflow-auto hide-scrollbar">
        <table className="min-w-full divide-y divide-gray-700 border-separate" style={{ borderSpacing: 0 }}>
          <thead className="bg-gray-800 sticky top-0 z-10">
            <tr>
              {visibleColumns.map((col, i) => (
                <th
                  key={col.id}
                  style={{ width: widths[col.id], minWidth: 40 }}
                  className="pl-4 pr-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider relative border-b border-gray-700"
                  title={col.title || col.header}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{col.header}</span>
                    <div
                      onMouseDown={handleMouseDown(i)}
                      className="absolute right-0 top-0 h-full w-px bg-gray-600 cursor-col-resize hover:w-1 hover:bg-indigo-500"
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {data.map(item => (
              <tr key={item.id} className="hover:bg-gray-700/50">
                {visibleColumns.map(col => (
                  <td key={col.id} style={{ width: widths[col.id] }} className="pl-4 pr-2 py-1 text-sm text-gray-300 align-middle">
                    {col.cell(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          options={getMenuOptions()}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
};

export default ResizableTable;
