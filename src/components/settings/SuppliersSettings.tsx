import React, { useContext, useState, useMemo, useEffect } from 'react';
import { AppContext } from '../../context/AppContext';
import { Supplier, SupplierName, PaymentMethod } from '../../types';
import EditTemplateModal from '../modals/EditTemplateModal';
import { useNotifier } from '../../context/NotificationContext';

const PaymentMethodBadge: React.FC<{ method?: PaymentMethod }> = ({ method }) => {
    if (!method) return <span className="text-gray-500">-</span>;
    const colors: Record<string, string> = {
        [PaymentMethod.ABA]: 'bg-blue-500/50 text-blue-300',
        [PaymentMethod.CASH]: 'bg-green-500/50 text-green-300',
        [PaymentMethod.KALI]: 'bg-purple-500/50 text-purple-300',
        [PaymentMethod.STOCK]: 'bg-gray-500/50 text-gray-300',
        [PaymentMethod.MISHA]: 'bg-orange-500/50 text-orange-300',
    };
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors[method]}`}>
            {method.toUpperCase()}
        </span>
    );
};

interface SuppliersSettingsProps {
    setMenuOptions: (options: any[]) => void;
}


const SuppliersSettings: React.FC<SuppliersSettingsProps> = ({ setMenuOptions }) => {
  const { state, actions } = useContext(AppContext);
  const { notify } = useNotifier();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedSupplierForTemplate, setSelectedSupplierForTemplate] = useState<Supplier | null>(null);

  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Supplier>>({});
  
  // FIX: Moved `filteredSuppliers` declaration before its usage.
  const filteredSuppliers = useMemo(() => {
    const sortedSuppliers = [...state.suppliers].sort((a, b) => a.name.localeCompare(b.name));
    if (!searchTerm.trim()) {
        return sortedSuppliers;
    }
    return sortedSuppliers.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [state.suppliers, searchTerm]);

  const handleAddNew = async () => {
    const newSupplier = await actions.addSupplier({ name: 'New Supplier' as SupplierName });
    setEditingSupplierId(newSupplier.id);
    setEditFormData(newSupplier);
  };
  
  const handleExportSuppliersCsv = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = ["Name", "Payment Method", "Chat ID", "Contact"];
    csvContent += headers.join(",") + "\r\n";

    filteredSuppliers.forEach(supplier => {
        const row = [
            `"${supplier.name.replace(/"/g, '""')}"`,
            supplier.paymentMethod ?? '',
            supplier.chatId ?? '',
            supplier.contact ?? ''
        ];
        csvContent += row.join(",") + "\r\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "suppliers_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify('Suppliers exported to CSV.', 'success');
  };

  useEffect(() => {
    const options = [
        { label: 'Search', action: () => setIsSearchVisible(prev => !prev) },
        { label: 'Add New', action: handleAddNew },
        { label: 'Export to CSV', action: handleExportSuppliersCsv },
    ];
    setMenuOptions(options);

    return () => setMenuOptions([]);
  }, [setMenuOptions, handleAddNew, filteredSuppliers]); // Add filteredSuppliers to deps

  const handleEditClick = (supplier: Supplier) => {
    setEditingSupplierId(supplier.id);
    setEditFormData(supplier);
  };
  
  const handleCancelEdit = () => {
    if (String(editFormData?.name) === 'New Supplier') {
        actions.deleteSupplier(editingSupplierId!); 
    }
    setEditingSupplierId(null);
    setEditFormData({});
  };

  const handleSaveEdit = async () => {
    if (!editingSupplierId) return;
    await actions.updateSupplier(editFormData as Supplier);
    setEditingSupplierId(null);
    setEditFormData({});
  };

  const handleInputChange = (field: keyof Supplier, value: any) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleOpenTemplateEditor = (supplier: Supplier) => {
    setSelectedSupplierForTemplate(supplier);
    setIsTemplateModalOpen(true);
  };

  const columns = useMemo(() => [
    { 
      id: 'name', header: 'Name',
      cell: (supplier: Supplier) => (
        <div className="truncate max-w-xs">
          {editingSupplierId === supplier.id ? (
            <input
                type="text"
                value={editFormData.name || ''}
                autoFocus
                onChange={(e) => handleInputChange('name', e.target.value.toUpperCase() as SupplierName)}
                className="bg-gray-900 p-1 w-full rounded ring-1 ring-indigo-500 text-white whitespace-nowrap"
            />
          ) : supplier.name}
        </div>
      )
    },
    { 
      id: 'paymentMethod', header: 'Payment Method',
      cell: (supplier: Supplier) => editingSupplierId === supplier.id ? (
        <select
            value={editFormData.paymentMethod || ''}
            onChange={(e) => handleInputChange('paymentMethod', e.target.value as PaymentMethod)}
            className="bg-gray-900 p-1 w-full rounded ring-1 ring-indigo-500"
        >
            <option value="">-</option>
            {Object.values(PaymentMethod).map(method => (
                <option key={method} value={method}>{method.toUpperCase()}</option>
            ))}
        </select>
      ) : <PaymentMethodBadge method={supplier.paymentMethod} />
    },
    {
      id: 'chatId', header: 'Chat ID',
      cell: (supplier: Supplier) => editingSupplierId === supplier.id ? (
        <input
            type="text"
            value={editFormData.chatId || ''}
            onChange={(e) => handleInputChange('chatId', e.target.value)}
            className="bg-gray-900 p-1 w-full rounded ring-1 ring-indigo-500 font-mono"
        />
      ) : supplier.chatId || '-'
    },
    {
      id: 'contact', header: 'Contact',
      cell: (supplier: Supplier) => editingSupplierId === supplier.id ? (
        <input
            type="text"
            value={editFormData.contact || ''}
            onChange={(e) => handleInputChange('contact', e.target.value)}
            className="bg-gray-900 p-1 w-full rounded ring-1 ring-indigo-500 font-mono"
        />
      ) : supplier.contact || '-'
    },
    {
      id: 'actions', header: 'Actions',
      cell: (supplier: Supplier) => editingSupplierId === supplier.id ? (
        <div className="flex items-center justify-end space-x-2">
            <button onClick={handleSaveEdit} className="p-1 rounded-full text-green-400 hover:bg-green-600 hover:text-white" title="Save"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></button>
            <button onClick={handleCancelEdit} className="p-1 rounded-full text-red-500 hover:bg-red-600 hover:text-white" title="Cancel"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
        </div>
      ) : (
        <div className="flex items-center justify-end space-x-2">
            <button
              onClick={() => handleOpenTemplateEditor(supplier)}
              className="p-1 rounded-full text-gray-400 hover:bg-gray-600 hover:text-white"
              aria-label="Edit bot options"
              title="Edit bot options"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h1a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
              </svg>
            </button>
            <button
              onClick={() => handleEditClick(supplier)}
              className="p-1 rounded-full text-indigo-400 hover:bg-indigo-600 hover:text-white"
              aria-label="Edit supplier details"
              title="Edit supplier details"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
              </svg>
            </button>
        </div>
      )
    }
  ], [editingSupplierId, editFormData]);

  return (
    <div className="flex flex-col flex-grow w-full lg:w-3/4">
        {isSearchVisible && (
            <div className="mb-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                onBlur={() => { if(!searchTerm) setIsSearchVisible(false)} }
                className="w-64 bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Search suppliers..."
              />
            </div>
        )}
      <div className="overflow-x-auto hide-scrollbar">
          <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800">
                  <tr>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[150px]">Name</th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[120px]">Payment Method</th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[120px]">Chat ID</th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[120px]">Contact</th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[80px]">Actions</th>
                  </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {filteredSuppliers.map(supplier => (
                      <tr key={supplier.id} className="hover:bg-gray-700/50">
                          {columns.map(col => (
                              <td key={col.id} className="px-3 py-2 whitespace-nowrap text-sm text-gray-300">
                                  {col.cell(supplier)}
                              </td>
                          ))}
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>
      
      {selectedSupplierForTemplate && isTemplateModalOpen && (
        <EditTemplateModal
            supplier={selectedSupplierForTemplate}
            isOpen={isTemplateModalOpen}
            onClose={() => {
                setIsTemplateModalOpen(false);
                setSelectedSupplierForTemplate(null);
            }}
            onSave={actions.updateSupplier}
        />
      )}
    </div>
  );
};

export default SuppliersSettings;
