import React, { useState, useContext, useEffect, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import { OrderStatus, PaymentMethod, SupplierName, OrderItem, KaliTodoItem } from '../../types';

interface Section {
  id: string;
  title: string;
  items: KaliTodoItem[];
}

const KaliTodoView: React.FC = () => {
  const { state, actions } = useContext(AppContext);
  const { orders, suppliers } = state;

  const [sections, setSections] = useState<Section[]>([]);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  
  const [draggedItem, setDraggedItem] = useState<{ item: KaliTodoItem; sourceSectionId: string } | null>(null);

  const initialKaliItems = useMemo((): KaliTodoItem[] => {
    const kaliOrders = orders.filter(order => {
      if (order.status !== OrderStatus.ON_THE_WAY) return false;
      const supplier = suppliers.find(s => s.id === order.supplierId);
      const paymentMethod = order.paymentMethod || supplier?.paymentMethod;
      return paymentMethod === PaymentMethod.KALI;
    });

    const items: KaliTodoItem[] = [];
    kaliOrders.forEach(order => {
      order.items.forEach(item => {
        items.push({
          ...item,
          uniqueId: `${order.id}-${item.itemId}-${item.isSpoiled ? 's' : 'c'}`,
          originalOrderId: order.id,
          ticked: false,
        });
      });
    });
    return items;
  }, [orders, suppliers]);

  useEffect(() => {
    setSections([{ id: 'uncategorized', title: 'Uncategorized', items: initialKaliItems }]);
  }, [initialKaliItems]);

  const handleToggleTick = (itemId: string) => {
    let originalOrderId = '';
    const newSections = sections.map(section => ({
      ...section,
      items: section.items.map(item => {
        if (item.uniqueId === itemId) {
          if (!item.ticked) { // Only store orderId when ticking
            originalOrderId = item.originalOrderId;
          }
          return { ...item, ticked: !item.ticked };
        }
        return item;
      }),
    }));
    setSections(newSections);
    
    // Check for order completion
    if (originalOrderId) {
      const allItemsForOrder = newSections.flatMap(s => s.items).filter(i => i.originalOrderId === originalOrderId);
      const allTicked = allItemsForOrder.every(i => i.ticked);
      
      if (allTicked) {
        const orderToComplete = orders.find(o => o.id === originalOrderId);
        if (orderToComplete) {
          actions.updateOrder({ ...orderToComplete, status: OrderStatus.COMPLETED, completedAt: new Date().toISOString() });
        }
      }
    }
  };

  const handleAddSection = () => {
    if (newSectionTitle.trim()) {
      setSections([...sections, { id: Date.now().toString(), title: newSectionTitle.trim(), items: [] }]);
      setNewSectionTitle('');
      setIsAddingSection(false);
    }
  };

  const handleDragStart = (item: KaliTodoItem, sourceSectionId: string) => {
    setDraggedItem({ item, sourceSectionId });
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (destinationSectionId: string) => {
    if (!draggedItem) return;
    
    const { item, sourceSectionId } = draggedItem;
    
    if (sourceSectionId === destinationSectionId) {
      setDraggedItem(null);
      return;
    }

    const newSections = sections.map(section => {
      // Remove from source
      if (section.id === sourceSectionId) {
        return { ...section, items: section.items.filter(i => i.uniqueId !== item.uniqueId) };
      }
      // Add to destination
      if (section.id === destinationSectionId) {
        return { ...section, items: [...section.items, item] };
      }
      return section;
    });

    setSections(newSections);
    setDraggedItem(null);
  };


  return (
    <div className="space-y-4">
      {sections.map(section => (
        <div key={section.id} 
             className="bg-gray-900/50 rounded-lg p-3"
             onDragOver={handleDragOver}
             onDrop={() => handleDrop(section.id)}
        >
          <h4 className="font-semibold text-gray-300 mb-2">{section.title}</h4>
          <ul className="space-y-1">
            {section.items.map(item => (
              <li
                key={item.uniqueId}
                draggable
                onDragStart={() => handleDragStart(item, section.id)}
                onClick={() => handleToggleTick(item.uniqueId)}
                className={`flex justify-between items-center p-2 rounded-md cursor-pointer hover:bg-gray-700 ${item.ticked ? 'line-through text-gray-500' : 'text-gray-200'}`}
              >
                <span>{item.name}</span>
                <span className="text-sm font-mono">{item.quantity}{item.unit}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      
      {isAddingSection ? (
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={newSectionTitle}
            onChange={e => setNewSectionTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddSection(); }}
            onBlur={() => { setIsAddingSection(false); setNewSectionTitle(''); }}
            autoFocus
            className="flex-grow bg-gray-700 text-gray-200 rounded-md p-2 outline-none text-sm"
            placeholder="New section title..."
          />
          <button onClick={handleAddSection} className="px-3 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white">Add</button>
        </div>
      ) : (
        <button onClick={() => setIsAddingSection(true)} className="w-full text-left p-2 text-sm text-gray-400 hover:text-white rounded-md hover:bg-gray-700/50">
          + Add Section
        </button>
      )}
    </div>
  );
};

export default KaliTodoView;
