import * as Diff from 'diff';
import MDEditor from '@uiw/react-md-editor';
import { useStore } from '../store';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { useState, useEffect, useRef, useMemo } from 'react';
import { TaskStatus } from '../types';
import { FileText, Sparkles, Bold, Italic, List, ListOrdered, X } from 'lucide-react';

// Simple, robust conversion helper for Markdown -> HTML
function getMarkdownHtml(md: string): string {
  if (!md) return '';
  let html = md;
  
  // Replace double asterisks (bold)
  html = html.replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>');
  
  // Replace single asterisks (italic)
  html = html.replace(/\*([\s\S]*?)\*/g, '<em>$1</em>');
  
  // Replace strike-throughs
  html = html.replace(/~~([\s\S]*?)~~/g, '<s>$1</s>');
  
  // Replace headers (H1, H2, H3)
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Replace bullet points
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/^\s*\*\s+(.*$)/gim, '<li>$1</li>');
  
  // Replace numbered lists
  html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>');

  // Convert simple newline breaks to divs for editing feel
  const lines = html.split('\n');
  const processed = lines.map(line => {
    if (line.trim() === '') return '<div><br></div>';
    if (line.startsWith('<h3>') || line.startsWith('<h2>') || line.startsWith('<h1>') || line.startsWith('<li>')) return line;
    return `<div>${line}</div>`;
  });
  
  return processed.join('');
}

// Simple, robust conversion helper for HTML -> Markdown
function getHtmlMarkdown(html: string): string {
  if (!html) return '';
  
  let md = html;
  
  // Convert basic container divs / paragraphs to linebreaks
  md = md.replace(/<p[^>]*>/gi, '');
  md = md.replace(/<\/p>/gi, '\n');
  md = md.replace(/<div[^>]*>/gi, '');
  md = md.replace(/<\/div>/gi, '\n');
  md = md.replace(/<br[^>]*>/gi, '\n');
  
  // Convert headings
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n');
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n');
  
  // Convert strong/bold
  md = md.replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  
  // Convert em/italic
  md = md.replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
  
  // Convert lists
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<ul[^>]*>/gi, '');
  md = md.replace(/<\/ul>/gi, '\n');
  md = md.replace(/<ol[^>]*>/gi, '');
  md = md.replace(/<\/ol>/gi, '\n');
  
  // Clean entities
  md = md
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
    
  // Normalize consecutive line breaks and trim empty spaces
  return md.split('\n').map(line => line.trim()).filter(line => line !== '').join('\n');
}

