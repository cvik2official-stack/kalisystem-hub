// FIX: Import 'useContext' to resolve 'Cannot find name' error.
import React, { useContext } from 'react';
import { AppContext } from '../../context/AppContext';

const SuppliersSettings: React.FC = () => {
  const { state } = useContext(AppContext);

  return (
    <div className="flex flex-col flex-grow">
      <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden flex-grow flex flex-col w-full md:w-1/2">
        <div className="flex-grow overflow-y-auto hide-scrollbar">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800 sticky top-0 z-10">
              <tr>
                <th className="pl-4 pr-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Name
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {state.suppliers.sort((a,b) => a.name.localeCompare(b.name)).map(supplier => (
                <tr key={supplier.id} className="hover:bg-gray-700/50">
                  <td className="pl-4 pr-6 py-2 text-sm text-white whitespace-nowrap">{supplier.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SuppliersSettings;