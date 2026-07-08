import { create } from 'zustand';
import matter from 'gray-matter';
import { Task, TaskStatus, ColumnDef, BoardConfig } from './types';

// Browser-safe matter parsing (sometimes Buffer is needed down the line, we'll see)
// For gray-matter to work in Vite, we might need a workaround, but we'll try it directly.

interface AppState {
  projects: string[];
  currentProject: string;
  tasks: Task[];
  archivedTasks: Task[];
  trashedTasks: Task[];
  columns: ColumnDef[];
  isInitialized: boolean;
  selectedTaskId: string | null;
  isCreatingNewTask: boolean;
  setIsCreatingNewTask: (val: boolean) => void;
  newTaskDefaultColumn: string | null;
  setNewTaskDefaultColumn: (val: string | null) => void;
  newTaskDefaultPosition: 'top' | 'bottom';
  setNewTaskDefaultPosition: (val: 'top' | 'bottom') => void;
  theme: 'light' | 'dark';
  themeColor: string;
  defaultSortColumn: string | null;
  backgroundType: 'none' | 'bing' | 'unsplash';
  unsplashTags: string;
  setDefaultSortColumn: (col: string | null) => void;
  setBackgroundType: (type: 'none' | 'bing' | 'unsplash') => void;
  setUnsplashTags: (tags: string) => void;
  boards: BoardConfig[];
  activeBoardId: string;
  
  // Custom states for Markdown folder checking & conversion
  pendingResolveProject: string | null;
  pendingResolveFiles: Array<{ filename: string, content: string }> | null;
  setPendingResolve: (project: string | null, files: Array<{ filename: string, content: string }> | null) => void;
  checkProjectFolder: (name: string, path: string) => Promise<{ status: string; invalidFiles?: any[] }>;
  importAndFormatFile: (projectName: string, filename: string) => Promise<boolean>;

  loadProjects: () => Promise<void>;
  createProject: (name: string, path?: string) => Promise<void>;
  renameProject: (oldName: string, newName: string) => Promise<void>;
  removeProject: (name: string) => Promise<void>;
  switchProject: (name: string) => Promise<void>;
  initializeEventSource: () => void;
  loadTasks: () => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  createTask: (title?: string, status?: string) => Promise<void>;
  moveTask: (id: string, newStatus: TaskStatus) => Promise<void>;
  reorderTask: (id: string, overId: string | null, overColumn: TaskStatus) => Promise<void>;
  archiveTask: (id: string) => Promise<void>;
  unarchiveTask: (id: string) => Promise<void>;
  trashTask: (id: string) => Promise<void>;
  untrashTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  resolvePendingChanges: (id: string, action: 'accept' | 'discard') => Promise<void>;
  setSelectedTaskId: (id: string | null) => void;
  toggleTheme: () => void;
  setThemeColor: (color: string) => void;

  addColumn: (title: string, color: string) => Promise<void>;
  updateColumn: (id: string, updates: Partial<ColumnDef>) => Promise<void>;
  deleteColumn: (id: string) => Promise<void>;

  createBoard: (board: Omit<BoardConfig, 'id'>) => Promise<void>;
  updateBoard: (id: string, board: Partial<BoardConfig>) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;
  setActiveBoardId: (id: string) => void;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'To Do', title: 'To Do', color: 'blue', size: 'medium', order: 0 },
  { id: 'In Progress', title: 'In Progress', color: 'amber', size: 'medium', order: 1 },
  { id: 'Done', title: 'Done', color: 'emerald', size: 'medium', order: 2 }
];

const normalizeMarkdown = (str: string) => {
  return (str || '').replace(/\r\n/g, '\n').trim();
};

const stringifyFrontmatter = (content: string, data: any) => {
  let yaml = '---\n';
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined || val === null) continue;
    if (Array.isArray(val)) {
      yaml += `${key}: [${val.map(v => typeof v === 'string' ? `"${v.replace(/"/g, '\\"')}"` : v).join(', ')}]\n`;
    } else if (typeof val === 'object') {
      yaml += `${key}: ${JSON.stringify(val)}\n`;
    } else if (typeof val === 'string') {
      yaml += `${key}: "${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"\n`;
    } else {
      yaml += `${key}: ${val}\n`;
    }
  }
  yaml += '---\n';
  const body = content || '';
  return yaml + (body.startsWith('\n') ? body : '\n' + body);
};