export function TaskEditorSheet() {
  const { 
    selectedTaskId, 
    setSelectedTaskId, 
    tasks, 
    archivedTasks, 
    trashedTasks,
    updateTask, 
    archiveTask, 
    unarchiveTask, 
    trashTask,
    untrashTask,
    deleteTask, 
    theme, 
    resolvePendingChanges 
  } = useStore();
  
  const task = tasks.find(t => t.id === selectedTaskId) || archivedTasks.find(t => t.id === selectedTaskId) || trashedTasks.find(t => t.id === selectedTaskId);
  const isArchived = archivedTasks.some(t => t.id === selectedTaskId);
  const isTrashed = trashedTasks.some(t => t.id === selectedTaskId);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [editorMode, setEditorMode] = useState<'markdown' | 'wysiwyg'>('markdown');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [width, setWidth] = useState(672); // max-w-2xl default
  const isResizing = useRef(false);
  const wysiwygRef = useRef<HTMLDivElement>(null);

  const allExistingTags = useMemo(() => {
    const set = new Set<string>();
    const processTaskTags = (t: any) => t.tags?.forEach((tag: string) => set.add(tag));
    tasks.forEach(processTaskTags);
    archivedTasks.forEach(processTaskTags);
    trashedTasks.forEach(processTaskTags);
    return Array.from(set);
  }, [tasks, archivedTasks, trashedTasks]);

  const suggestedTags = useMemo(() => {
    const suggestions = new Set<string>();
    
    // Extract [bracketed] words
    const bracketMatches = title.match(/\[(.*?)\]/g);
    if (bracketMatches) {
      bracketMatches.forEach(m => {
        const tag = m.slice(1, -1).trim();
        if (tag) suggestions.add(tag);
      });
    }

    // Extract existing tags that appear as whole words
    allExistingTags.forEach(existingTag => {
      const escaped = existingTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(title)) {
        suggestions.add(existingTag);
      }
    });

    // Remove tags already active on the task
    return Array.from(suggestions).filter(sugg => 
      !tags.some(t => t.toLowerCase() === sugg.toLowerCase())
    );
  }, [title, allExistingTags, tags]);

  // Sync state content to contentEditable ref when entering wysiwyg tab
  useEffect(() => {
    if (editorMode === 'wysiwyg' && wysiwygRef.current) {
      wysiwygRef.current.innerHTML = getMarkdownHtml(content);
    }
  }, [editorMode]);

  const handleWysiwygInput = () => {
    if (wysiwygRef.current) {
      const markdown = getHtmlMarkdown(wysiwygRef.current.innerHTML);
      setContent(markdown);
    }
  };

  const execWysiwygCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    handleWysiwygInput();
    if (wysiwygRef.current) {
      wysiwygRef.current.focus();
    }
  };

  const isLoadedRef = useRef(false);
  const lastTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedTaskId) {
      lastTaskIdRef.current = null;
      isLoadedRef.current = false;
      return;
    }

    if (selectedTaskId !== lastTaskIdRef.current && task && !task.pendingExternalChanges) {
      setTitle(task.title);
      setContent(task.content);
      setTags(task.tags || []);
      setShowDeleteConfirm(false);
      lastTaskIdRef.current = selectedTaskId;
      setTimeout(() => {
        isLoadedRef.current = true;
      }, 50);
    }
  }, [selectedTaskId, task]);

  // Autosave whenever title, content or tags change
  useEffect(() => {
    if (!isLoadedRef.current || !task) return;

    const delayDebounceFn = setTimeout(() => {
      updateTask(task.id, { title, content, tags });
    }, 500); // 500ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [title, content, tags, task?.id]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = window.innerWidth - e.clientX;
      setWidth(Math.max(400, Math.min(newWidth, window.innerWidth - 100)));
    };
    
    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleClose = () => {
    if (task && isLoadedRef.current) {
      updateTask(task.id, { title, content, tags });
    }
    setSelectedTaskId(null);
  };

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      if (!tags.includes(newTag.trim())) {
        setTags([...tags, newTag.trim()]);
      }
      setNewTag('');
    }
  };

  const handleTagInputBlur = () => {
    const trimmed = newTag.trim();
    if (trimmed) {
      if (!tags.includes(trimmed)) {
        setTags([...tags, trimmed]);
      }
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const renderDiff = (oldText: string, newText: string) => {
    const diff = Diff.diffWords(oldText || '', newText || '');
    return (
      <div className="font-mono text-sm whitespace-pre-wrap leading-relaxed p-4 bg-slate-900 text-slate-300 rounded-lg overflow-auto">
        {diff.map((part, i) => (
          <span 
            key={i} 
            className={
              part.added ? 'bg-emerald-900 text-emerald-300' : 
              part.removed ? 'bg-rose-900 text-rose-300 line-through' : ''
            }
          >
            {part.value}
          </span>
        ))}
      </div>
    );
  };

  return (
    <Sheet open={!!selectedTaskId} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent 
        className="w-full flex flex-col h-full bg-white/70 dark:bg-slate-900/80 backdrop-blur-3xl border-l border-white/50 dark:border-slate-700 shadow-2xl overflow-hidden p-0 sm:max-w-none transition-none"
        style={{ maxWidth: `${width}px` }}
      >
        <div 
          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-50 hover:bg-blue-500/20 active:bg-blue-500/40 transition-colors"
          onMouseDown={() => {
            isResizing.current = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
        />
        
        {task?.pendingExternalChanges ? (
          <>
            <div className="p-6 border-b border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 flex-shrink-0 transition-colors">
              <SheetHeader>
                <SheetTitle className="text-amber-800 dark:text-amber-200">External Updates Pending</SheetTitle>
                <SheetDescription className="text-amber-700 dark:text-amber-400">
                  An agent or external process modified this file while you were working. Accept or discard their changes to proceed.
                </SheetDescription>
              </SheetHeader>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
               <div className="space-y-4">
                 <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Title Diff</h3>
                 {renderDiff(task.title, task.pendingExternalChanges.title)}
                 
                 <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mt-6">Content Diff</h3>
                 {renderDiff(task.content, task.pendingExternalChanges.content)}
               </div>
               
               <div className="flex gap-4 pt-8">
                 <Button className="flex-1 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => resolvePendingChanges(task.id, 'accept')}>
                   Accept External Changes
                 </Button>
                 <Button className="flex-1 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700" onClick={() => resolvePendingChanges(task.id, 'discard')}>
                   Discard External Changes
                 </Button>
               </div>
            </div>
          </>
        ) : task ? (
          <>
            <div className="p-6 border-b border-white/40 dark:border-slate-700/50 bg-white/30 dark:bg-slate-950/30 flex-shrink-0 transition-colors">
              <SheetHeader>
                <div className="flex items-center gap-2.5">
                  <SheetTitle className="text-slate-800 dark:text-slate-100">Edit Task</SheetTitle>
                  {isArchived && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200/50 dark:bg-slate-800 dark:text-slate-405 dark:border-slate-700">
                      Archived
                    </span>
                  )}
                  {isTrashed && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-rose-100 text-rose-600 border border-rose-200/50 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800/50">
                      Trashed
                    </span>
                  )}
                </div>
                <SheetDescription className="text-slate-600 dark:text-slate-400">
                  {isTrashed 
                    ? "This task is in the trash. Restore it to move it back to the active board."
                    : isArchived 
                    ? "This task is archived. Changing fields will save directly to the archived markdown file."
                    : "Changes are saved directly to the frontmatter and markdown body of your local file."}
                </SheetDescription>
              </SheetHeader>
            </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10 transition-colors">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Title</label>
              <Input 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/60 dark:border-slate-700 focus:bg-white/80 dark:focus:bg-slate-800/80 text-slate-900 dark:text-slate-100 shadow-sm transition-colors"
              />
              {suggestedTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-slate-500">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Suggested:</span>
                  {suggestedTags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTags(prev => [...prev, tag])}
                      className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 border border-indigo-200/50 transition-colors"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tags (Press Enter)</label>
              <Input 
                value={newTag} 
                onChange={e => setNewTag(e.target.value)} 
                onKeyDown={addTag}
                onBlur={handleTagInputBlur}
                placeholder="Add a tag..."
                className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/60 dark:border-slate-700 focus:bg-white/80 dark:focus:bg-slate-800/80 text-slate-900 dark:text-slate-100 shadow-sm transition-colors"
              />
              <div className="flex gap-2 flex-wrap mt-2">
                {tags.map(t => (
                  <Badge 
                    key={t} 
                    variant="secondary" 
                    className="group relative flex items-center gap-1.5 pl-2.5 pr-2 py-1 bg-white/70 dark:bg-slate-700/70 backdrop-blur-md border border-white/60 dark:border-slate-600 text-slate-800 dark:text-slate-200 shadow-sm h-7 rounded-md transition-all duration-200 hover:bg-white/100 dark:hover:bg-slate-700/100"
                  >
                    <span className="text-xs font-medium select-none">{t}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTag(t);
                      }}
                      className="inline-flex items-center justify-center p-0.5 w-4 h-4 rounded-full text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 opacity-0 group-hover:opacity-100 focus:outline-none transition-all duration-150"
                      title={`Remove tag ${t}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2 flex flex-col flex-1" data-color-mode={theme}>
              <div className="flex justify-between items-center bg-slate-500/5 dark:bg-slate-500/10 p-1 rounded-xl border border-white/40 dark:border-slate-800">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 px-2">Description</label>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                  <button 
                    type="button"
                    onClick={() => setEditorMode('markdown')}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors ${editorMode === 'markdown' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Markdown (Code)
                  </button>
                  <button 
                    type="button"
                    onClick={() => setEditorMode('wysiwyg')}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors ${editorMode === 'wysiwyg' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    WYSIWYG (Visual)
                  </button>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden shadow-sm border border-white/60 dark:border-slate-600 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm transition-colors flex flex-col min-h-[380px]">
                {editorMode === 'markdown' ? (
                  <MDEditor
                    value={content}
                    onChange={(val) => setContent(val || '')}
                    preview="edit"
                    height={380}
                    className="!border-0 !bg-transparent w-full"
                    textareaProps={{
                      placeholder: "Write task description here (Markdown support)..."
                    }}
                  />
                ) : (
                  <div className="flex flex-col h-[380px] flex-1">
                    {/* Visual Editor Toolbar */}
                    <div className="flex items-center gap-1.5 p-2 bg-slate-100/50 dark:bg-slate-800/40 border-b border-white/30 dark:border-slate-700/30 flex-wrap">
                      <button
                        type="button"
                        onClick={() => execWysiwygCommand('bold')}
                        className="p-1 px-2.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1"
                        title="Bold"
                      >
                        <Bold className="w-3.5 h-3.5" />
                        <span>Bold</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => execWysiwygCommand('italic')}
                        className="p-1 px-2.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1"
                        title="Italic"
                      >
                        <Italic className="w-3.5 h-3.5" />
                        <span>Italic</span>
                      </button>
                      <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1" />
                      <button
                        type="button"
                        onClick={() => execWysiwygCommand('formatBlock', '<h1>')}
                        className="p-1 px-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-700 dark:text-slate-300 font-bold text-xs"
                        title="Heading 1"
                      >
                        H1
                      </button>
                      <button
                        type="button"
                        onClick={() => execWysiwygCommand('formatBlock', '<h2>')}
                        className="p-1 px-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-700 dark:text-slate-300 font-bold text-xs"
                        title="Heading 2"
                      >
                        H2
                      </button>
                      <button
                        type="button"
                        onClick={() => execWysiwygCommand('formatBlock', '<h3>')}
                        className="p-1 px-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-700 dark:text-slate-300 font-bold text-xs"
                        title="Heading 3"
                      >
                        H3
                      </button>
                      <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1" />
                      <button
                        type="button"
                        onClick={() => execWysiwygCommand('insertUnorderedList')}
                        className="p-1 px-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-700 dark:text-slate-300 flex items-center gap-1 text-xs"
                        title="Bullet List"
                      >
                        <List className="w-3.5 h-3.5" />
                        <span>List</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => execWysiwygCommand('insertOrderedList')}
                        className="p-1 px-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-700 dark:text-slate-300 flex items-center gap-1 text-xs"
                        title="Numbered List"
                      >
                        <ListOrdered className="w-3.5 h-3.5" />
                        <span>Num List</span>
                      </button>
                    </div>

                    {/* contentEditable Rich Text Area */}
                    <div 
                      ref={wysiwygRef}
                      contentEditable
                      onInput={handleWysiwygInput}
                      data-placeholder="Write task description here..."
                      className="flex-1 p-4 outline-none text-slate-800 dark:text-slate-100 bg-transparent overflow-y-auto leading-relaxed focus:ring-0 prose prose-slate dark:prose-invert max-w-none custom-wysiwyg-editor min-h-[320px] empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400/60 dark:empty:before:text-slate-500/60 empty:before:pointer-events-none empty:before:font-normal empty:before:text-sm"
                      style={{ height: '320px' }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between pt-4 border-t border-white/20 dark:border-slate-800 mt-6 flex-shrink-0">
              {showDeleteConfirm ? (
                <div className="flex items-center gap-3 bg-rose-50 dark:bg-rose-950/20 p-2 px-3 rounded-lg border border-rose-200/50 dark:border-rose-900/30">
                  <span className="text-xs font-semibold text-rose-800 dark:text-rose-200">Permanently delete?</span>
                  <div className="flex items-center gap-1.5">
                    <Button variant="destructive" size="sm" onClick={() => { deleteTask(task.id); handleClose(); }} className="shadow-xs px-2.5 py-1 text-[11px] h-7 bg-rose-600 hover:bg-rose-700">
                      Yes, Delete
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)} className="shadow-xs px-2.5 py-1 text-[11px] h-7 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {isTrashed ? (
                    <Button variant="outline" onClick={() => { untrashTask(task.id); handleClose(); }} className="shadow-sm border-emerald-250 hover:bg-emerald-50 dark:border-emerald-800/30 dark:hover:bg-emerald-950/20 text-emerald-650 dark:text-emerald-450 font-semibold h-9 py-1 px-3.5 text-xs">
                      Restore from Trash
                    </Button>
                  ) : isArchived ? (
                    <Button variant="outline" onClick={() => { unarchiveTask(task.id); handleClose(); }} className="shadow-sm border-emerald-250 hover:bg-emerald-50 dark:border-emerald-800/30 dark:hover:bg-emerald-950/20 text-emerald-650 dark:text-emerald-450 font-semibold h-9 py-1 px-3.5 text-xs">
                      Restore Task
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => { archiveTask(task.id); handleClose(); }} className="shadow-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 h-9 py-1 px-3.5 text-xs font-semibold">
                      Archive Task
                    </Button>
                  )}
                  {isTrashed ? (
                    <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)} className="shadow-sm border-none bg-rose-600 hover:bg-rose-700 text-white font-semibold h-9 py-1 px-3.5 text-xs">
                      Delete Permanently
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => { trashTask(task.id); handleClose(); }} className="shadow-sm border-rose-200 hover:bg-rose-50 dark:border-rose-900/30 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-450 font-semibold h-9 py-1 px-3.5 text-xs">
                      Move to Trash
                    </Button>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3">
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full border border-emerald-250/20 dark:border-emerald-800/20">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Autosaved
                </span>
                <Button onClick={handleClose} className="shadow-sm px-5 bg-slate-800 hover:bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white font-semibold transition-colors">Close</Button>
              </div>
            </div>
          </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
