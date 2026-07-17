import { useState, useEffect, useRef } from 'react';
import { FolderOpen, Plus, Moon, Sun, Columns, Palette, ChevronDown, Check, Briefcase, Trash2, Edit3, X, Image } from 'lucide-react';
import { Button } from './components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "./components/ui/dropdown-menu";
import { useStore } from './store';
import { KanbanBoard } from './components/KanbanBoard';
import { TaskEditorSheet } from './components/TaskEditorSheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Card, CardContent } from './components/ui/card';
import matter from 'gray-matter';
import { useMaterialTheme } from './hooks/useMaterialTheme';
import { ImportConflictResolver } from './components/ImportConflictResolver';
import { CreateProjectModal } from './components/CreateProjectModal';
import { CreateViewModal } from './components/CreateViewModal';
import { InitializeWorkspace } from './components/InitializeWorkspace';
import { CommandPalette } from './components/CommandPalette';

export default function App() {
  const { 
    loadTasks, 
    archivedTasks, 
    trashedTasks,
    unarchiveTask, 
    createTask, 
    theme, 
    toggleTheme, 
    themeColor, 
    setThemeColor,
    projects,
    currentProject,
    switchProject,
    createProject,
    loadProjects,
    boards,
    activeBoardId,
    setActiveBoardId,
    createBoard,
    deleteBoard,
    updateBoard,
    defaultSortColumn,
    setDefaultSortColumn,
    columns,
    backgroundType,
    setBackgroundType,
    unsplashTags,
    setUnsplashTags
  } = useStore();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateViewOpen, setIsCreateViewOpen] = useState(false);
  const [projectToRename, setProjectToRename] = useState<string | null>(null);
  const [renameName, setRenameName] = useState<string>('');
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [boardToDelete, setBoardToDelete] = useState<string | null>(null);
  const [bgUrl, setBgUrl] = useState<string | null>(null);

  const colorInputRef = useRef<HTMLInputElement>(null);
  const [localThemeColor, setLocalThemeColor] = useState(themeColor);

  useEffect(() => {
    setLocalThemeColor(themeColor);
  }, [themeColor]);

  useEffect(() => {
    const input = colorInputRef.current;
    if (!input) return;
    const handleChange = (e: Event) => {
      setThemeColor((e.target as HTMLInputElement).value);
    };
    input.addEventListener('change', handleChange);
    return () => input.removeEventListener('change', handleChange);
  }, [setThemeColor]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Ctrl or Cmd is pressed along with 'n'
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault(); // Prevent default browser behavior (e.g., new window)
        createTask();
      }
    };

    const handleCustomEvents = (e: Event) => {
      if (e.type === 'open-create-workspace') {
        setIsCreateModalOpen(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault(); // Prevent file from opening in the window
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault(); // Prevent file from opening in the window
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-create-workspace', handleCustomEvents);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-create-workspace', handleCustomEvents);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [createTask]);

  useMaterialTheme();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    let active = true;
    if (backgroundType === 'bing') {
      fetch('/api/bing-image').then(r => r.json()).then(data => {
        if (active && data.url) setBgUrl(data.url);
      }).catch(console.error);
    } else if (backgroundType === 'unsplash') {
      const tags = unsplashTags || 'nature';
      fetch(`/api/unsplash-image?tags=${encodeURIComponent(tags)}&boardId=${activeBoardId || 'default'}`).then(r => r.json()).then(data => {
        if (active && data.url) setBgUrl(data.url);
      }).catch(console.error);
    } else {
      setBgUrl(null);
    }
    return () => { active = false; };
  }, [backgroundType, unsplashTags, activeBoardId, currentProject]);

  // Load once, background polling replaced by SSE inside initializeEventSource
  useEffect(() => {
    loadProjects().catch(console.error);
    loadTasks().catch(console.error);
  }, [loadTasks, loadProjects]);

  if (projects.length === 0) {
    return <InitializeWorkspace />;
  }

  return (
    <div 
      className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 relative overflow-hidden transition-colors" 
      style={{ 
        backgroundColor: 'var(--m-surface)',
        ...(bgUrl ? {
          backgroundImage: `url(${bgUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        } : {})
      }}
    >
      {/* Background Gradients */}
      <div className="absolute top-[0%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-40 dark:opacity-20" style={{ backgroundColor: 'var(--col-1-bg-mesh)' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-40 dark:opacity-20" style={{ backgroundColor: 'var(--col-4-bg-mesh)' }} />
      <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none opacity-40 dark:opacity-20" style={{ backgroundColor: 'var(--col-8-bg-mesh)' }} />

      <header className="relative z-10 border-b border-white/40 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl px-6 py-4 flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-colors">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-3 cursor-pointer outline-none hover:bg-slate-200/50 dark:hover:bg-slate-800/50 px-2 py-1.5 -ml-2 rounded-lg transition-colors">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm border border-white/30 dark:border-white/10" style={{ backgroundColor: 'var(--m-primary)', color: 'var(--m-on-primary)' }}>
              <FolderOpen className="w-4 h-4" />
            </div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
              {currentProject} <ChevronDown className="w-4 h-4 text-slate-500" />
            </h1>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-white/40 dark:border-slate-800 shadow-xl">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Switch Project</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-800" />
              {projects.map((project) => {
                const isSelected = project === currentProject;
                
                if (projectToRename === project) {
                  return (
                    <div 
                      key={project} 
                      className="flex items-center gap-1.5 p-1 px-2.5" 
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input 
                        type="text" 
                        value={renameName} 
                        onChange={(e) => setRenameName(e.target.value)}
                        className="flex-1 text-xs bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-1.5 py-1 text-slate-850 dark:text-slate-150 focus:outline-none focus:border-indigo-500 font-medium"
                        autoFocus
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            const trimmed = renameName.trim();
                            if (trimmed && trimmed !== project) {
                              try {
                                await useStore.getState().renameProject(project, trimmed);
                                setProjectToRename(null);
                              } catch (err) {
                                console.error(err);
                              }
                            }
                          } else if (e.key === 'Escape') {
                            setProjectToRename(null);
                          }
                        }}
                      />
                      <button 
                        onClick={async () => {
                          const trimmed = renameName.trim();
                          if (trimmed && trimmed !== project) {
                            try {
                              await useStore.getState().renameProject(project, trimmed);
                              setProjectToRename(null);
                            } catch (err) {
                              console.error(err);
                            }
                          }
                        }}
                        className="p-1 text-emerald-650 hover:bg-emerald-500/10 rounded cursor-pointer shrink-0"
                        title="Save Rename"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => setProjectToRename(null)}
                        className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer shrink-0"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                if (projectToDelete === project) {
                  return (
                    <div 
                      key={project} 
                      className="flex flex-col gap-1.5 p-2 bg-slate-50 dark:bg-slate-950/45 border-y border-slate-200/50 dark:border-slate-800/50 my-1 font-sans" 
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-[10px] text-rose-600 dark:text-rose-400 leading-tight font-medium">
                        Unmap project? Local Markdown files are safe on disk!
                      </div>
                      <div className="flex gap-1.5 justify-end">
                        <button 
                          onClick={async () => {
                            try {
                              await useStore.getState().removeProject(project);
                              setProjectToDelete(null);
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className="px-2 py-0.5 text-[10px] bg-rose-500 text-white font-semibold rounded hover:bg-rose-600 active:scale-95 transition-all shadow-sm cursor-pointer"
                        >
                          Unmap
                        </button>
                        <button 
                          onClick={() => setProjectToDelete(null)}
                          className="px-2 py-0.5 text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-350 font-medium rounded hover:bg-slate-300 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <DropdownMenuItem 
                    key={project} 
                    className={`flex justify-between items-center cursor-pointer group px-2.5 py-1.5 rounded-lg ${isSelected ? 'bg-slate-100/60 dark:bg-slate-800/65' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/30'}`}
                    onClick={() => switchProject(project)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Briefcase className={`w-4 h-4 shrink-0 p-0.5 rounded ${isSelected ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10' : 'text-slate-400 dark:text-slate-500'}`} />
                      <span className={`font-semibold text-xs truncate ${isSelected ? 'text-slate-900 dark:text-slate-100' : ''}`}>{project}</span>
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setProjectToRename(project);
                          setRenameName(project);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-indigo-500 hover:bg-indigo-505/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 outline-none cursor-pointer"
                        title="Rename Project"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      
                      <button
                        onClick={() => setProjectToDelete(project)}
                        className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 outline-none cursor-pointer"
                        title="Unregister/Unmap Project"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      
                      {isSelected && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 ml-1" />}
                    </div>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-800" />
              <DropdownMenuItem 
                className="flex gap-2 items-center text-blue-600 dark:text-blue-400 cursor-pointer"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <Plus className="w-4 h-4" />
                <span>Create New Project...</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
        
        {/* Boards Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-lg px-3 transition-all h-9 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md shadow-sm border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between min-w-[140px] cursor-pointer outline-none text-sm font-medium">
            <div className="flex items-center truncate">
              <Columns className="w-4 h-4 mr-2 text-indigo-500 shrink-0" />
              <span className="truncate">{boards.find(b => b.id === activeBoardId)?.name || 'Main Board'}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 ml-2 opacity-50 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-xl p-2 shadow-2xl">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase px-2 mb-1">
                Views
              </DropdownMenuLabel>
              {boards.map(board => {
                const isSelected = board.id === activeBoardId;
                
                if (boardToDelete === board.id) {
                  return (
                    <div 
                      key={board.id} 
                      className="flex flex-col gap-1.5 p-2 bg-slate-50 dark:bg-slate-950/45 border-y border-slate-200/50 dark:border-slate-800/50 my-1 font-sans rounded-md" 
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onPointerUp={(e) => e.stopPropagation()}
                    >
                      <div className="text-[10px] text-rose-600 dark:text-rose-400 leading-tight font-medium">
                        Delete this view?
                      </div>
                      <div className="flex gap-1.5 justify-end">
                        <button 
                          onClick={() => {
                            deleteBoard(board.id);
                            setBoardToDelete(null);
                          }}
                          className="px-2 py-1 bg-rose-500 hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-700 text-white text-[10px] font-bold rounded shadow-sm transition-colors cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button 
                          onClick={() => setBoardToDelete(null)}
                          className="px-2 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded shadow-sm transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <DropdownMenuItem 
                    key={board.id} 
                    className={`flex justify-between items-center cursor-pointer group px-2.5 py-1.5 rounded-lg ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/30'}`}
                    onClick={(e) => {
                      if (boardToDelete === board.id) {
                        e.preventDefault();
                      } else {
                        if (boardToDelete) setBoardToDelete(null);
                        setActiveBoardId(board.id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-xs truncate">{board.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                       {board.id !== 'default' && (
                          <button
                            className="delete-board-btn p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 outline-none cursor-pointer"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setBoardToDelete(board.id);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                            title="Delete View"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                       )}
                       {isSelected && <Check className="w-4 h-4 shrink-0 ml-1" />}
                    </div>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-800" />
              <DropdownMenuItem 
                className="flex gap-2 items-center text-indigo-600 dark:text-indigo-400 cursor-pointer"
                onClick={() => setIsCreateViewOpen(true)}
              >
                <Plus className="w-4 h-4" />
                <span>Create New View...</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex flex-1" />
        <div className="flex items-center gap-2">
          <CommandPalette />
          
          <label className="relative flex items-center justify-center w-8 h-8 rounded-full cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors" title="Change Theme Color">
            <input 
              type="color" 
              ref={colorInputRef}
              value={localThemeColor} 
              onChange={(e) => setLocalThemeColor(e.target.value)} 
              className="absolute opacity-0 w-0 h-0"
            />
            <div className="w-5 h-5 rounded-full shadow-sm border border-slate-300 dark:border-slate-600" style={{ backgroundColor: localThemeColor }} />
          </label>
          
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-full h-8 w-8 transition-colors">
             {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-full h-8 w-8 transition-colors flex items-center justify-center cursor-pointer outline-none" title="Background Settings">
              <Image className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 shadow-xl rounded-xl">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Background Image</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setBackgroundType('none')} className="cursor-pointer flex items-center justify-between">
                  <span>None (Color Only)</span>
                  {(!backgroundType || backgroundType === 'none') && <Check className="w-4 h-4 text-indigo-500" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBackgroundType('bing')} className="cursor-pointer flex items-center justify-between">
                  <span>Bing Daily Photo</span>
                  {backgroundType === 'bing' && <Check className="w-4 h-4 text-indigo-500" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBackgroundType('unsplash')} className="cursor-pointer flex items-center justify-between">
                  <span>Unsplash (Tags)</span>
                  {backgroundType === 'unsplash' && < Check className="w-4 h-4 text-indigo-500" />}
                </DropdownMenuItem>
                
                {backgroundType === 'unsplash' && (
                  <div className="p-2 space-y-2 border-t border-slate-200 dark:border-slate-800 mt-1">
                    <label className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Unsplash Tags</label>
                    <input
                      type="text"
                      value={unsplashTags || ''}
                      onChange={(e) => setUnsplashTags(e.target.value)}
                      placeholder="e.g. space,dark"
                      className="w-full text-xs bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1.5 text-slate-850 dark:text-slate-150 focus:outline-none focus:border-indigo-500 font-medium"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <div className="flex bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-md border border-white/60 dark:border-slate-700 shadow-sm p-1">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-sm h-7 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors px-3 outline-none">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 mr-2">Sort:</span>
                <span className="text-sm font-medium">{defaultSortColumn ? columns.find(c => c.id === defaultSortColumn)?.title || defaultSortColumn : (columns[0]?.title || 'To Do')}</span>
                <ChevronDown className="w-3.5 h-3.5 ml-2 opacity-50" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 shadow-xl rounded-xl">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-slate-500">Default Sort Column</DropdownMenuLabel>
                  {columns.map(col => (
                    <DropdownMenuItem 
                      key={col.id}
                      onClick={() => setDefaultSortColumn(col.id)}
                      className="cursor-pointer flex items-center justify-between"
                    >
                      {col.title}
                      {defaultSortColumn === col.id || (!defaultSortColumn && columns[0]?.id === col.id) ? (
                        <Check className="w-4 h-4 text-indigo-500" />
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 my-auto mx-1" />
             <Button 
               onClick={() => {
                 const randomColorIndex = Math.floor(Math.random() * 10).toString();
                 useStore.getState().addColumn('New Column', randomColorIndex);
               }} 
               size="sm" 
               variant="ghost" 
               className="h-7 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors rounded-sm px-3"
             >
              <Columns className="w-4 h-4 mr-1.5" />
              Add Column
            </Button>
          </div>
        </div>
      </header>
      
      <main 
        className="relative z-10 flex-1 p-6 overflow-hidden flex flex-col"
      >
        <Tabs defaultValue="board" className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-6">
            <TabsList className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-lg border border-white/50 dark:border-slate-700 p-1 shadow-sm rounded-xl transition-colors">
              <TabsTrigger value="board" className="rounded-lg data-[state=active]:bg-white/80 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors">Board</TabsTrigger>
              <TabsTrigger value="archive" className="rounded-lg data-[state=active]:bg-white/80 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors">Archive ({archivedTasks.length})</TabsTrigger>
              <TabsTrigger value="trash" className="rounded-lg data-[state=active]:bg-white/80 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors">Trash ({trashedTasks.length})</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="board" className="flex-1 min-h-0 m-0 outline-none">
            <KanbanBoard />
          </TabsContent>
          
          <TabsContent value="archive" className="flex-1 min-h-0 m-0 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-5xl cursor-pointer">
              {archivedTasks.map(task => (
                <Card key={task.id} onClick={() => useStore.getState().setSelectedTaskId(task.id)} className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-white/50 dark:border-slate-700 shadow-sm opacity-75 hover:opacity-100 transition-all cursor-pointer">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-slate-700 dark:text-slate-300 line-through mb-2">{task.title}</h3>
                    <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); unarchiveTask(task.id); }} className="bg-white/60 dark:bg-slate-800/60 hover:bg-white/80 dark:hover:bg-slate-700 border border-white/50 dark:border-slate-600 text-slate-700 dark:text-slate-300 transition-colors">
                      Restore
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {archivedTasks.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl border border-dashed border-white/60 dark:border-slate-700 shadow-sm transition-colors cursor-default">
                  No archived tasks.
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="trash" className="flex-1 min-h-0 m-0 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-5xl">
              {trashedTasks.map(task => (
                <Card key={task.id} onClick={() => useStore.getState().setSelectedTaskId(task.id)} className="bg-rose-50/40 dark:bg-rose-950/20 backdrop-blur-md border-rose-200/50 dark:border-rose-900/50 shadow-sm transition-all cursor-pointer hover:shadow-md">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-rose-800 dark:text-rose-300 mb-2">{task.title}</h3>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); useStore.getState().untrashTask(task.id); }} className="bg-white/60 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-white/50 dark:border-slate-600 hover:border-emerald-200 dark:hover:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 transition-colors">
                        Restore
                      </Button>
                      <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); useStore.getState().deleteTask(task.id); }} className="bg-rose-600 hover:bg-rose-700 text-white border-0 transition-colors">
                        Delete Forever
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {trashedTasks.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl border border-dashed border-white/60 dark:border-slate-700 shadow-sm transition-colors cursor-default">
                  No trashed tasks.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <TaskEditorSheet />
      <ImportConflictResolver />
      <CreateProjectModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      <CreateViewModal isOpen={isCreateViewOpen} onClose={() => setIsCreateViewOpen(false)} />
    </div>
  );
}
