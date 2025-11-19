import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../context/AppContext';
import { OrderStatus, KaliTodoItem, KaliTodoSection } from '../../types';
import { useNotifier } from '../../context/NotificationContext';

interface KaliTodoViewProps {
  shareTrigger: number;
}

const KaliTodoView: React.FC<KaliTodoViewProps> = ({ shareTrigger }) => {
  const { state, dispatch, actions } = useContext(AppContext);
  const { kaliTodoState } = state;
  const { sections } = kaliTodoState;
  const { notify } = useNotifier();

  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  
  const [draggedItem, setDraggedItem] = useState<{ item: KaliTodoItem; sourceSectionId: string } | null>(null);

  // Handle Share Trigger
  useEffect(() => {
    if (shareTrigger > 0) {
      handleShare();
    }
  }, [shareTrigger]);

  const handleShare = () => {
    let shareText = 'KALI TO-DO LIST:\n\n';
    sections.forEach(section => {
        shareText += `--- ${section.title.toUpperCase()} ---\n`;
        if (section.items.length === 0) {
            shareText += '(empty)\n';
        } else {
            section.items.forEach(item => {
                const status = item.ticked ? '[x]' : '[ ]';
                shareText += `${status} ${item.name} (${item.quantity}${item.unit})\n`;
            });
        }
        shareText += '\n';
    });
    navigator.clipboard.writeText(shareText).then(() => {
        notify('To-Do list copied to clipboard!', 'success');
    }).catch(err => {
        notify('Failed to copy list.', 'error');
    });
  };

  const handleToggleTick = (uniqueId: string) => {
    dispatch({ type: 'TICK_KALI_TODO_ITEM', payload: { uniqueId } });

    // Check for order completion after state updates
    setTimeout(() => {
      const allItems = state.kaliTodoState.sections.flatMap(s => s.items);
      const item = allItems.find(i => i.uniqueId === uniqueId);
      if (item) {
        const allItemsForOrder = allItems.filter(i => i.originalOrderId === item.originalOrderId);
        const allTicked = allItemsForOrder.every(i => i.ticked);
        
        if (allTicked) {
          const orderToComplete = state.orders.find(o => o.id === item.originalOrderId);
          if (orderToComplete && orderToComplete.status !== OrderStatus.COMPLETED) {
            actions.updateOrder({ ...orderToComplete, status: OrderStatus.COMPLETED, completedAt: new Date().toISOString() });
            notify(`Order ${orderToComplete.orderId} completed!`, 'success');
          }
        }
      }
    }, 100);
  };

  const handleAddSection = () => {
    if (newSectionTitle.trim()) {
      dispatch({ type: 'ADD_KALI_TODO_SECTION', payload: { title: newSectionTitle.trim() } });
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
    if (!draggedItem || draggedItem.sourceSectionId === destinationSectionId) {
      setDraggedItem(null);
      return;
    }
    dispatch({
      type: 'MOVE_KALI_TODO_ITEM',
      payload: { ...draggedItem, destinationSectionId },
    });
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
             {section.items.length === 0 && <p className="text-xs text-gray-600 text-center py-2">Drop items here</p>}
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