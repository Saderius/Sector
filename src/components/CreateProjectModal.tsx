import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { 
  X, 
  FolderPlus, 
  FolderOpen, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  AlertTriangle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const { checkProjectFolder } = useStore();
  const [projectName, setProjectName] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;

  useEffect(() => {
    if (isOpen) {
      setProjectName('');
      setFolderPath(isElectron ? '' : '/data/MyProject');
      setFeedback(null);
    }
  }, [isOpen, isElectron]);

  const handleSelectDirectory = async () => {
    if (isElectron && (window as any).electronAPI?.selectDirectory) {
      try {
        const path = await (window as any).electronAPI.selectDirectory();
        if (path) {
          setFolderPath(path);
          // Suggest name from the folder segment
          const folderName = path.split(/[/\\]/).pop() || 'New Project';
          if (!projectName) {
            setProjectName(folderName);
          }
        }
      } catch (err: any) {
        console.error('Electron directory selection error', err);
        setFeedback({
          type: 'error',
          message: `Failed to open file dialogue: ${err?.message || err}`
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setFeedback({ type: 'error', message: 'Please enter a project space name.' });
      return;
    }
    if (!folderPath.trim()) {
      setFeedback({ type: 'error', message: 'Please provide a workspace directory path.' });
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      const result = await checkProjectFolder(projectName.trim(), folderPath.trim());
      
      if (result.status === 'empty') {
        setFeedback({
          type: 'success',
          message: `Connected successfully! Created demo Markdown tasks and config files in: "${projectName}".`
        });
        setTimeout(() => {
          onClose();
        }, 3000);
      } else if (result.status === 'valid-only') {
        setFeedback({
          type: 'success',
          message: `Project space "${projectName}" imported! Standard Markdown task templates detected.`
        });
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        // Mixed or invalid: formatted files are imported, but conflict resolver will trigger
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: `Could not initialize project directory check. Make sure server is reachable & directory is read/writeable.`
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 font-sans text-slate-900 dark:text-slate-100"
          id="create-project-modal"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-blue-500/10 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-500/15">
                <FolderPlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-md font-bold tracking-tight">Create/Import Workspace Space</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Map a directory to back up task card Markdown files</p>
              </div>
            </div>
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose} 
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 rounded-full w-8 h-8"
              id="close-modal"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Folder Selection block */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400" htmlFor="folderPathInput">
                Workspace Target Directory
              </label>
              
              <div className="flex gap-2">
                <Input 
                  id="folderPathInput"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  placeholder={isElectron ? "Select a direct folder path..." : "/data/MyCustomWorkspace"}
                  disabled={isLoading}
                  className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-mono text-xs h-10 w-full"
                />
                
                {isElectron ? (
                  <Button
                    type="button"
                    onClick={handleSelectDirectory}
                    disabled={isLoading}
                    variant="outline"
                    className="shrink-0 h-10 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 flex gap-1.5 text-xs text-slate-700 dark:text-slate-300"
                    id="select-directory-btn"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Browse
                  </Button>
                ) : null}
              </div>
              {!isElectron && (
                <p className="text-[10px] text-slate-500 leading-normal flex gap-1 items-start mt-1">
                  <span className="shrink-0 text-amber-500 font-bold uppercase select-none">Web Demo Mode:</span>
                  Enter any path. Files will sync with standard server-side storage inside the environment.
                </p>
              )}
            </div>

            {/* Name input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400" htmlFor="projectNameInput">
                Project Space / Tab Name
              </label>
              <Input 
                id="projectNameInput"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. My Sprint Tasks"
                disabled={isLoading}
                className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:border-blue-500 text-sm h-10"
              />
            </div>

            {/* Dynamic Status / Feedback Logs */}
            <AnimatePresence mode="wait">
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`p-3 rounded-xl border text-xs gap-2 flex items-start ${
                    feedback.type === 'success' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                  }`}
                  id="modal-feedback"
                >
                  {feedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 stroke-2 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 stroke-2 text-rose-500" />
                  )}
                  <span className="leading-relaxed">{feedback.message}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <Button 
                type="button"
                variant="ghost" 
                onClick={onClose}
                disabled={isLoading}
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 text-xs"
                id="modal-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-medium text-xs gap-1 py-4 px-4 h-9 shadow-md rounded-lg"
                id="modal-submit"
              >
                {isLoading ? 'Cheking workspace...' : 'Check & Import'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
