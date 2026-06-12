import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { 
  FolderPlus, 
  FolderOpen, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function InitializeWorkspace() {
  const { checkProjectFolder, theme, toggleTheme } = useStore();
  const [projectName, setProjectName] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAskExample, setShowAskExample] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string; } | null>(null);

  const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;

  useEffect(() => {
    setFolderPath(isElectron ? '' : '/data/MyProject');
  }, [isElectron]);

  useEffect(() => {
    if (projectName.trim() || folderPath.trim()) {
      setShowAskExample(false);
    }
  }, [projectName, folderPath]);

  const handleSelectDirectory = async () => {
    if (isElectron && (window as any).electronAPI?.selectDirectory) {
      try {
        const path = await (window as any).electronAPI.selectDirectory();
        if (path) {
          setFolderPath(path);
          const folderName = path.split(/[/\\]/).pop() || 'New Project';
          if (!projectName) {
            setProjectName(folderName);
          }
        }
      } catch (err: any) {
        console.error('Electron directory selection error', err);
        setFeedback({
          type: 'error',
          message: `Failed to open directory dialogue: ${err?.message || err}`
        });
      }
    }
  };

  const handleCreateExample = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const result = await checkProjectFolder('Example Workspace', '/data/ExampleWorkspace');
      if (result.status === 'empty' || result.status === 'valid-only') {
        setFeedback({
          type: 'success',
          message: `Created example workspace successfully!`
        });
      }
    } catch (err: any) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: 'Could not create example workspace.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (showAskExample) {
      await handleCreateExample();
      return;
    }

    if (!projectName.trim() || !folderPath.trim()) {
      setShowAskExample(true);
      setFeedback(null);
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      // checkProjectFolder also handles loading & registering projects
      const result = await checkProjectFolder(projectName.trim(), folderPath.trim());
      
      if (result.status === 'empty') {
        setFeedback({
          type: 'success',
          message: `Successfully connected! Created standard Kanban Markdown task card configurations in: "${projectName}".`
        });
      } else if (result.status === 'valid-only') {
        setFeedback({
          type: 'success',
          message: `Project space "${projectName}" recognized! Successfully imported standard Markdown layout.`
        });
      }
    } catch (err: any) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: 'Could not connect to directory. Ensure the directory is read/writeable.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-950 font-sans p-6 relative overflow-hidden transition-colors" style={{ backgroundColor: 'var(--m-surface)' }}>
      {/* Background Gradients */}
      <div className="absolute top-[10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-40 dark:opacity-25" style={{ backgroundColor: 'var(--col-1-bg-mesh)' }} />
      <div className="absolute bottom-[10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-40 dark:opacity-25" style={{ backgroundColor: 'var(--col-4-bg-mesh)' }} />

      {/* Theme toggle bar */}
      <div className="absolute top-4 right-4 z-20">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={toggleTheme} 
          className="text-slate-600 dark:text-slate-400 bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 backdrop-blur-md rounded-full shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
        </Button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-lg bg-white/75 dark:bg-slate-900/75 backdrop-blur-2xl border border-white/40 dark:border-slate-800/80 rounded-2xl shadow-xl p-8 relative z-10"
      >
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 bg-indigo-500/10 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center border border-indigo-500/15 mb-4 animate-bounce">
            <FolderPlus className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
            Welcome to Markdown Kanban
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
            Your workspace task cards are stored safely as simple, human-readable <span className="font-semibold text-slate-700 dark:text-slate-300">Markdown (.md) files</span>. Let's link a directory to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider" htmlFor="initFolderInput">
              1. Local target folder path
            </label>
            <div className="flex gap-2.5">
              <Input 
                id="initFolderInput"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder={isElectron ? "Select folder storage location..." : "/data/MyKanbanBoard"}
                disabled={isLoading}
                className="bg-slate-50/50 dark:bg-slate-950/50 border-slate-200/80 dark:border-slate-800 focus:border-indigo-500 font-mono text-xs h-11 w-full rounded-xl shadow-inner"
              />
              {isElectron && (
                <Button
                  type="button"
                  onClick={handleSelectDirectory}
                  disabled={isLoading}
                  variant="outline"
                  className="shrink-0 h-11 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 flex gap-2 text-xs text-slate-700 dark:text-slate-300 rounded-xl"
                >
                  <FolderOpen className="w-4 h-4" />
                  Browse
                </Button>
              )}
            </div>
            {!isElectron && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 italic mt-1 leading-normal">
                Web Demo Path: Enter any path. The application will track, save, and serve standard Markdown documents there.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider" htmlFor="initProjectInput">
              2. Project Space Name
            </label>
            <Input 
              id="initProjectInput"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. My Workspace Board"
              disabled={isLoading}
              className="bg-slate-50/50 dark:bg-slate-950/50 border-slate-200/80 dark:border-slate-800 focus:border-indigo-500 h-11 text-sm rounded-xl shadow-inner"
            />
          </div>

          <AnimatePresence mode="wait">
            {feedback && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`p-3.5 rounded-xl border text-xs gap-2.5 flex items-start ${
                  feedback.type === 'success' 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4.5 h-4.5 shrink-0 stroke-2 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-4.5 h-4.5 shrink-0 stroke-2 text-rose-500" />
                )}
                <span className="leading-relaxed font-medium">{feedback.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <Button 
            type="submit"
            disabled={isLoading}
            className={`w-full font-medium text-sm py-5 h-12 shadow-lg hover:scale-[1.01] active:scale-[0.99] rounded-xl flex items-center justify-center gap-2 transition-all mt-4 ${
              showAskExample
                ? 'bg-amber-500 hover:bg-amber-400 dark:bg-amber-600 dark:hover:bg-amber-500 text-white hover:shadow-amber-500/15'
                : 'bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white hover:shadow-indigo-500/15'
            }`}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={showAskExample ? 'example' : 'init'}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-center gap-2"
              >
                {isLoading ? 'Checking and mapping...' : showAskExample ? 'Create Example Workspace?' : 'Initialize & Connect Workspace'}
                <ArrowRight className="w-4 h-4" />
              </motion.span>
            </AnimatePresence>
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
