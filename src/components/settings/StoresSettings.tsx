import React, { useContext, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import { StoreName } from '../../types';

const StoresSettings: React.FC = () => {
  const { state } = useContext(AppContext);

  const storesForTable = useMemo(() => {
    const kaliStore = { name: 'KALI' as StoreName };
    return [...state.stores, kaliStore].sort((a, b) => a.name.localeCompare(b.name));
  }, [state.stores]);

  return (
    <div className="flex flex-col flex-grow">
      <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden flex-grow flex flex-col w-full">
        <div className="flex-grow overflow-y-auto hide-scrollbar">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800 sticky top-0 z-10">
              <tr>
                <th className="pl-4 pr-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Store Name
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {storesForTable.map(store => (
                <tr key={store.name} className="hover:bg-gray-700/50">
                  <td className="pl-4 pr-6 py-2 text-sm text-white whitespace-nowrap">{store.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StoresSettings;