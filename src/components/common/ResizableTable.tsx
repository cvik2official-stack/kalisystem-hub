import React, { useState, useEffect, useRef, useMemo, useImperativeHandle } from 'react';
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
  rightAlignedActions?: (toggleColumnMenu: (e: React.MouseEvent) => void) => React.ReactNode;
}

export interface ResizableTableRef {
  toggleColumnMenu: (e: React.MouseEvent) => void;
}

const ResizableTable = <T extends { id: string }>({ columns, data, tableKey, toolbar, rightAlignedActions }: ResizableTableProps<T>, ref: React.Ref<ResizableTableRef>) => {
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [isReady, setIsReady] = useState(false);
  const [menu, setMenu] = useState<{ x: number, y: number } | null>(null);

  useImperativeHandle(ref, () => ({
    toggleColumnMenu: handleToggleColumnMenu
  }));

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

  const toggleVisibility = (id: string) => {
    setVisibility(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getMenuOptions = () => {
    return columns.map(col => ({
      label: `${visibility[col.id] ? '✓' : '    '} ${col.header}`,
      action: () => toggleVisibility(col.id),
    }));
  };

  const handleToggleColumnMenu = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ x: rect.left, y: rect.bottom + 5 });
  };

  if (!isReady) {
    return null; // or a loading spinner
  }

  return (
    <div className="overflow-hidden flex-grow flex flex-col w-full">
      {(toolbar || rightAlignedActions) && (
        <div className="pt-4 flex justify-between items-center">
          {toolbar || <div />}
          <div className="flex items-center space-x-2">
              {rightAlignedActions && rightAlignedActions(handleToggleColumnMenu)}
          </div>
        </div>
      )}
      <div className="flex-grow overflow-auto hide-scrollbar">
        <table className="min-w-full divide-y divide-gray-700 border-separate" style={{ borderSpacing: 0, tableLayout: 'auto' }}>
          <thead className="bg-gray-800 sticky top-0 z-10">
            <tr>
              {visibleColumns.map((col, i) => (
                <th
                  key={col.id}
                  style={{ minWidth: 40 }}
                  className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider relative border-b border-gray-700"
                  title={col.title || col.header}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{col.header}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {data.map(item => (
              <tr key={item.id} className="hover:bg-gray-700/50">
                {visibleColumns.map(col => (
                  <td key={col.id} className="px-2 py-1 text-sm text-gray-300 align-middle">
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

export default React.forwardRef(ResizableTable) as <T extends { id: string }>(props: ResizableTableProps<T> & { ref?: React.Ref<ResizableTableRef> }) => React.ReactElement;