const parseMarkdownText = (filename: string, text: string): Task => {
  const cleanContent = (c: string) => {
    const trimmed = (c || '').trim();
    if (trimmed === '' || trimmed === 'Task description...') {
      return '';
    }
    return trimmed;
  };

  try {
    const parsed = matter(text);
    
    // Extract data with fallbacks
    const title = parsed.data.title || filename.replace('.md', '');
    const status = parsed.data.status || 'To Do';
    const tags = parsed.data.tags || [];
    const order = parsed.data.order !== undefined ? parsed.data.order : Date.now();
    const archived = parsed.data.archived || false;
    
    return {
      id: filename,
      title,
      status: status as TaskStatus,
      tags,
      order,
      content: cleanContent(parsed.content),
      ...(archived && { archived: true })
    };
  } catch (error) {
    console.warn('gray-matter parsing failed, using manual regex parser fallback:', error);
    const fmRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
    const match = text.match(fmRegex);
    if (match) {
      const fmText = match[1];
      const body = match[2];
      const data: any = {};
      fmText.split('\n').forEach(line => {
        const parts = line.split(':');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          let val = parts.slice(1).join(':').trim();
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1);
          }
          if (val.startsWith('[') && val.endsWith(']')) {
            try {
              data[key] = JSON.parse(val.replace(/'/g, '"'));
            } catch (e) {
              data[key] = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
            }
          } else if (val === 'true') {
            data[key] = true;
          } else if (val === 'false') {
            data[key] = false;
          } else if (!isNaN(Number(val)) && val !== '') {
            data[key] = Number(val);
          } else {
            data[key] = val;
          }
        }
      });
      return {
        id: filename,
        title: data.title || filename.replace('.md', ''),
        status: (data.status || 'To Do') as TaskStatus,
        tags: Array.isArray(data.tags) ? data.tags : [],
        order: data.order !== undefined ? Number(data.order) : Date.now(),
        content: cleanContent(body),
        ...(data.archived && { archived: true })
      };
    }
    return {
      id: filename,
      title: filename.replace('.md', ''),
      status: 'To Do',
      tags: [],
      order: Date.now(),
      content: cleanContent(text)
    };
  }
};

const writeMarkdownAPI = async (task: Task, project: string) => {
  let newContent = '';
  try {
    newContent = matter.stringify(task.content || '', {
      title: task.title,
      status: task.status,
      tags: task.tags,
      order: task.order,
      archived: (task as any).archived,
      trashed: (task as any).trashed
    });
  } catch (err) {
    console.warn('gray-matter stringification failed, using pure fallback:', err);
    newContent = stringifyFrontmatter(task.content || '', {
      title: task.title,
      status: task.status,
      tags: task.tags,
      order: task.order,
      archived: (task as any).archived,
      trashed: (task as any).trashed
    });
  }
  
  const isArchived = (task as any).archived === true;
  const isTrashed = (task as any).trashed === true;
  await fetch(`/api/tasks/${task.id}?project=${encodeURIComponent(project)}&archived=${isArchived}&trashed=${isTrashed}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: newContent })
  });
};

const saveConfigAPI = async (columns: ColumnDef[], boards: BoardConfig[], themeColor: string, theme: 'light' | 'dark', defaultSortColumn: string | null, backgroundType: 'none' | 'bing' | 'unsplash', unsplashTags: string, project: string) => {
  try {
    if (!project) return;
    const configData = {
      columns,
      boards,
      themeColor,
      theme,
      defaultSortColumn,
      backgroundType,
      unsplashTags
    };
    await fetch(`/api/tasks/.kanban-config.json?project=${encodeURIComponent(project)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: JSON.stringify(configData, null, 2) })
    });
  } catch (e) {
    console.error('Failed to save config', e);
  }
};

