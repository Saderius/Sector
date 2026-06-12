import { useState, useRef, useEffect, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  CollisionDetection,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Task, TaskStatus } from '../types';
import { useStore } from '../store';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';

const customCollisionDetection: CollisionDetection = (args) => {
  // Try pointer based collision detection first (extremely accurate for mouse drops)
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  // Fallback to geometric intersections if pointer completely misses (edge cases)
  const rectCollisions = rectIntersection(args);
  if (rectCollisions.length > 0) {
    return rectCollisions;
  }
  return closestCorners(args);
};

export function KanbanBoard() {
  const allTasks = useStore(state => state.tasks);
  const activeBoardId = useStore(state => state.activeBoardId);
  const boards = useStore(state => state.boards);
  
  const storeTasks = useMemo(() => {
    const board = boards.find(b => b.id === activeBoardId) || boards[0];
    if (!board) return allTasks;
    return allTasks.filter(task => {
        if (board.includeTags && board.includeTags.length > 0) {
            const hasInclude = task.tags?.some(tag => board.includeTags.includes(tag));
            if (!hasInclude) return false;
        }
        if (board.excludeTags && board.excludeTags.length > 0) {
            const hasExclude = task.tags?.some(tag => board.excludeTags.includes(tag));
            if (hasExclude) return false;
        }
        return true;
    });
  }, [allTasks, activeBoardId, boards]);
  const { columns, moveTask, updateTask, reorderTask, addColumn } = useStore();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);

  const [uiTasks, setUiTasks] = useState(storeTasks);

  useEffect(() => {
    if (!activeTask) {
      setUiTasks(storeTasks);
    }
  }, [storeTasks, activeTask]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = uiTasks.find((t) => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    if (activeId === overId) return;
    
    let overColumn: TaskStatus | undefined;
    if (columns.some(c => c.id === overId)) {
      overColumn = overId as TaskStatus;
    } else {
      const overTask = uiTasks.find(t => t.id === overId);
      if (overTask) overColumn = overTask.status;
    }
    
    if (overColumn) {
      const activeTask = uiTasks.find(t => t.id === activeId);
      if (activeTask && activeTask.status !== overColumn) {
        setUiTasks(prev => prev.map(t => t.id === activeId ? { ...t, status: overColumn as TaskStatus } : t));
        useStore.setState(s => ({
          tasks: s.tasks.map(t => t.id === activeId ? { ...t, status: overColumn as TaskStatus } : t)
        }));
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    
    if (!over) {
      // If we dropped completely out of bounds (which is rare with correct pointer logic),
      // we need to revert the optimistic UI update to match the real store file state.
      setUiTasks(storeTasks);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;
    
    if (activeId === overId) return;

    const activeTask = uiTasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    if (columns.some(c => c.id === overId)) {
        await reorderTask(activeId, null, overId as TaskStatus);
        return;
    }

    const overTask = uiTasks.find((t) => t.id === overId);
    if (overTask) {
      await reorderTask(activeId, overId, overTask.status);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6 h-full overflow-x-auto pb-4 pt-10 pl-2 items-start">
        {(() => {
          const unsortedTasks = uiTasks.filter((t) => !t.status || !columns.some(c => c.id === t.status) || t.tags?.includes('unsorted'));
          return unsortedTasks.length > 0 ? (
            <KanbanColumn
              key="unsorted"
              column={{ id: "Unsorted", title: "Unsorted", color: "slate", size: "medium", order: -1 }}
              tasks={unsortedTasks}
              isEditing={false}
              onEdit={() => {}}
              onCloseEdit={() => {}}
            />
          ) : null;
        })()}
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={uiTasks.filter((t) => t.status === col.id)}
            isEditing={editingColumnId === col.id}
            onEdit={() => setEditingColumnId(col.id)}
            onCloseEdit={() => setEditingColumnId(null)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div style={{ width: (columns.find(c => c.id === activeTask.status)?.width || 340) - 32 }}>
            <KanbanCard task={activeTask} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
