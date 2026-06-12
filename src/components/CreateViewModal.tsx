import { useState } from 'react';
import { useStore } from '../store';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X, LayoutTemplate } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CreateViewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateViewModal({ isOpen, onClose }: CreateViewModalProps) {
  const { createBoard } = useStore();
  const [name, setName] = useState('');
  const [includeTags, setIncludeTags] = useState('');
  const [excludeTags, setExcludeTags] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    await createBoard({
      name: name.trim(),
      includeTags: includeTags.split(',').map(t => t.trim()).filter(Boolean),
      excludeTags: excludeTags.split(',').map(t => t.trim()).filter(Boolean)
    });
    
    setName('');
    setIncludeTags('');
    setExcludeTags('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm dark:bg-slate-900/60">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-indigo-500/10 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-sm">
                <LayoutTemplate className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-800 dark:text-slate-100">Create New View</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Filter tasks by specific tags</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">View Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Bugs Only"
                className="bg-white dark:bg-slate-950 focus-visible:ring-indigo-500"
                autoFocus
                required
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Include Tags</label>
              <Input
                value={includeTags}
                onChange={(e) => setIncludeTags(e.target.value)}
                placeholder="Ex: BUG, URGENT (comma separated)"
                className="bg-white dark:bg-slate-950 focus-visible:ring-indigo-500"
              />
              <p className="text-[10px] text-slate-500">Only show tasks containing at least one of these tags.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Exclude Tags</label>
              <Input
                value={excludeTags}
                onChange={(e) => setExcludeTags(e.target.value)}
                placeholder="Ex: RESOLVED (comma separated)"
                className="bg-white dark:bg-slate-950 focus-visible:ring-indigo-500"
              />
              <p className="text-[10px] text-slate-500">Hide tasks containing any of these tags.</p>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} className="text-slate-600 dark:text-slate-400">
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                Create View
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
