
import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { OrderStatus, KaliTodoItem } from '../types';
import { useNotifier } from '../context/NotificationContext';

const KaliTodoPage: React.FC = () => {
  const { state, dispatch, actions } = useContext(AppContext);
  const { kaliTodoState } = state;
  const { sections } = kaliTodoState;
  const { notify } = useNotifier();

  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  
  const [draggedItem, setDraggedItem] = useState<{ item: KaliTodoItem; sourceSectionId: string } | null>(null);

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

  const isDragging = !!draggedItem;

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4 px-2">
         <h2 className="text-2xl font-bold text-white">KALI To-Do List</h2>
         <button 
            onClick={handleShare} 
            className="flex items-center space-x-2 text-indigo-400 hover:text-white px-3 py-1 rounded hover:bg-indigo-900/30 transition-colors"
         >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
            <span>Share List</span>
         </button>
      </div>

      <div className="flex-grow overflow-y-auto hide-scrollbar px-2 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          {sections.map(section => (
            <div key={section.id} 
                 className={`bg-gray-800 rounded-lg p-4 transition-colors duration-200 ${isDragging ? 'border-2 border-dashed border-indigo-500/50 bg-gray-800/80' : ''}`}
                 onDragOver={handleDragOver}
                 onDrop={() => handleDrop(section.id)}
            >
              <h4 className={`font-bold text-lg text-gray-300 mb-3 uppercase tracking-wide border-b border-gray-700 pb-2 ${isDragging ? 'pointer-events-none' : ''}`}>{section.title}</h4>
              
              {!isDragging ? (
                  <ul className="space-y-2">
                    {section.items.map(item => (
                      <li
                        key={item.uniqueId}
                        draggable
                        onDragStart={() => handleDragStart(item, section.id)}
                        onClick={() => handleToggleTick(item.uniqueId)}
                        className={`flex justify-between items-center p-3 rounded-md cursor-pointer transition-colors ${item.ticked ? 'bg-gray-900/30 text-gray-500' : 'bg-gray-700/50 hover:bg-gray-700 text-gray-200'}`}
                      >
                        <div className="flex items-center space-x-3">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${item.ticked ? 'border-gray-600 bg-gray-800' : 'border-indigo-500'}`}>
                                {item.ticked && <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                            </div>
                            <span className={item.ticked ? 'line-through' : ''}>{item.name}</span>
                        </div>
                        <span className="text-sm font-mono bg-gray-900/50 px-2 py-1 rounded text-gray-400">{item.quantity}{item.unit}</span>
                      </li>
                    ))}
                     {section.items.length === 0 && <p className="text-sm text-gray-600 text-center py-4 italic">Drop items here</p>}
                  </ul>
              ) : (
                  <div className="h-16 flex items-center justify-center text-gray-500 font-medium border-2 border-transparent pointer-events-none">
                      Drop to move here
                  </div>
              )}
            </div>
          ))}
          
          {!isDragging && (isAddingSection ? (
            <div className="flex items-center space-x-2 bg-gray-800 p-4 rounded-lg">
              <input
                type="text"
                value={newSectionTitle}
                onChange={e => setNewSectionTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSection(); }}
                onBlur={() => { setIsAddingSection(false); setNewSectionTitle(''); }}
                autoFocus
                className="flex-grow bg-gray-900 text-gray-200 rounded-md p-3 outline-none text-base"
                placeholder="New section title..."
              />
              <button onClick={handleAddSection} className="px-4 py-3 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white">Add</button>
            </div>
          ) : (
            <button onClick={() => setIsAddingSection(true)} className="w-full text-center p-4 text-gray-400 hover:text-white rounded-lg border-2 border-dashed border-gray-700 hover:border-gray-500 hover:bg-gray-800 transition-all">
              + Add New Section
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KaliTodoPage;
