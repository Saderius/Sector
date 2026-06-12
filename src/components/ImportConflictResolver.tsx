import { useState } from 'react';
import { useStore } from '../store';
import { Button } from './ui/button';
import { FileWarning, CheckCircle, FileText, Sparkles, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function ImportConflictResolver() {
  const { 
    pendingResolveProject, 
    pendingResolveFiles, 
    setPendingResolve, 
    importAndFormatFile 
  } = useStore();

  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [isFormattingAll, setIsFormattingAll] = useState(false);

  if (!pendingResolveProject || !pendingResolveFiles || pendingResolveFiles.length === 0) {
    return null;
  }

  const selectedFile = pendingResolveFiles[selectedIdx] || pendingResolveFiles[0];

  const handleFormatSingle = async (filename: string) => {
    await importAndFormatFile(pendingResolveProject, filename);
    // Automatically select the next item if possible
    if (selectedIdx >= pendingResolveFiles.length - 1) {
      setSelectedIdx(Math.max(0, pendingResolveFiles.length - 2));
    }
  };

  const handleFormatAll = async () => {
    setIsFormattingAll(true);
    // Copy list to avoid mutators index shifting
    const filesArray = [...pendingResolveFiles];
    for (const file of filesArray) {
      await importAndFormatFile(pendingResolveProject, file.filename);
    }
    setIsFormattingAll(false);
  };

  const handleSkipClose = () => {
    setPendingResolve(null, null);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-5xl h-[80vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden font-sans text-slate-100"
          id="conflict-resolver-modal"
        >
          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-950/40">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
                <FileWarning className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">Format Resolver: {pendingResolveProject}</h2>
                <p className="text-xs text-slate-400">
                  {pendingResolveFiles.length} file{pendingResolveFiles.length > 1 ? 's' : ''} missing proper frontmatter formatting. Double-click or select files below to adjust them.
                </p>
              </div>
            </div>
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleSkipClose} 
              className="hover:bg-slate-800 text-slate-400 hover:text-slate-100 rounded-full w-8 h-8"
              id="close-resolver-btn"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Workspace Bento Split */}
          <div className="flex-1 flex min-h-0 bg-slate-900">
            {/* Left Panel: Files Directory list */}
            <div className="w-1/3 border-r border-slate-800 flex flex-col bg-slate-950/20">
              <div className="p-4 border-b border-slate-800/60 bg-slate-950/20 flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Files Detected</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-slate-300">
                  {pendingResolveFiles.length} Left
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {pendingResolveFiles.map((file, idx) => (
                  <button
                    key={file.filename}
                    onClick={() => setSelectedIdx(idx)}
                    className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition-all group ${
                      idx === selectedIdx 
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' 
                        : 'bg-slate-950/40 hover:bg-slate-800/40 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className={`w-4 h-4 shrink-0 ${idx === selectedIdx ? 'text-amber-400' : 'text-slate-500 group-hover:text-amber-400 transition-colors'}`} />
                      <span className="text-sm font-medium truncate font-mono">{file.filename}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${idx === selectedIdx ? 'translate-x-0.5 text-amber-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
                  </button>
                ))}
              </div>
              
              <div className="p-3 border-t border-slate-800 bg-slate-950/40">
                <Button 
                  onClick={handleFormatAll} 
                  disabled={isFormattingAll}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold gap-1.5 shadow-md shadow-amber-500/10 py-5 rounded-xl border-none"
                  id="format-all-btn"
                >
                  <Sparkles className="w-4 h-4" />
                  {isFormattingAll ? 'Formatting All...' : 'Import & Format All'}
                </Button>
              </div>
            </div>

            {/* Right Panel: Content Preview and Actions */}
            <div className="flex-1 flex flex-col bg-slate-900/40">
              {selectedFile ? (
                <>
                  <div className="p-4 border-b border-slate-800/60 bg-slate-950/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">Previewing:</span>
                      <span className="text-sm font-semibold font-mono text-slate-200">{selectedFile.filename}</span>
                    </div>
                    <span className="text-xs text-rose-400 flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                      Missing YAML Frontmatter
                    </span>
                  </div>

                  <div className="flex-1 p-6 overflow-auto">
                    <div className="h-full flex flex-col bg-slate-950/40 rounded-xl border border-slate-800 overflow-hidden font-mono text-xs">
                      <div className="px-4 py-2 bg-slate-950/75 border-b border-slate-800 text-slate-500 flex justify-between select-none">
                        <span>RAW FILESYSTEM CONTENT</span>
                        <span>UTF-8 Markdown</span>
                      </div>
                      <pre className="flex-1 p-5 overflow-auto text-slate-300 leading-relaxed font-mono whitespace-pre-wrap select-text selection:bg-amber-500/30 text-[11px]">
                        {selectedFile.content || (
                          <span className="text-slate-600 italic">This file is empty. Clicking format will prepopulate it.</span>
                        )}
                      </pre>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/20 flex justify-between items-center">
                    <p className="text-xs text-slate-400 max-w-sm">
                      Formatting will append valid front-matter header, initializing title and moving this card to your <strong className="text-amber-400">To Do</strong> column.
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        onClick={() => {
                          // Skip item
                          if (selectedIdx < pendingResolveFiles.length - 1) {
                            setSelectedIdx(selectedIdx + 1);
                          } else {
                            setSelectedIdx(0);
                          }
                        }}
                        className="text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        id="skip-item-btn"
                      >
                        Skip for Now
                      </Button>
                      <Button 
                        onClick={() => handleFormatSingle(selectedFile.filename)}
                        className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 gap-1.5"
                        id="format-single-btn"
                      >
                        <CheckCircle className="w-4 h-4 text-amber-400" />
                        Import & Format File
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                  <FileText className="w-12 h-12 mb-2 text-slate-700" />
                  <p>All items successfully imported!</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
