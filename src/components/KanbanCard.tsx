import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Task, ColumnSize } from '../types';
import { useStore } from '../store';
import { MouseEventHandler } from 'react';
import { motion } from 'motion/react';
import { Paperclip } from 'lucide-react';

export function KanbanCard({ task, size = 'medium', isOverlay = false }: { task: Task, size?: ColumnSize, isOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task
    }
  });

  const setSelectedTaskId = useStore(s => s.setSelectedTaskId);
  const isInitialized = useStore(s => s.isInitialized);

  const style = isOverlay ? undefined : {
    transition,
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 0 : undefined,
  };

  const handleCardClick = () => {
    if (!isOverlay) setSelectedTaskId(task.id);
  };

  const cardContent = (
    <Card 
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      className={`mb-3 relative transition-all rounded-2xl ${
        isOverlay
          ? 'scale-[1.02] shadow-[0_16px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.4)] cursor-grabbing bg-white/90 dark:bg-slate-800/90 border border-white dark:border-slate-600 backdrop-blur-xl z-50'
          : isDragging
            ? 'opacity-30 border-2 border-dashed border-slate-400 dark:border-slate-500 bg-slate-100/50 dark:bg-slate-800/50 shadow-none'
            : 'border border-white/60 dark:border-slate-700 shadow-[0_4px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] bg-white/60 dark:bg-slate-800/60 hover:bg-white/80 dark:hover:bg-slate-800/80 backdrop-blur-xl cursor-pointer'
      }`}
    >
      <div 
        {...(isOverlay ? {} : attributes)} 
        {...(isOverlay ? {} : listeners)} 
        onClick={handleCardClick}
        className={`p-4 ${isOverlay ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'} flex flex-col`}
      >
        <CardHeader className="p-0 mb-2 flex flex-row items-start justify-between">
          <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100 pr-2">{task.title}</CardTitle>
          {task.pendingExternalChanges && (
            <div className="flex items-center justify-center w-5 h-5 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-full animate-pulse flex-shrink-0 border border-amber-300 dark:border-amber-700" title="Updates pending! Click to view.">
              <span className="text-[10px] font-bold">!</span>
            </div>
          )}
        </CardHeader>
        
        {/* Render based on size */}
        {size !== 'short' && (
          <CardContent className="p-0 flex flex-col gap-2">
            
            {(size === 'large' || size === 'full') && task.content && task.content.trim() !== '' && (
               <div className={`text-xs text-slate-600 dark:text-slate-400 font-medium whitespace-pre-wrap ${size === 'large' ? 'line-clamp-2' : ''}`}>
                 {task.content}
               </div>
            )}

            {(task.tags?.length > 0 || (task.attachments && task.attachments.length > 0)) && (
              <div className="flex flex-wrap items-center gap-1 mt-1">
                {task.tags?.map(t => (
                  <Badge key={t} variant="secondary" className="text-xs px-1.5 py-0 font-normal bg-white/50 dark:bg-slate-700/50 backdrop-blur-md text-slate-700 dark:text-slate-300 border-white/40 dark:border-slate-600">
                    {t}
                  </Badge>
                ))}
                {task.attachments && task.attachments.length > 0 && (
                  <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 ml-1" title={`${task.attachments.length} attachment(s)`}>
                    <Paperclip className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium">{task.attachments.length}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        )}
      </div>
    </Card>
  );

  if (isOverlay) {
    return cardContent;
  }

  return (
    <motion.div
      layout={!isDragging} // don't clash with dnd-kit transform
      layoutId={`card-${task.id}`}
      initial={isInitialized ? { opacity: 0, scale: 0.9 } : false}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ layout: { type: "spring", bounce: 0.15, duration: 0.6 } }}
    >
      {cardContent}
    </motion.div>
  );
}
