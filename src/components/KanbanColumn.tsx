import { useState, useEffect, useRef } from 'react';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task, ColumnDef, ColumnSize } from '../types';
import { KanbanCard } from './KanbanCard';
import { useStore } from '../store';
import { Maximize2, Minimize2, List, AlignLeft, Settings2, Check, Trash2, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  column: ColumnDef;
  tasks: Task[];
  isEditing: boolean;
  onEdit: () => void;
  onCloseEdit: () => void;
}

export function KanbanColumn({ column, tasks, isEditing, onEdit, onCloseEdit }: Props) {
  const { updateColumn, deleteColumn, isInitialized, createTask } = useStore();
  const [editedTitle, setEditedTitle] = useState(column.title);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const editContainerRef = useRef<HTMLDivElement>(null);

  const handleSave = () => {
    if (editedTitle.trim() && editedTitle !== column.title) {
      updateColumn(column.id, { title: editedTitle.trim() });
    }
    setIsConfirmingDelete(false);
    onCloseEdit();
  };

  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (editContainerRef.current && !editContainerRef.current.contains(event.target as Node)) {
        handleSave();
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, editedTitle, column.id, column.title]);

  useEffect(() => {
    if (isEditing) {
      setEditedTitle(column.title);
    }
  }, [isEditing, column.title]);

  const [width, setWidth] = useState(column.width || 340);
  const startXRef = useRef<number | null>(null);
  const startWidthRef = useRef<number | null>(null);

  useEffect(() => {
    if (column.width && column.width !== width) {
      setWidth(column.width);
    }
  }, [column.width]);

  const onPointerDown = (e: React.PointerEvent) => {
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (startXRef.current !== null && startWidthRef.current !== null) {
      const newWidth = Math.max(260, Math.min(800, startWidthRef.current + (e.clientX - startXRef.current)));
      setWidth(newWidth);
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    document.body.style.cursor = '';
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    
    if (startXRef.current !== null && startWidthRef.current !== null) {
      const newWidth = Math.max(260, Math.min(800, startWidthRef.current + (e.clientX - startXRef.current)));
      updateColumn(column.id, { width: newWidth });
    }
    startXRef.current = null;
    startWidthRef.current = null;
  };

  const { setNodeRef, isOver: isOverDroppable } = useDroppable({
    id: column.id,
    data: {
      type: 'Column',
      status: column.id
    }
  });
  
  const { over } = useDndContext();
  const isOver = isOverDroppable || (over ? tasks.some(t => t.id === over.id) : false) || over?.id === column.id;

  const SIZES: { id: ColumnSize; icon: React.ReactNode; tooltip: string }[] = [
    { id: 'short', icon: <Minimize2 className="w-3 h-3" />, tooltip: 'Short' },
    { id: 'medium', icon: <List className="w-3 h-3" />, tooltip: 'Medium' },
    { id: 'large', icon: <AlignLeft className="w-3 h-3" />, tooltip: 'Large' },
    { id: 'full', icon: <Maximize2 className="w-3 h-3" />, tooltip: 'Full' }
  ];

  const LEGACY_COLOR_MAP: Record<string, string> = {
    'blue': '0', 'indigo': '1', 'purple': '2', 'rose': '3', 
    'emerald': '4', 'cyan': '5', 'amber': '6', 'slate': '7'
  };

  const getColIndex = (c: string) => {
    return LEGACY_COLOR_MAP[c] || c || '0';
  };

  const colIndex = getColIndex(column.color);

  // Background and ring styles using the CSS variables
  const containerStyle = {
    width: `${width}px`,
    backgroundColor: `rgba(var(--col-${colIndex}-rgb-bg), 0.65)`,
    color: `var(--col-${colIndex}-text)`,
    borderColor: `var(--col-${colIndex}-ring, rgba(255,255,255,0.1))`
  };

  return (
    <div 
      ref={setNodeRef}
      className={`group flex flex-col flex-shrink-0 backdrop-blur-xl rounded-3xl p-4 h-full relative transition-all shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.15)] ring-1 ring-inset ${isOver ? 'ring-2 ring-slate-800 dark:ring-white bg-black/5 dark:bg-white/5 scale-[1.02] z-50' : 'ring-white/20 dark:ring-white/10'}`}
      style={containerStyle}
    >
      <div 
        className="absolute top-0 right-0 w-2 h-full cursor-col-resize z-50 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        onPointerDown={onPointerDown}
      />
      {/* Refractive Inner Glass Border Effect */}
      <div className={`absolute inset-0 rounded-3xl pointer-events-none mix-blend-overlay shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),inset_0_-1px_1px_rgba(255,255,255,0.1),inset_0_0_10px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_0_10px_rgba(255,255,255,0.05)] border border-white/40 dark:border-white/10 z-0 transition-opacity ${isOver ? 'opacity-100' : 'opacity-0'} sm:opacity-100`}></div>
      
      {/* Mesh Gradient Backgrounds */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-3xl -z-10">
        <AnimatePresence>
          {tasks.slice(0, 12).map((task, i) => {
            // Distribute shapes organically across the column
            const topPos = 15 + ((i * 17) % 70); 
            const leftPos = 10 + ((i * 23) % 60);

            return (
              <motion.div
                key={`bg-shape-${task.id}`}
                layoutId={`bg-shape-${task.id}`}
                initial={isInitialized ? { opacity: 0, scale: 0.5 } : false}
                animate={{ 
                  opacity: isOver ? 0.8 : 0.5, 
                  scale: isOver ? 1.3 : 1,
                  // Couple them tightly when a card is dragged over
                  top: isOver ? '40%' : `${topPos}%`,
                  left: isOver ? '30%' : `${leftPos}%`
                }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ 
                  layout: { type: "spring", bounce: 0.2, duration: 0.8 },
                  opacity: { duration: 0.3 },
                  scale: { duration: 0.3 }
                }}
                className={`absolute w-32 h-32 rounded-full blur-[35px] mix-blend-overlay mix-blend-multiply dark:mix-blend-screen scale-150`}
                style={{ backgroundColor: `var(--col-${colIndex}-bg-mesh)` }}
              />
            );
          })}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between mb-4 px-2 tracking-tight group">
        {isEditing ? (
          <div ref={editContainerRef} className="flex flex-col gap-4 w-full bg-white/60 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl p-3 border border-white/60 dark:border-slate-700 shadow-sm relative z-10 mr-[-8px] ml-[-8px] mt-[-8px] transition-colors">
            <div className="flex items-center gap-2">
              <Input
                value={editedTitle}
                onChange={e => setEditedTitle(e.target.value)}
                className="flex-1 bg-white/50 dark:bg-slate-900/50 dark:text-slate-100 dark:border-slate-600 h-8 text-sm font-semibold transition-colors"
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                autoFocus
              />
              <Button size="sm" variant="ghost" onClick={handleSave} className="h-8 w-8 p-0 shrink-0 bg-white/50 dark:bg-slate-700/50 border border-white/60 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors">
                <Check className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex flex-col gap-2 overflow-hidden my-4">
               <div className="flex gap-1.5 flex-wrap justify-center py-1">
                 {Array.from({length: 12}).map((_, idx) => idx.toString()).filter(c => c !== '3' && c !== '5').map((c) => {
                   return (
                     <button
                       key={c}
                       onClick={() => updateColumn(column.id, { color: c })}
                       style={{ backgroundColor: `var(--col-${c}-bg-mesh)` }}
                       className={`w-4 h-4 rounded-full transition-transform hover:scale-110 ${colIndex === c ? 'ring-2 ring-slate-800 dark:ring-white ring-offset-1 ring-offset-slate-100 dark:ring-offset-slate-800 scale-110' : 'opacity-60'}`}
                     />
                   )
                 })}
               </div>
            </div>

            <div className="flex items-center justify-between gap-2">
               <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0 transition-colors">Size</span>
               <div className="flex gap-1 bg-white/50 dark:bg-slate-900/50 p-1 rounded-full border border-white/60 dark:border-slate-600 shrink-0 transition-colors">
                 {SIZES.map(s => (
                    <button
                      key={s.id}
                      onClick={() => updateColumn(column.id, { size: s.id })}
                      className={`p-1.5 rounded-full transition-colors flex items-center justify-center ${column.size === s.id ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white border border-white/60 dark:border-slate-500' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/40 dark:hover:bg-slate-800/40'}`}
                      title={s.tooltip}
                    >
                      {s.icon}
                    </button>
                 ))}
               </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-200/50 dark:border-slate-700/50 pt-3 mt-1">
               {isConfirmingDelete ? (
                 <div className="flex flex-col gap-2 w-full">
                   <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Are you sure?</span>
                   <div className="flex gap-2">
                     <Button size="sm" variant="destructive" className="h-6 text-[10px]" onClick={() => deleteColumn(column.id)}>Yes, Delete</Button>
                     <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setIsConfirmingDelete(false)}>Cancel</Button>
                   </div>
                 </div>
               ) : (
                 <button
                   className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                   onClick={(e) => {
                     e.preventDefault();
                     setIsConfirmingDelete(true);
                   }}
                 >
                   <Trash2 className="w-3 h-3" />
                   Delete Column
                 </button>
               )}
            </div>
          </div>
        ) : (
          <>
            <h3
              onClick={onEdit}
              className="font-semibold text-xl cursor-pointer hover:opacity-75 transition-opacity flex items-center gap-2 text-slate-800 dark:text-slate-100"
            >
              {column.title}
              <Settings2 className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 dark:text-slate-500" />
            </h3>
            <span className="text-xs font-semibold bg-white/70 dark:bg-slate-800/70 backdrop-blur-md shadow-sm border border-white/60 dark:border-white/10 px-2.5 py-1 rounded-full text-slate-700 dark:text-slate-300 transition-colors">
              {tasks.length}
            </span>
          </>
        )}
      </div>
      <div 
        className={`flex-1 min-h-[200px] transition-colors rounded-2xl auto-rows-max overflow-y-auto no-scrollbar pb-12 relative z-10 flex flex-col`}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence>
            {tasks.map(task => (
              <KanbanCard key={task.id} task={task} size={column.size} />
            ))}
          </AnimatePresence>
        </SortableContext>
      </div>
    </div>
  );
}