export const useStore = create<AppState>((set, get) => ({
  projects: [],
  currentProject: localStorage.getItem('kanban-project') || '',
  tasks: [],
  archivedTasks: [],
  trashedTasks: [],
  columns: DEFAULT_COLUMNS,
  isInitialized: false,
  selectedTaskId: null,
  isCreatingNewTask: false,
  setIsCreatingNewTask: (val) => set({ isCreatingNewTask: val }),
  newTaskDefaultColumn: localStorage.getItem('kanban-new-task-column'),
  setNewTaskDefaultColumn: (val) => {
    if (val) localStorage.setItem('kanban-new-task-column', val);
    else localStorage.removeItem('kanban-new-task-column');
    set({ newTaskDefaultColumn: val });
  },
  newTaskDefaultPosition: (localStorage.getItem('kanban-new-task-position') as 'top' | 'bottom') || 'bottom',
  setNewTaskDefaultPosition: (val) => {
    localStorage.setItem('kanban-new-task-position', val);
    set({ newTaskDefaultPosition: val });
  },
  theme: (localStorage.getItem('kanban-theme') as 'light' | 'dark') || 'light',
  themeColor: '#69D94A',
  defaultSortColumn: null,
  backgroundType: 'none',
  unsplashTags: '',
  boards: [{ id: 'default', name: 'Main Board', includeTags: [], excludeTags: [] }],
  activeBoardId: 'default',
  
  pendingResolveProject: null,
  pendingResolveFiles: null,

  setPendingResolve: (project, files) => set({ pendingResolveProject: project, pendingResolveFiles: files }),

  checkProjectFolder: async (name: string, path: string) => {
    try {
      const res = await fetch('/api/projects/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, path })
      });
      const data = await res.json();
      
      await get().loadProjects();
      
      if (data.status === 'mixed' || data.status === 'invalid-only') {
        set({ pendingResolveProject: name, pendingResolveFiles: data.invalidFiles || [] });
        await get().switchProject(name);
      } else {
        await get().switchProject(name);
      }
      return data;
    } catch (e) {
      console.error('Failed to check project folder', e);
      throw e;
    }
  },

  importAndFormatFile: async (projectName: string, filename: string) => {
    try {
      const res = await fetch('/api/projects/format-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName, filename })
      });
      if (res.ok) {
        const { pendingResolveFiles } = get();
        if (pendingResolveFiles) {
          const updated = pendingResolveFiles.filter(f => f.filename !== filename);
          set({ 
            pendingResolveFiles: updated.length > 0 ? updated : null, 
            pendingResolveProject: updated.length > 0 ? get().pendingResolveProject : null 
          });
        }
        await get().loadTasks();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to format and import file', e);
      return false;
    }
  },

  loadProjects: async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.projects) {
        set({ projects: data.projects });
        const stored = localStorage.getItem('kanban-project');
        if (stored && data.projects.includes(stored)) {
          set({ currentProject: stored });
        } else if (data.projects.length > 0) {
          const first = data.projects[0];
          set({ currentProject: first });
          localStorage.setItem('kanban-project', first);
        } else {
          set({ currentProject: '' });
          localStorage.removeItem('kanban-project');
        }
      }
    } catch (e) {
      console.error('Failed to load projects', e);
    }
  },

  createProject: async (name: string, path?: string) => {
    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, path })
      });
      await get().loadProjects();
      await get().switchProject(name);
    } catch (e) {
      console.error('Failed to create project', e);
    }
  },

  renameProject: async (oldName: string, newName: string) => {
    try {
      const res = await fetch('/api/projects/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName })
      });
      if (res.ok) {
        await get().loadProjects();
        if (get().currentProject === oldName) {
          await get().switchProject(newName);
        }
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to rename project space');
      }
    } catch (e) {
      console.error('Failed to rename project', e);
      throw e;
    }
  },

  removeProject: async (name: string) => {
    try {
      const res = await fetch('/api/projects/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        await get().loadProjects();
        if (get().currentProject === name) {
          const { projects } = get();
          const fallback = projects[0] || '';
          if (fallback) {
            await get().switchProject(fallback);
          }
        }
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to remove project space');
      }
    } catch (e) {
      console.error('Failed to remove project', e);
      throw e;
    }
  },

  switchProject: async (name: string) => {
    localStorage.setItem('kanban-project', name);
    set({ currentProject: name, isInitialized: false });
    await get().loadTasks();
  },

  toggleTheme: () => {
    const newTheme = get().theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('kanban-theme', newTheme);
    set({ theme: newTheme });
    saveConfigAPI(get().columns, get().boards, get().themeColor, newTheme, get().defaultSortColumn, get().backgroundType, get().unsplashTags, get().currentProject);
  },

  setThemeColor: (color: string) => {
    set({ themeColor: color });
    saveConfigAPI(get().columns, get().boards, color, get().theme, get().defaultSortColumn, get().backgroundType, get().unsplashTags, get().currentProject);
  },

  setDefaultSortColumn: (col: string | null) => {
    set({ defaultSortColumn: col });
    saveConfigAPI(get().columns, get().boards, get().themeColor, get().theme, col, get().backgroundType, get().unsplashTags, get().currentProject);
  },

  setBackgroundType: (type: 'none' | 'bing' | 'unsplash') => {
    const { activeBoardId, boards, themeColor, theme, defaultSortColumn, unsplashTags, currentProject } = get();
    let newBoards = boards;
    if (activeBoardId) {
      newBoards = boards.map(b => b.id === activeBoardId ? { ...b, backgroundType: type } : b);
      set({ boards: newBoards });
    }
    set({ backgroundType: type });
    saveConfigAPI(get().columns, newBoards, themeColor, theme, defaultSortColumn, type, unsplashTags, currentProject);
  },

  setUnsplashTags: (tags: string) => {
    const { activeBoardId, boards, themeColor, theme, defaultSortColumn, backgroundType, currentProject } = get();
    let newBoards = boards;
    if (activeBoardId) {
      newBoards = boards.map(b => b.id === activeBoardId ? { ...b, unsplashTags: tags } : b);
      set({ boards: newBoards });
    }
    set({ unsplashTags: tags });
    saveConfigAPI(get().columns, newBoards, themeColor, theme, defaultSortColumn, backgroundType, tags, currentProject);
  },

  initializeEventSource: () => {
    if (get().isInitialized) return;
    
    const es = new EventSource('/api/events');
    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const isCurrentProject = data.payload?.project === get().currentProject;
      if (!isCurrentProject) return;

      if ((data.type === 'file_added' || data.type === 'file_changed') && data.payload.filename.endsWith('.md')) {
        // Here we parse incoming files
        const incomingTask = parseMarkdownText(data.payload.filename, data.payload.content);
        const isArchived = data.payload.archived === true;
        const isTrashed = data.payload.trashed === true;
        
        if (isArchived) {
          (incomingTask as any).archived = true;
        }
        if (isTrashed) {
          (incomingTask as any).trashed = true;
        }

        const { tasks, archivedTasks, trashedTasks } = get();
        
        if (isTrashed) {
          const filteredActive = tasks.filter(t => t.id !== incomingTask.id);
          const filteredArchived = archivedTasks.filter(t => t.id !== incomingTask.id);
          const trashedIdx = trashedTasks.findIndex(t => t.id === incomingTask.id);
          
          if (trashedIdx !== -1) {
             const existing = trashedTasks[trashedIdx];
             const localContent = normalizeMarkdown(existing.content);
             const remoteContent = normalizeMarkdown(incomingTask.content);
             const localTitle = (existing.title || '').trim();
             const remoteTitle = (incomingTask.title || '').trim();
             
             const isLocalFallback = (localTitle === existing.id.replace('.md', '')) || 
                                     (localTitle === 'New Task' && (localContent === 'task description...' || !localContent || localContent === ''));

             if (isLocalFallback) {
                const newTrashed = [...trashedTasks];
                newTrashed[trashedIdx] = incomingTask;
                set({ tasks: filteredActive, archivedTasks: filteredArchived, trashedTasks: newTrashed });
             } else if (localContent !== remoteContent || localTitle !== remoteTitle || JSON.stringify(existing.tags) !== JSON.stringify(incomingTask.tags)) {
                const newTrashed = [...trashedTasks];
                newTrashed[trashedIdx] = { ...existing, pendingExternalChanges: incomingTask };
                set({ tasks: filteredActive, archivedTasks: filteredArchived, trashedTasks: newTrashed });
             }
          } else {
             set({ 
               tasks: filteredActive, 
               archivedTasks: filteredArchived,
               trashedTasks: [...trashedTasks, incomingTask].sort((a, b) => (a.order || 0) - (b.order || 0)) 
             });
          }
        } else if (isArchived) {
          const filteredActive = tasks.filter(t => t.id !== incomingTask.id);
          const filteredTrashed = trashedTasks.filter(t => t.id !== incomingTask.id);
          const archivedIdx = archivedTasks.findIndex(t => t.id === incomingTask.id);
          
          if (archivedIdx !== -1) {
             const existing = archivedTasks[archivedIdx];
             const localContent = normalizeMarkdown(existing.content);
             const remoteContent = normalizeMarkdown(incomingTask.content);
             const localTitle = (existing.title || '').trim();
             const remoteTitle = (incomingTask.title || '').trim();
             
             const isLocalFallback = (localTitle === existing.id.replace('.md', '')) || 
                                     (localTitle === 'New Task' && (localContent === 'task description...' || !localContent || localContent === ''));

             if (isLocalFallback) {
                const newArchived = [...archivedTasks];
                newArchived[archivedIdx] = incomingTask;
                set({ tasks: filteredActive, trashedTasks: filteredTrashed, archivedTasks: newArchived });
             } else if (localContent !== remoteContent || localTitle !== remoteTitle || JSON.stringify(existing.tags) !== JSON.stringify(incomingTask.tags)) {
                const newArchived = [...archivedTasks];
                newArchived[archivedIdx] = { ...existing, pendingExternalChanges: incomingTask };
                set({ tasks: filteredActive, trashedTasks: filteredTrashed, archivedTasks: newArchived });
             }
          } else {
             set({ 
               tasks: filteredActive, 
               trashedTasks: filteredTrashed,
               archivedTasks: [...archivedTasks, incomingTask].sort((a, b) => (a.order || 0) - (b.order || 0)) 
             });
          }
        } else {
          const filteredArchived = archivedTasks.filter(t => t.id !== incomingTask.id);
          const filteredTrashed = trashedTasks.filter(t => t.id !== incomingTask.id);
          const existingIdx = tasks.findIndex(t => t.id === incomingTask.id);
          
          if (existingIdx !== -1) {
             const existing = tasks[existingIdx];
             const localContent = normalizeMarkdown(existing.content);
             const remoteContent = normalizeMarkdown(incomingTask.content);
             const localTitle = (existing.title || '').trim();
             const remoteTitle = (incomingTask.title || '').trim();
             const localStatus = existing.status;
             const remoteStatus = incomingTask.status;

             const isLocalFallback = (localTitle === existing.id.replace('.md', '')) || 
                                     (localTitle === 'New Task' && (localContent === 'task description...' || !localContent || localContent === ''));

             if (isLocalFallback) {
                const newTasks = [...tasks];
                newTasks[existingIdx] = incomingTask;
                set({ tasks: newTasks, archivedTasks: filteredArchived, trashedTasks: filteredTrashed });
             } else if (localContent !== remoteContent || localTitle !== remoteTitle || localStatus !== remoteStatus || JSON.stringify(existing.tags) !== JSON.stringify(incomingTask.tags)) {
                const newTasks = [...tasks];
                newTasks[existingIdx] = { ...existing, pendingExternalChanges: incomingTask };
                set({ tasks: newTasks, archivedTasks: filteredArchived, trashedTasks: filteredTrashed });
             }
          } else {
             set({ 
               archivedTasks: filteredArchived,
               trashedTasks: filteredTrashed,
               tasks: [...tasks, incomingTask].sort((a, b) => (a.order || 0) - (b.order || 0)) 
             });
          }
        }
      } else if (data.type === 'file_deleted' && data.payload.filename.endsWith('.md')) {
        const { tasks, archivedTasks, trashedTasks } = get();
        set({ 
          tasks: tasks.filter(t => t.id !== data.payload.filename),
          archivedTasks: archivedTasks.filter(t => t.id !== data.payload.filename),
          trashedTasks: trashedTasks.filter(t => t.id !== data.payload.filename)
        });
      } else if ((data.type === 'file_added' || data.type === 'file_changed') && data.payload.filename === '.kanban-config.json') {
          try {
             const configData = JSON.parse(data.payload.content);
             if (Array.isArray(configData)) {
                set({ columns: configData.sort((a: any, b: any) => a.order - b.order) });
             } else if (configData && typeof configData === 'object') {
                const cols = configData.columns || [];
                const tc = configData.themeColor;
                const tm = configData.theme;
                const dsc = configData.defaultSortColumn;
                const bgType = configData.backgroundType;
                const uTags = configData.unsplashTags;
                const bds = configData.boards;
                const updates: Partial<AppState> = {
                  columns: cols.sort((a: any, b: any) => a.order - b.order)
                };
                if (tc) updates.themeColor = tc;
                if (tm) updates.theme = tm;
                if (dsc !== undefined) updates.defaultSortColumn = dsc;
                if (bgType) updates.backgroundType = bgType;
                if (uTags !== undefined) updates.unsplashTags = uTags;
                if (bds && Array.isArray(bds) && bds.length > 0) {
                  updates.boards = bds.map((b: any) => ({ ...b, columns: b.columns || cols }));
                  const { activeBoardId } = get();
                  const activeBoard = updates.boards.find((b: any) => b.id === activeBoardId);
                  
                  if (!activeBoard) {
                    updates.activeBoardId = bds[0].id;
                    updates.columns = updates.boards[0].columns;
                    if (updates.boards[0].backgroundType !== undefined) updates.backgroundType = updates.boards[0].backgroundType;
                    if (updates.boards[0].unsplashTags !== undefined) updates.unsplashTags = updates.boards[0].unsplashTags;
                  } else {
                    updates.columns = activeBoard.columns;
                    if (activeBoard.backgroundType !== undefined) updates.backgroundType = activeBoard.backgroundType;
                    if (activeBoard.unsplashTags !== undefined) updates.unsplashTags = activeBoard.unsplashTags;
                  }
                }
                set(updates);
             }
          } catch(e) {}
      }
    };
    
    setTimeout(() => {
      set({ isInitialized: true });
    }, 150);
  },
  
  loadTasks: async () => {
    try {
      const response = await fetch(`/api/tasks?project=${encodeURIComponent(get().currentProject)}`);
      const data = await response.json();
      
      if (!response.ok || !data.tasks) {
        throw new Error(data.error || 'Invalid API response');
      }
      
      let loadedColumns = DEFAULT_COLUMNS;
      let loadedThemeColor: string | null = null;
      let loadedTheme = get().theme;
      let loadedDefaultSortColumn = get().defaultSortColumn;
      let loadedBackgroundType = get().backgroundType;
      let loadedUnsplashTags = get().unsplashTags;
      let loadedBoards: BoardConfig[] = [{ id: 'default', name: 'Main Board', includeTags: [], excludeTags: [], columns: loadedColumns }];
      
      let configNeedsSave = false;
      
      if (data.config) {
        if (Array.isArray(data.config)) {
          loadedColumns = data.config;
          configNeedsSave = true;
        } else if (typeof data.config === 'object') {
          loadedColumns = data.config.columns || DEFAULT_COLUMNS;
          if (data.config.themeColor) {
            loadedThemeColor = data.config.themeColor;
          }
          if (data.config.theme) {
            loadedTheme = data.config.theme;
          }
          if (data.config.defaultSortColumn !== undefined) {
            loadedDefaultSortColumn = data.config.defaultSortColumn;
          }
          if (data.config.backgroundType) {
            loadedBackgroundType = data.config.backgroundType;
          }
          if (data.config.unsplashTags !== undefined) {
            loadedUnsplashTags = data.config.unsplashTags;
          }
          if (data.config.boards && Array.isArray(data.config.boards) && data.config.boards.length > 0) {
            loadedBoards = data.config.boards.map(b => ({
              ...b,
              columns: b.columns || loadedColumns
            }));
          }
        }
      } else {
        configNeedsSave = true;
      }
      
      if (!loadedThemeColor) {
        const h = Math.floor(Math.random() * 360);
        const s = 65;
        const l = 57;
        const a = s * Math.min(l / 100, 1 - l / 100) / 100;
        const f = (n: number) => {
          const k = (n + h / 30) % 12;
          const color = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
          return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        loadedThemeColor = `#${f(0)}${f(8)}${f(4)}`;
        configNeedsSave = true;
      }
      
      loadedColumns = [...loadedColumns].sort((a: any, b: any) => a.order - b.order);
      
      const tasks: Task[] = [];
      const archived: Task[] = [];
      const trashed: Task[] = [];
      
      for (const file of data.tasks) {
         if (file.filename.endsWith('.md')) {
            const task = parseMarkdownText(file.filename, file.content);
            if (file.archived) {
              (task as any).archived = true;
            }
            if (file.trashed) {
              (task as any).trashed = true;
            }
            if ((task as any).trashed) {
              trashed.push(task);
            } else if ((task as any).archived) {
              archived.push(task);
            } else {
              tasks.push(task);
            }
         }
      }
      
      set(state => {
        const activeBoardId = loadedBoards.some(b => b.id === state.activeBoardId) ? state.activeBoardId : loadedBoards[0].id;
        const activeBoard = loadedBoards.find(b => b.id === activeBoardId);
        return {
          columns: activeBoard?.columns || loadedColumns,
          boards: loadedBoards,
          activeBoardId,
          themeColor: loadedThemeColor!,
          theme: loadedTheme,
          defaultSortColumn: loadedDefaultSortColumn,
          backgroundType: activeBoard?.backgroundType !== undefined ? activeBoard.backgroundType : loadedBackgroundType,
          unsplashTags: activeBoard?.unsplashTags !== undefined ? activeBoard.unsplashTags : loadedUnsplashTags,
          tasks: tasks.sort((a, b) => (a.order || 0) - (b.order || 0)), 
          archivedTasks: archived.sort((a, b) => (a.order || 0) - (b.order || 0)),
          trashedTasks: trashed.sort((a, b) => (a.order || 0) - (b.order || 0)) 
        };
      });
      
      if (configNeedsSave && get().currentProject) {
        saveConfigAPI(loadedColumns, loadedBoards, loadedThemeColor!, loadedTheme, loadedDefaultSortColumn, loadedBackgroundType, loadedUnsplashTags, get().currentProject);
      }
      
      get().initializeEventSource();
    } catch (e) {
      console.error('Failed to load tasks', e);
    }
  },
  
  resolvePendingChanges: async (id, action) => {
    const { tasks } = get();
    const taskIdx = tasks.findIndex(t => t.id === id);
    if (taskIdx === -1) return;
    
    const task = tasks[taskIdx];
    if (!task.pendingExternalChanges) return;
    
    if (action === 'accept') {
        const updatedTask = { ...task.pendingExternalChanges };
        delete updatedTask.pendingExternalChanges; // remove the flag
        
        const newTasks = [...tasks];
        newTasks[taskIdx] = updatedTask;
        set({ tasks: newTasks });
    } else {
        const restoredTask = { ...task };
        delete restoredTask.pendingExternalChanges;
        
        // Write the local state back to the file system (overriding the agent's work)
        await writeMarkdownAPI(restoredTask, get().currentProject);
        
        const newTasks = [...tasks];
        newTasks[taskIdx] = restoredTask;
        set({ tasks: newTasks });
    }
  },

  addColumn: async (title, color) => {
    const { columns, boards, themeColor, theme, defaultSortColumn, backgroundType, unsplashTags, currentProject, activeBoardId } = get();
    const newColumn: ColumnDef = {
      id: title, // Use title as ID for simplicity
      title,
      color,
      size: 'medium',
      order: columns.length > 0 ? columns[columns.length - 1].order + 1 : 0
    };
    const newColumns = [...columns, newColumn];
    const newBoards = boards.map(b => b.id === activeBoardId ? { ...b, columns: newColumns } : b);
    set({ columns: newColumns, boards: newBoards });
    await saveConfigAPI(newColumns, newBoards, themeColor, theme, defaultSortColumn, backgroundType, unsplashTags, currentProject);
  },

  updateColumn: async (id, updates) => {
    const { columns, boards, themeColor, theme, defaultSortColumn, backgroundType, unsplashTags, currentProject, activeBoardId } = get();
    const newColumns = columns.map(c => c.id === id ? { ...c, ...updates } : c);
    const newBoards = boards.map(b => b.id === activeBoardId ? { ...b, columns: newColumns } : b);
    set({ columns: newColumns, boards: newBoards });
    await saveConfigAPI(newColumns, newBoards, themeColor, theme, defaultSortColumn, backgroundType, unsplashTags, currentProject);
  },

  setActiveBoardId: (id) => {
    const { boards, columns, backgroundType, unsplashTags } = get();
    const board = boards.find(b => b.id === id);
    if (board) {
      set({ 
        activeBoardId: id, 
        columns: board.columns || columns,
        backgroundType: board.backgroundType !== undefined ? board.backgroundType : backgroundType,
        unsplashTags: board.unsplashTags !== undefined ? board.unsplashTags : unsplashTags
      });
    } else {
      set({ activeBoardId: id });
    }
  },

  createBoard: async (board) => {
    const { boards, columns, themeColor, theme, defaultSortColumn, backgroundType, unsplashTags, currentProject } = get();
    const newBoard = { ...board, id: Date.now().toString(), columns: columns };
    const newBoards = [...boards, newBoard];
    set({ boards: newBoards, activeBoardId: newBoard.id, columns: newBoard.columns });
    await saveConfigAPI(columns, newBoards, themeColor, theme, defaultSortColumn, backgroundType, unsplashTags, currentProject);
  },

  updateBoard: async (id, updates) => {
    const { boards, columns, themeColor, theme, defaultSortColumn, backgroundType, unsplashTags, currentProject, activeBoardId } = get();
    const newBoards = boards.map(b => b.id === id ? { ...b, ...updates } : b);
    set({ boards: newBoards });
    if (id === activeBoardId && updates.columns) {
      set({ columns: updates.columns });
    }
    await saveConfigAPI(columns, newBoards, themeColor, theme, defaultSortColumn, backgroundType, unsplashTags, currentProject);
  },

  deleteBoard: async (id) => {
    const { boards, themeColor, theme, defaultSortColumn, backgroundType, unsplashTags, currentProject, activeBoardId } = get();
    if (boards.length <= 1) return; // Cannot delete the last board
    const newBoards = boards.filter(b => b.id !== id);
    const newActiveId = activeBoardId === id ? newBoards[0].id : activeBoardId;
    const newColumns = newBoards.find(b => b.id === newActiveId)?.columns || [];
    set({ boards: newBoards, activeBoardId: newActiveId, columns: newColumns });
    await saveConfigAPI(newColumns, newBoards, themeColor, theme, defaultSortColumn, backgroundType, unsplashTags, currentProject);
  },

  deleteColumn: async (id) => {
    const { columns, themeColor, theme, defaultSortColumn, backgroundType, unsplashTags, currentProject, boards, tasks, updateTask, activeBoardId } = get();
    const newColumns = columns.filter(c => c.id !== id);
    const newBoards = boards.map(b => b.id === activeBoardId ? { ...b, columns: newColumns } : b);
    set({ columns: newColumns, boards: newBoards });
    await saveConfigAPI(newColumns, newBoards, themeColor, theme, defaultSortColumn, backgroundType, unsplashTags, currentProject);

    // Find all tasks in this column and move them to unsorted
    const tasksInColumn = tasks.filter(t => t.status === id);
    for (const task of tasksInColumn) {
      await updateTask(task.id, { 
        status: undefined, 
        tags: [...(task.tags || []), 'unsorted'].filter((v, i, a) => a.indexOf(v) === i)
      });
    }
  },

  createTask: async (title = "New Task", incomingStatus?: string) => {
    const { loadTasks, setSelectedTaskId, defaultSortColumn, columns, newTaskDefaultColumn, newTaskDefaultPosition, tasks, setIsCreatingNewTask } = get();
    
    let status = incomingStatus;
    if (!status) {
      if (newTaskDefaultColumn && columns.some(c => c.id === newTaskDefaultColumn)) {
        status = newTaskDefaultColumn;
      } else if (defaultSortColumn) {
        status = defaultSortColumn;
      } else if (columns.length > 0) {
        status = columns[0].id;
      } else {
        status = "To Do"; // Fallback
      }
    }

    const tasksInColumn = tasks.filter(t => t.status === status);
    let order = Date.now();
    
    if (tasksInColumn.length > 0) {
      if (newTaskDefaultPosition === 'top') {
        const minOrder = Math.min(...tasksInColumn.map(t => t.order || 0));
        order = minOrder - 1000;
      } else {
        const maxOrder = Math.max(...tasksInColumn.map(t => t.order || 0));
        order = maxOrder + 1000;
      }
    }

    const id = `task-${Date.now()}.md`;
    
    const initialData = {
      title,
      status,
      tags: [],
      order
    };
    
    const newContent = matter.stringify("", initialData);
    
    await fetch(`/api/tasks/${id}?project=${encodeURIComponent(get().currentProject)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent })
    });
    
    await loadTasks();
    setIsCreatingNewTask(true);
    setSelectedTaskId(id);
  },

  updateTask: async (id, updates) => {
    const { tasks, archivedTasks, trashedTasks } = get();
    
    let taskToSave: Task | null = null;
    
    const updatedTasks = tasks.map(t => {
      if (t.id === id) {
        const updated = { ...t, ...updates };
        taskToSave = updated;
        return updated;
      }
      return t;
    }).sort((a, b) => (a.order || 0) - (b.order || 0));

    const updatedArchivedTasks = archivedTasks.map(t => {
      if (t.id === id) {
        const updated = { ...t, ...updates };
        taskToSave = updated;
        return updated;
      }
      return t;
    }).sort((a, b) => (a.order || 0) - (b.order || 0));

    const updatedTrashedTasks = trashedTasks.map(t => {
      if (t.id === id) {
        const updated = { ...t, ...updates };
        taskToSave = updated;
        return updated;
      }
      return t;
    }).sort((a, b) => (a.order || 0) - (b.order || 0));

    // Optimistically and synchronously update local store immediately
    set({
      tasks: updatedTasks,
      archivedTasks: updatedArchivedTasks,
      trashedTasks: updatedTrashedTasks
    });

    if (taskToSave) {
      try {
        await writeMarkdownAPI(taskToSave, get().currentProject);
      } catch (e) {
        console.error('Failed to write markdown for task:', id, e);
      }
    }
  },
  
  moveTask: async (id, newStatus) => {
    const { tasks } = get();
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    const maxOrderInNewStatus = tasks
      .filter(t => t.status === newStatus)
      .reduce((max, t) => Math.max(max, t.order || 0), 0);
      
    let updatedTags = task.tags || [];
    if (newStatus === "Unsorted" && !updatedTags.includes("unsorted")) {
      updatedTags = [...updatedTags, "unsorted"];
    } else if (newStatus !== "Unsorted" && updatedTags.includes("unsorted")) {
      updatedTags = updatedTags.filter(t => t !== "unsorted");
    }

    const finalStatus = newStatus === "Unsorted" ? undefined : newStatus;
    const updated = { ...task, status: finalStatus as any, order: maxOrderInNewStatus + 1000, tags: updatedTags };
    await writeMarkdownAPI(updated, get().currentProject);
    
    const newTasks = tasks.map(t => t.id === id ? updated : t);
    set({
      tasks: newTasks.sort((a, b) => (a.order || 0) - (b.order || 0))
    });
  },
  
  reorderTask: async (id, overId, overColumn) => {
    const { tasks } = get();
    const activeTask = tasks.find(t => t.id === id);
    const overTask = overId ? tasks.find(t => t.id === overId) : undefined;
    
    if (!activeTask) return;
    
    let newTasks = [...tasks];
    let newOrder = activeTask.order;
    
    if (overTask && activeTask.id !== overTask.id) {
      // Reorder relative to overTask
      const columnTasks = newTasks.filter(t => t.status === overColumn);
      const activeIndex = columnTasks.findIndex(t => t.id === id);
      const overIndex = columnTasks.findIndex(t => t.id === overId);
      
      if (overIndex === 0) {
        newOrder = (columnTasks[0].order || 0) - 1000;
      } else if (overIndex === columnTasks.length - 1) {
        newOrder = (columnTasks[columnTasks.length - 1].order || 0) + 1000;
      } else if (overIndex !== -1) {
        // If sorting within the same column and active is before over:
        const prevOrder = columnTasks[overIndex <= activeIndex || activeIndex === -1 ? overIndex - 1 : overIndex].order || 0;
        const nextOrder = columnTasks[overIndex <= activeIndex || activeIndex === -1 ? overIndex : overIndex + 1].order || 0;
        newOrder = (prevOrder + nextOrder) / 2;
      }
    } else if (!overTask) {
      // Dropped on an empty column or at the end
      const columnTasks = newTasks.filter(t => t.status === overColumn);
      // Remove activeTask from columnTasks if it's there and we dropped at the end
      const otherTasks = columnTasks.filter(t => t.id !== id);
      if (otherTasks.length > 0) {
        newOrder = (otherTasks[otherTasks.length - 1].order || 0) + 1000;
      }
    }
    
    let updatedTags = activeTask.tags || [];
    if (overColumn === "Unsorted" && !updatedTags.includes("unsorted")) {
      updatedTags = [...updatedTags, "unsorted"];
    } else if (overColumn !== "Unsorted" && updatedTags.includes("unsorted")) {
      updatedTags = updatedTags.filter(t => t !== "unsorted");
    }

    const finalStatus = overColumn === "Unsorted" ? undefined : overColumn;
    const updated = { ...activeTask, status: finalStatus as any, order: newOrder, tags: updatedTags };
    newTasks = newTasks.map(t => t.id === id ? updated : t);
    
    set({ tasks: newTasks.sort((a, b) => (a.order || 0) - (b.order || 0)) });
    writeMarkdownAPI(updated, get().currentProject).catch(console.error);
  },
  
  archiveTask: async (id) => {
    const { tasks, archivedTasks } = get();
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    const updated = { ...task, archived: true } as any;
    
    set({
      tasks: tasks.filter(t => t.id !== id),
      archivedTasks: [...archivedTasks, updated]
    });
    
    await writeMarkdownAPI(updated, get().currentProject);
  },
  
  unarchiveTask: async (id) => {
    const { tasks, archivedTasks } = get();
    const task = archivedTasks.find(t => t.id === id);
    if (!task) return;
    
    const updated = { ...task };
    delete (updated as any).archived;
    
    set({
      archivedTasks: archivedTasks.filter(t => t.id !== id),
      tasks: [...tasks, updated]
    });
    
    await writeMarkdownAPI(updated, get().currentProject);
  },

  trashTask: async (id) => {
    const { tasks, archivedTasks, trashedTasks } = get();
    const task = tasks.find(t => t.id === id) || archivedTasks.find(t => t.id === id);
    if (!task) return;
    
    const updated = { ...task, trashed: true } as any;
    delete updated.archived;
    
    set({
      tasks: tasks.filter(t => t.id !== id),
      archivedTasks: archivedTasks.filter(t => t.id !== id),
      trashedTasks: [...trashedTasks, updated]
    });
    
    await writeMarkdownAPI(updated, get().currentProject);
  },
  
  untrashTask: async (id) => {
    const { tasks, trashedTasks } = get();
    const task = trashedTasks.find(t => t.id === id);
    if (!task) return;
    
    const updated = { ...task };
    delete (updated as any).trashed;
    
    set({
      trashedTasks: trashedTasks.filter(t => t.id !== id),
      tasks: [...tasks, updated]
    });
    
    await writeMarkdownAPI(updated, get().currentProject);
  },

  deleteTask: async (id) => {
    const { tasks, archivedTasks, trashedTasks, selectedTaskId } = get();
    
    try {
      await fetch(`/api/tasks/${id}?project=${encodeURIComponent(get().currentProject)}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.error('Failed to delete task', e);
    }
    
    set({
      tasks: tasks.filter(t => t.id !== id),
      archivedTasks: archivedTasks.filter(t => t.id !== id),
      trashedTasks: trashedTasks.filter(t => t.id !== id),
      selectedTaskId: selectedTaskId === id ? null : selectedTaskId
    });
  },
  
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
}));
