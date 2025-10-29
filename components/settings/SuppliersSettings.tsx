import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import { Supplier } from '../../types';
import EditSupplierModal from '../modals/EditSupplierModal';

const SuppliersSettings: React.FC = () => {
  const { state, actions } = useContext(AppContext);
  
  const [isSupplierModalOpen, setSupplierModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  
  const handleEditSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setSupplierModalOpen(true);
  };

  const handleSaveSupplier = async (supplier: Supplier) => {
    // This now calls the async action to update the DB
    await actions.updateSupplier(supplier);
    setSupplierModalOpen(false);
  };

  return (
    <div className="flex flex-col flex-grow">
      <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden flex-grow flex flex-col">
        <div className="flex-grow overflow-y-auto hide-scrollbar">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800 sticky top-0 z-10">
              <tr>
                <th className="pl-4 pr-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Telegram Group ID</th>
                <th className="pl-6 pr-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {state.suppliers.sort((a,b) => a.name.localeCompare(b.name)).map(supplier => (
                <tr key={supplier.id} className="hover:bg-gray-700/50">
                  <td className="pl-4 pr-6 py-2 text-sm text-white whitespace-nowrap">{supplier.name}</td>
                  <td className="px-6 py-2 text-sm text-gray-300 font-mono">{supplier.telegramGroupId || 'Not set'}</td>
                  <td className="pl-2 pr-4 py-2">
                    <div className="flex items-center justify-end space-x-4">
                      <button onClick={() => handleEditSupplier(supplier)} className="text-indigo-400 hover:text-indigo-300" aria-label="Edit supplier">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                          <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSupplier && isSupplierModalOpen && (
        <EditSupplierModal supplier={selectedSupplier} isOpen={isSupplierModalOpen} onClose={() => setSupplierModalOpen(false)} onSave={handleSaveSupplier} />
      )}
    </div>
  );
};

export default SuppliersSettings;