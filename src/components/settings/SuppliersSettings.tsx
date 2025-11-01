import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import EditSupplierModal from '../modals/EditSupplierModal';
import { Supplier, SupplierName } from '../../types';

const SuppliersSettings: React.FC = () => {
  const { state, actions } = useContext(AppContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setSelectedSupplier({
      id: `new_${Date.now()}`,
      name: '' as SupplierName,
      chatId: '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (supplierToSave: Supplier) => {
    if (supplierToSave.id.startsWith('new_')) {
      const { id, modifiedAt, ...newSupplierData } = supplierToSave;
      if (!newSupplierData.name) {
        alert("Supplier name cannot be empty.");
        return;
      }
      await actions.addSupplier(newSupplierData);
    } else {
      await actions.updateSupplier(supplierToSave);
    }
  };

  const filteredSuppliers = useMemo(() => {
    return state.suppliers
      .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.suppliers, searchTerm]);

  return (
    <div className="flex flex-col flex-grow">
      <div className="flex justify-between items-center mb-4 w-full">
        <input
          type="text"
          placeholder="Search suppliers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-64 bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <button
          onClick={handleAddNew}
          className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white flex items-center space-x-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Add Supplier</span>
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden flex-grow flex flex-col w-full">
        <div className="flex-grow overflow-y-auto hide-scrollbar">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800 sticky top-0 z-10">
              <tr>
                <th className="pl-4 pr-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Payment Method</th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Chat ID</th>
                <th className="pl-2 pr-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {filteredSuppliers.map(supplier => (
                <tr key={supplier.id} className="hover:bg-gray-700/50">
                  <td className="pl-4 pr-2 py-2 text-sm text-white whitespace-nowrap">{supplier.name}</td>
                  <td className="px-2 py-2 text-sm text-gray-300 whitespace-nowrap">{supplier.paymentMethod?.toUpperCase() || '-'}</td>
                  <td className="px-2 py-2 text-sm text-gray-300 whitespace-nowrap font-mono">{supplier.chatId || '-'}</td>
                  <td className="pl-2 pr-4 py-2 text-right">
                    <button
                      onClick={() => handleEdit(supplier)}
                      className="p-1 rounded-full text-indigo-400 hover:bg-indigo-600 hover:text-white"
                      aria-label="Edit supplier"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selectedSupplier && isModalOpen && (
        <EditSupplierModal
          supplier={selectedSupplier}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedSupplier(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default SuppliersSettings;