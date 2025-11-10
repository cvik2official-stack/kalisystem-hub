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
import { Supplier, SupplierName, PaymentMethod, SupplierBotSettings } from '../../types';
import EditTemplateModal from '../modals/EditTemplateModal';
import ResizableTable from '../common/ResizableTable';

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


const SuppliersSettings: React.FC = () => {
  const { state, actions } = useContext(AppContext);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedSupplierForTemplate, setSelectedSupplierForTemplate] = useState<Supplier | null>(null);

  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Supplier>>({});


  const handleAddNew = async () => {
    const newSupplier = await actions.addSupplier({ name: 'New Supplier' as SupplierName });
    setEditingSupplierId(newSupplier.id);
    setEditFormData(newSupplier);
  };

  const handleEditClick = (supplier: Supplier) => {
    setEditingSupplierId(supplier.id);
    setEditFormData(supplier);
  };
  
  const handleCancelEdit = () => {
    if (editFormData?.name === 'New Supplier') {
        // If it was a new supplier that wasn't properly named, delete it.
        actions.deleteOrder(editingSupplierId!); // This should be deleteSupplier
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

  const filteredSuppliers = useMemo(() => {
    return state.suppliers
      .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.suppliers, searchTerm]);

  const columns = useMemo(() => [
    { 
      id: 'name', header: 'Name', initialWidth: 150,
      cell: (supplier: Supplier) => editingSupplierId === supplier.id ? (
        <input
            type="text"
            value={editFormData.name || ''}
            autoFocus
            onChange={(e) => handleInputChange('name', e.target.value.toUpperCase() as SupplierName)}
            className="bg-gray-900 p-1 w-full rounded ring-1 ring-indigo-500 text-white whitespace-nowrap"
        />
      ) : supplier.name
    },
    { 
      id: 'paymentMethod', header: 'Payment Method', initialWidth: 120,
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
      id: 'chatId', header: 'Chat ID', initialWidth: 120,
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
      id: 'inv', header: 'Inv', title: 'Attach Invoice', initialWidth: 40,
      cell: (supplier: Supplier) => <CheckboxDisplay checked={supplier.botSettings?.showAttachInvoice} />
    },
    {
      id: 'mis', header: 'Mis', title: 'Missing Items', initialWidth: 40,
      cell: (supplier: Supplier) => <CheckboxDisplay checked={supplier.botSettings?.showMissingItems} />
    },
    {
      id: 'ok', header: 'OK', title: 'OK Button', initialWidth: 40,
      cell: (supplier: Supplier) => <CheckboxDisplay checked={supplier.botSettings?.showOkButton} />
    },
    {
      id: 'drv', header: 'Drv', title: 'Driver on the Way', initialWidth: 40,
      cell: (supplier: Supplier) => <CheckboxDisplay checked={supplier.botSettings?.showDriverOnWayButton} />
    },
    {
      id: 'loc', header: 'Loc', title: 'Include Location Link', initialWidth: 40,
      cell: (supplier: Supplier) => <CheckboxDisplay checked={supplier.botSettings?.includeLocation} />
    },
    {
      id: 'actions', header: 'Actions', initialWidth: 80,
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

  const CheckboxDisplay: React.FC<{checked?: boolean}> = ({ checked }) => (
    <div className="flex justify-center items-center h-full">
      <div className={`h-4 w-4 rounded border flex items-center justify-center ${checked ? 'bg-indigo-500 border-indigo-500' : 'border-gray-600'}`}>
        {checked && <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
      </div>
    </div>
  );
  
  return (
    <div className="flex flex-col flex-grow">
      <ResizableTable
        columns={columns}
        data={filteredSuppliers}
        tableKey="suppliers-settings"
        toolbar={
          <div className="flex justify-between items-center mb-4 w-full">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Search suppliers..."
            />
          </div>
        }
        rightAlignedActions={
          <button
            onClick={handleAddNew}
            className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700"
            aria-label="Add New Supplier"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        }
      />
      
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