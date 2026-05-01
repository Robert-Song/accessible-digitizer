
import React, { useRef, useEffect } from 'react';
import { ConversionResult, AppState } from '../types';

interface ResultsViewProps {
  results: ConversionResult[];
  activeTab: number;
  setActiveTab: (index: number) => void;
  viewMode: 'preview' | 'source';
  setViewMode: (mode: 'preview' | 'source') => void;
  onEditFigure: (pageIndex: number, figureId: string) => void;
  onBatchEdit: () => void;
  onRefineMath: () => void;
  onDownloadHtml: () => void;
  onShowAudit: () => void;
  onReset: () => void;
  isRefining: boolean;
}

const ResultsView: React.FC<ResultsViewProps> = ({
  results,
  activeTab,
  setActiveTab,
  viewMode,
  setViewMode,
  onEditFigure,
  onBatchEdit,
  onRefineMath,
  onDownloadHtml,
  onShowAudit,
  onReset,
  isRefining
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const activeAudit = results[activeTab]?.audit;

  useEffect(() => {
    if (window.MathJax && results.length > 0 && contentRef.current) {
      window.MathJax.typesetPromise([contentRef.current]).catch((err: any) => 
        console.error('MathJax error:', err)
      );

      const editButtons = contentRef.current.querySelectorAll('.edit-figure-btn');
      
      const handleEditClick = (e: Event) => {
        const figureId = (e.currentTarget as HTMLElement).getAttribute('data-figure-id');
        if (figureId) {
          onEditFigure(activeTab, figureId);
        }
      };

      editButtons.forEach(btn => {
        btn.addEventListener('click', handleEditClick);
      });

      return () => {
        editButtons.forEach(btn => {
          btn.removeEventListener('click', handleEditClick);
        });
      };
    }
  }, [results, activeTab, viewMode, onEditFigure]);

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
      <aside className="w-full lg:w-64 flex-shrink-0 space-y-4 lg:sticky lg:top-24">
        <div className="bg-white p-5 border-2 border-zinc-900 shadow-[6px_6px_0_#18181b]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-mono font-black text-zinc-900 text-[10px] uppercase tracking-widest">Accessibility</h3>
            <div className={`border px-2 py-0.5 font-mono text-[9px] font-black ${activeAudit?.passed ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-amber-500 bg-amber-50 text-amber-700'}`}>
              {activeAudit?.score ?? 0}% AXE
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 leading-relaxed mb-4">
            {activeAudit?.passed ? 'No automated WCAG AA violations found.' : `${activeAudit?.violations.length || 0} automated issue(s) need review.`}
          </p>
          
          <div className="mb-4">
            <div className="w-full bg-zinc-200 h-1 overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${activeAudit?.passed ? 'bg-teal-500' : 'bg-amber-500'}`}
                style={{ width: `${activeAudit?.score || 0}%` }}
              ></div>
            </div>
          </div>
          
          <div className="space-y-2 mb-6">
            {activeAudit?.checks.map((check, idx) => (
              <div key={idx} className="group relative">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 flex-shrink-0 flex items-center justify-center ${check.passed ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-600'}`}>
                    {check.passed ? (
                      <svg className="w-1.5 h-1.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    ) : (
                      <span className="text-[8px] font-bold">!</span>
                    )}
                  </div>
                  <span className={`text-[9px] font-mono font-bold leading-tight ${check.passed ? 'text-zinc-500' : 'text-amber-600'}`}>{check.title}</span>
                </div>
                <div className="hidden group-hover:block absolute left-full ml-4 top-0 w-56 p-4 bg-zinc-950 text-white text-[10px] shadow-2xl z-50 border border-zinc-700">
                  <p className="font-bold mb-1">{check.description}</p>
                  {check.suggestion && (
                    <p className="text-amber-300 mt-2 flex items-start gap-1">
                      <span className="font-black">Fix:</span> {check.suggestion}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={onShowAudit}
            className="w-full py-2 mb-6 bg-white border border-zinc-300 text-zinc-700 font-mono text-[9px] font-black uppercase tracking-widest hover:border-teal-500 hover:text-teal-700 transition-colors"
          >
            View Full Report
          </button>

          <h3 className="font-mono font-black text-zinc-900 mb-4 text-[10px] uppercase tracking-widest border-t border-zinc-200 pt-4">Controls</h3>
          <div className="space-y-2">
             <button 
               onClick={onRefineMath} 
               disabled={isRefining}
               className="w-full py-2.5 bg-white border border-zinc-300 text-zinc-900 font-mono text-[10px] font-bold hover:border-teal-500 disabled:opacity-50 flex items-center justify-center gap-2"
             >
               {isRefining ? 'REFINING...' : 'REFINE MATH (AI)'}
             </button>
             <button onClick={onBatchEdit} className="w-full py-2.5 bg-zinc-950 text-teal-300 font-mono text-[10px] font-bold hover:bg-zinc-800">BATCH EDIT FIGURES</button>
             <button onClick={onDownloadHtml} className="w-full py-2.5 bg-teal-400 border-2 border-zinc-950 text-black font-mono text-[10px] font-black hover:bg-teal-300 transition-all">DOWNLOAD HTML</button>
             <button 
               onClick={onReset} 
               className="w-full py-2.5 mt-4 bg-white border-2 border-zinc-300 text-zinc-500 font-mono text-[10px] font-black uppercase tracking-widest hover:border-zinc-900 hover:text-zinc-900 transition-all flex items-center justify-center gap-2"
             >
               <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
               New Document
             </button>
          </div>
        </div>

        <nav className="bg-white p-5 border border-zinc-300 max-h-[400px] overflow-y-auto shadow-[4px_4px_0_#d4d4d8]">
          <h3 className="font-mono font-black text-zinc-900 mb-4 text-[10px] uppercase tracking-widest">Pages</h3>
          <div className="grid grid-cols-2 gap-2">
            {results.map((r, i) => (
              <button 
                key={i}
                onClick={() => setActiveTab(i)}
                className={`px-3 py-2 font-mono text-[10px] font-black border transition-all ${activeTab === i ? 'bg-zinc-950 text-teal-300 border-zinc-950' : 'bg-white text-zinc-400 border-zinc-200 hover:border-teal-500'}`}
              >
                P.{r.pageNumber}
              </button>
            ))}
          </div>
        </nav>
      </aside>

      <div className="flex-1 w-full flex flex-col">
        <div className="w-full max-w-none">
          <div className="flex items-center justify-between mb-8 border-b-2 border-zinc-900 bg-white px-4 py-3 shadow-[4px_4px_0_#d4d4d8]">
             <div className="flex gap-4">
                <button onClick={() => setViewMode('preview')} className={`font-mono text-[11px] font-black tracking-widest ${viewMode === 'preview' ? 'text-teal-700' : 'text-zinc-400 hover:text-zinc-700'}`}>PREVIEW</button>
                <button onClick={() => setViewMode('source')} className={`font-mono text-[11px] font-black tracking-widest ${viewMode === 'source' ? 'text-teal-700' : 'text-zinc-400 hover:text-zinc-700'}`}>SOURCE</button>
             </div>
             <div className="font-mono text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Page {activeTab + 1} of {results.length}</div>
          </div>

          <div className="min-h-[800px] pb-32">
            {viewMode === 'preview' ? (
              <article ref={contentRef} className="math-content prose prose-slate max-w-none bg-white p-8 md:p-12 shadow-[8px_8px_0_#d4d4d8] border-2 border-zinc-900 w-full">
                 <div dangerouslySetInnerHTML={{ __html: results[activeTab]?.html || '' }} />
              </article>
            ) : (
              <div className="font-mono text-[11px] text-zinc-300 bg-zinc-950 p-8 whitespace-pre-wrap leading-loose border-2 border-zinc-900 shadow-[8px_8px_0_#14b8a6]">
                {results[activeTab]?.html}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsView;
