/*
  NOTE FOR DATABASE SETUP:
  This component manages supplier properties that require specific database columns.
  If you are encountering errors related to 'chat_id' or 'payment_method',
  please ensure your 'suppliers' table is up to date by running the following
  SQL commands in your Supabase SQL Editor:

  -- Add a nullable text column for Telegram Chat ID
  ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS chat_id TEXT;

  -- Add a nullable text column for the supplier's payment method
  ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS payment_method TEXT;

*/
import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import EditSupplierModal from '../modals/EditSupplierModal';
import { Supplier, SupplierName, PaymentMethod } from '../../types';

const SuppliersSettings: React.FC = () => {
  const { state, actions } = useContext(AppContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplierForModal, setSelectedSupplierForModal] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editedSupplierData, setEditedSupplierData] = useState<Partial<Supplier>>({});

  const handleEditClick = (supplier: Supplier) => {
    setEditingSupplierId(supplier.id);
    setEditedSupplierData(supplier);
  };
  
  const handleCancelEdit = () => {
    setEditingSupplierId(null);
    setEditedSupplierData({});
  };

  const handleInlineSave = async () => {
    if (editingSupplierId && editedSupplierData) {
      await actions.updateSupplier(editedSupplierData as Supplier);
      setEditingSupplierId(null);
      setEditedSupplierData({});
    }
  };
  
  const handleSupplierDataChange = (field: keyof Supplier, value: any) => {
    if (editedSupplierData) {
      const updatedValue = field === 'name' ? value.toUpperCase() : value;
      setEditedSupplierData({ ...editedSupplierData, [field]: updatedValue });
    }
  };

  const handleAddNew = () => {
    setSelectedSupplierForModal({
      id: `new_${Date.now()}`,
      name: '' as SupplierName,
      chatId: '',
    });
    setIsModalOpen(true);
  };

  const handleSaveFromModal = async (supplierToSave: Supplier) => {
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
          className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700"
          aria-label="Add New Supplier"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
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
              {filteredSuppliers.map(supplier => {
                const isEditing = editingSupplierId === supplier.id;
                return (
                  <tr key={supplier.id} className="hover:bg-gray-700/50">
                    <td className="pl-4 pr-2 py-1 text-sm text-white whitespace-nowrap">
                        {isEditing ? (
                            <input
                                type="text"
                                value={editedSupplierData.name || ''}
                                onChange={(e) => handleSupplierDataChange('name', e.target.value as SupplierName)}
                                className="bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-1 w-full"
                            />
                        ) : (
                            supplier.name
                        )}
                    </td>
                    <td className="px-2 py-1 text-sm text-gray-300 whitespace-nowrap">
                        {isEditing ? (
                            <select
                                value={editedSupplierData.paymentMethod || ''}
                                onChange={(e) => handleSupplierDataChange('paymentMethod', e.target.value as PaymentMethod)}
                                className="bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-1 w-full"
                            >
                                <option value="">-</option>
                                {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                            </select>
                        ) : (
                            supplier.paymentMethod?.toUpperCase() || '-'
                        )}
                    </td>
                    <td className="px-2 py-1 text-sm text-gray-300 whitespace-nowrap font-mono">
                        {isEditing ? (
                             <input
                                type="text"
                                value={editedSupplierData.chatId || ''}
                                onChange={(e) => handleSupplierDataChange('chatId', e.target.value)}
                                className="bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-1 w-full"
                            />
                        ) : (
                           supplier.chatId || '-'
                        )}
                    </td>
                    <td className="pl-2 pr-4 py-1 text-right">
                       <div className="flex items-center justify-end space-x-2">
                          {isEditing ? (
                            <>
                                <button onClick={handleInlineSave} className="p-1 rounded-full text-green-400 hover:bg-green-600 hover:text-white" aria-label="Save supplier">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                </button>
                                <button onClick={handleCancelEdit} className="p-1 rounded-full text-red-400 hover:bg-red-600 hover:text-white" aria-label="Cancel edit">
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleEditClick(supplier)}
                              className="p-1 rounded-full text-indigo-400 hover:bg-indigo-600 hover:text-white"
                              aria-label="Edit supplier"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}
                        </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {selectedSupplierForModal && isModalOpen && (
        <EditSupplierModal
          supplier={selectedSupplierForModal}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedSupplierForModal(null);
          }}
          onSave={handleSaveFromModal}
        />
      )}
    </div>
  );
};

export default SuppliersSettings;