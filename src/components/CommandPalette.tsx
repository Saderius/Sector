import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store';
import { Button } from './ui/button';
import { Search, Hash, FileText, Archive, CornerDownLeft, X, Columns, Plus, FolderOpen } from 'lucide-react';
import { Task } from '../types';

interface SearchResult {
  task: Task;
  isArchived: boolean;
  isTrashed: boolean;
  matchType: 'title' | 'content' | 'tag';
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <span className="text-slate-700 dark:text-slate-300">{text}</span>;
  const parts = text.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
  return (
    <span className="text-slate-750 dark:text-slate-250">
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-150 font-bold px-0.5 rounded-xs transition-colors">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
}

function getSnippet(content: string, query: string) {
  if (!content) return '';
  const idx = content.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) {
    return content.length > 80 ? content.slice(0, 80) + '...' : content;
  }
  const start = Math.max(0, idx - 30);
  const end = Math.min(content.length, idx + query.length + 50);
  let snippet = content.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';
  return snippet;
}

export function CommandPalette() {
  const { tasks, archivedTasks, trashedTasks, setSelectedTaskId, createTask } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'titles' | 'descriptions' | 'tags' | 'archived' | 'trashed'>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const AVAILABLE_ACTIONS = useMemo(() => [
    {
      id: 'create-note',
      title: 'Create Note...',
      description: 'Add a new blank note to your current view.',
      icon: <Plus className="w-4 h-4 text-emerald-500" />
    },
    {
      id: 'add-workspace',
      title: 'Add New Workspace...',
      description: 'Create or import an external Markdown workspace.',
      icon: <FolderOpen className="w-4 h-4 text-blue-500" />
    },
    {
      id: 'open-files',
      title: 'Open Project Files Folder',
      description: 'Locate the underlying Markdown storage directory.',
      icon: <Search className="w-4 h-4 text-violet-500" />
    }
  ], []);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastShiftTimeRef = useRef<number>(0);

  // Real-time filtering and highlighting logic
  const filteredResults = useMemo(() => {
    const results: any[] = [];
    const searchVal = query.trim().toLowerCase();

    // Include quick actions
    if (scope === 'all') {
      const actionMatches = AVAILABLE_ACTIONS.filter(action => 
        !searchVal || 
        action.title.toLowerCase().includes(searchVal) || 
        action.description.toLowerCase().includes(searchVal)
      );

      for (const action of actionMatches) {
        results.push({
          type: 'action',
          action,
          isArchived: false,
          isTrashed: false,
          matchType: 'action'
        });
      }
    }

    // Collect all tasks to evaluate
    const activeList = tasks.map(t => ({ task: t, isArchived: false, isTrashed: false }));
    const archivedList = archivedTasks.map(t => ({ task: t, isArchived: true, isTrashed: false }));
    const trashedList = trashedTasks.map(t => ({ task: t, isArchived: false, isTrashed: true }));
    const allItems = [...activeList, ...archivedList, ...trashedList];

    for (const item of allItems) {
      const { task, isArchived, isTrashed } = item;
      
      // If we are searching only archived, skip others
      if (scope === 'archived' && !isArchived) continue;
      // If we are searching only trashed, skip others
      if (scope === 'trashed' && !isTrashed) continue;
      // If we are searching other scopes, filter out archived/trashed unless in "all" or explicitly chosen scope
      if (scope !== 'all' && scope !== 'archived' && scope !== 'trashed' && (isArchived || isTrashed)) continue;

      const titleMatch = task.title?.toLowerCase().includes(searchVal);
      const contentMatch = task.content?.toLowerCase().includes(searchVal);
      const tagMatch = task.tags?.some(tag => tag?.toLowerCase().includes(searchVal));

      // No query? Return all sorted by order unless scoped
      if (!searchVal) {
        results.push({
          type: 'task',
          task,
          isArchived,
          isTrashed,
          matchType: 'title'
        });
        continue;
      }

      if (scope === 'all' || scope === 'archived' || scope === 'trashed') {
        if (titleMatch) {
          results.push({ type: 'task', task, isArchived, isTrashed, matchType: 'title' });
        } else if (tagMatch) {
          results.push({ type: 'task', task, isArchived, isTrashed, matchType: 'tag' });
        } else if (contentMatch) {
          results.push({ type: 'task', task, isArchived, isTrashed, matchType: 'content' });
        }
      } else if (scope === 'titles' && titleMatch) {
        results.push({ type: 'task', task, isArchived, isTrashed, matchType: 'title' });
      } else if (scope === 'descriptions' && contentMatch) {
        results.push({ type: 'task', task, isArchived, isTrashed, matchType: 'content' });
      } else if (scope === 'tags' && tagMatch) {
        results.push({ type: 'task', task, isArchived, isTrashed, matchType: 'tag' });
      }
    }

    // Sort results to prioritize exact titles, active tasks, then orders
    return results.sort((a, b) => {
      // Prioritize actions above all else when partially matching
      if (searchVal) {
        if (a.type === 'action' && b.type !== 'action') return -1;
        if (a.type !== 'action' && b.type === 'action') return 1;
      }
      
      // 1. Prioritize active tasks over archived/trashed
      const aIsInactive = a.isArchived || a.isTrashed;
      const bIsInactive = b.isArchived || b.isTrashed;
      if (aIsInactive !== bIsInactive) {
        return aIsInactive ? 1 : -1;
      }
      // 2. Prioritize matches in title
      if (a.matchType !== b.matchType) {
        if (a.matchType === 'title' || a.matchType === 'action') return -1;
        if (b.matchType === 'title' || b.matchType === 'action') return 1;
      }
      // 3. Fallback to order
      return (a.task?.order || 0) - (b.task?.order || 0);
    });
  }, [query, scope, tasks, archivedTasks, trashedTasks, AVAILABLE_ACTIONS]);

  // Keyboard listeners for Double Shift, CMD+K / CTRL+K, and any typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keypresses inside form inputs if the modal isn't open yet
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;

      // Type any character to immediately pop up anysearch
      if (!isInput && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (!isOpen) {
          e.preventDefault();
          setIsOpen(true);
          setQuery(e.key);
        } else {
          // If it is open but somehow the input hasn't focused yet, append it manually
          setQuery(prev => prev + e.key);
        }
        return;
      }

      // Toggle palette on Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      
      // Escape closes
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      }

      // Handle Double Shift
      if (e.key === 'Shift') {
        const now = Date.now();
        const diff = now - lastShiftTimeRef.current;
        if (diff > 0 && diff < 300) {
          e.preventDefault();
          setIsOpen(prev => !prev);
        }
        lastShiftTimeRef.current = now;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen]);

  // Handle keyboard navigation of results when open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredResults.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => (prev - 1 + filteredResults.length) % Math.max(1, filteredResults.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (filteredResults.length > 0 && filteredResults[selectedIndex]) {
          handleSelect(filteredResults[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, selectedIndex, filteredResults]);

  // Autofocus input when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
    } else {
      setTimeout(() => {
        setQuery('');
      }, 200); // Clear after fade out
    }
  }, [isOpen]);

  // Adjust selected index if filter scope dynamically shortens the list
  useEffect(() => {
    setSelectedIndex(0);
  }, [scope, query]);

  const handleSelect = (result: any) => {
    if (result.type === 'action') {
      const actionId = result.action.id;
      if (actionId === 'create-note') {
        createTask();
      } else if (actionId === 'add-workspace') {
        window.dispatchEvent(new CustomEvent('open-create-workspace'));
      } else if (actionId === 'open-files') {
        alert('To view project files directly, navigate your OS to your workspace directory or use the Electron app desktop version.');
      }
      setIsOpen(false);
      return;
    }
    setSelectedTaskId(result.task.id);
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating Header discoverability button */}
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="flex items-center gap-2 px-3 py-1.5 h-9 text-slate-550 dark:text-slate-400 bg-white/40 dark:bg-slate-900/40 border-white/60 dark:border-slate-800 rounded-xl hover:bg-white dark:hover:bg-slate-900 transition-all shadow-xs cursor-pointer select-none font-medium text-xs md:text-sm"
        title="Activate Instant Global Anysearch (Double Shift)"
      >
        <Search className="w-4 h-4 text-slate-500" />
        <span className="hidden md:inline">Anysearch...</span>
        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-1.5 font-mono text-[9px] font-medium text-slate-400 dark:text-slate-500 shadow-3xs ml-1">
          ⇧⇧ Shift
        </kbd>
      </Button>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] px-4 animate-in fade-in duration-200">
              {/* Dark blur backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="absolute inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-md"
              />

              {/* Modal Box */}
              <motion.div
                ref={containerRef}
                initial={{ opacity: 0, scale: 0.97, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -8 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="relative w-full max-w-2xl bg-white/90 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl border border-white/80 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden max-h-[70vh] transition-colors"
              >
                {/* Top search area */}
                <div className="flex items-center px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 gap-3">
                  <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Double Shift global search - type file names, descriptions, or tags..."
                    className="w-full bg-transparent border-0 outline-none p-0 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-sans text-base leading-5"
                  />
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Scoping Filter chips */}
                <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-50 dark:border-slate-850/50 bg-slate-50/50 dark:bg-slate-950/20 overflow-x-auto select-none no-scrollbar">
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mr-2 tracking-wider flex-shrink-0">Scope</span>
                  {(['all', 'titles', 'descriptions', 'tags', 'archived', 'trashed'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScope(s)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all capitalize flex-shrink-0 cursor-pointer ${
                        scope === s
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-850/50'
                      }`}
                    >
                      {s === 'all' && 'All Fields'}
                      {s === 'titles' && 'Titles Only'}
                      {s === 'descriptions' && 'Descriptions Only'}
                      {s === 'tags' && 'Tags Only'}
                      {s === 'archived' && 'Archived Files'}
                      {s === 'trashed' && 'Trash bin'}
                    </button>
                  ))}
                </div>

                {/* Results area */}
                <div className="flex-1 overflow-y-auto p-2 min-h-0">
                  {filteredResults.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
                      <Archive className="w-8 h-8 text-slate-350 dark:text-slate-600 rounded-lg" />
                      <p className="text-sm font-medium">No tasks match your query.</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredResults.map((result, index) => {
                        const isSelected = index === selectedIndex;
                        
                        if (result.type === 'action') {
                          return (
                            <div
                              key={result.action.id}
                              onClick={() => handleSelect(result)}
                              onMouseEnter={() => setSelectedIndex(index)}
                              className={`flex flex-col p-3 rounded-xl cursor-pointer select-none border transition-all duration-150 relative ${
                                isSelected
                                  ? 'bg-indigo-50/70 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800/80 shadow-3xs'
                                  : 'bg-transparent border-transparent hover:bg-slate-50/50 dark:hover:bg-slate-850/50'
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`w-8 h-8 flex items-center justify-center rounded-lg shadow-sm border ${isSelected ? 'bg-white border-indigo-100 dark:bg-slate-800 dark:border-indigo-500/30' : 'bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
                                    {result.action.icon}
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-150 truncate leading-tight">
                                      <HighlightText text={result.action.title} query={query} />
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                      <HighlightText text={result.action.description} query={query} />
                                    </p>
                                  </div>
                                </div>
                              </div>
                              {isSelected && (
                                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-indigo-500 dark:text-indigo-400 font-medium hidden sm:flex items-center gap-1 p-0.5 rounded">
                                  <span>Run Action</span>
                                  <CornerDownLeft className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                          );
                        }

                        const hasMarkdownContent = !!result.task.content && result.task.content.trim() !== '';
                        const snippet = getSnippet(result.task.content || '', query);
                        
                        return (
                          <div
                            key={result.task.id}
                            onClick={() => handleSelect(result)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={`flex flex-col p-3 rounded-xl cursor-pointer select-none border transition-all duration-150 relative ${
                              isSelected
                                ? 'bg-slate-100/70 border-slate-200 dark:bg-slate-800/80 dark:border-slate-700/80 shadow-3xs'
                                : 'bg-transparent border-transparent hover:bg-slate-50/50 dark:hover:bg-slate-850/50'
                            }`}
                          >
                            {/* Row 1: Title and Status badge */}
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2 min-w-0">
                                {result.isTrashed ? (
                                  <X className="w-4 h-4 text-rose-400 flex-shrink-0" />
                                ) : result.isArchived ? (
                                  <Archive className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                ) : (
                                  <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                )}
                                <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-150 truncate leading-relaxed">
                                  <HighlightText text={result.task.title} query={query} />
                                </h4>
                              </div>

                              {/* Status badge */}
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0 ${
                                result.isTrashed
                                  ? 'bg-rose-100 text-rose-600 border border-rose-200/50 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800/50'
                                  : result.isArchived
                                  ? 'bg-slate-100 text-slate-500 border border-slate-200/50 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                  : result.task.status === 'Done'
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/30'
                                  : result.task.status === 'In Progress'
                                  ? 'bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/30'
                                  : 'bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/30'
                              }`}>
                                {result.isTrashed ? 'Trashed' : result.isArchived ? 'Archived' : result.task.status}
                              </span>
                            </div>

                            {/* Row 2: Tag list */}
                            {result.task.tags && result.task.tags.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                {result.task.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-medium rounded-md bg-slate-100/55 text-slate-550 border border-slate-200/30 dark:bg-slate-950/30 dark:text-slate-400 dark:border-slate-800"
                                  >
                                    <Hash className="w-2.5 h-2.5 text-slate-400" />
                                    <HighlightText text={tag} query={query} />
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Row 3: Live content snippet match description */}
                            {query && hasMarkdownContent && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 border-l-2 border-slate-200 dark:border-slate-800 pl-2 italic">
                                <HighlightText text={snippet} query={query} />
                              </p>
                            )}

                            {/* Indicator for key enter selection */}
                            {isSelected && (
                              <span className="absolute right-3.5 bottom-3 text-[10px] text-slate-400 dark:text-slate-500 font-medium hidden sm:flex items-center gap-1 p-0.5 rounded">
                                <span>Open task</span>
                                <CornerDownLeft className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Superfast Palette instructions footer */}
                <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-mono flex-shrink-0 select-none">
                  <div className="flex gap-4">
                    <span className="flex items-center gap-1">
                      <kbd className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-1 rounded shadow-3xs text-[9px]">↑↓</kbd>
                      <span>navigate</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-1 rounded shadow-3xs text-[9px]">Enter</kbd>
                      <span>open</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-1-5 rounded shadow-3xs text-[9px]">Esc</kbd>
                      <span>close</span>
                    </span>
                  </div>
                  <div className="hidden sm:inline">
                    <span>Double Shift globally or </span>
                    <kbd className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-1 rounded shadow-3xs text-[9px]">⌘K</kbd>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
