import React, { useEffect, useRef } from 'react';
import { AppState, ConversionResult } from '../types';

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
      const handleEditClick = (event: Event) => {
        const figureId = (event.currentTarget as HTMLElement).getAttribute('data-figure-id');
        if (figureId) onEditFigure(activeTab, figureId);
      };

      editButtons.forEach(button => button.addEventListener('click', handleEditClick));
      return () => editButtons.forEach(button => button.removeEventListener('click', handleEditClick));
    }
  }, [results, activeTab, viewMode, onEditFigure]);

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <section className="border border-black bg-white p-4">
          <h2 className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest">audit</h2>
          <p className="mb-3 text-sm">
            score: <strong>{activeAudit ? `${activeAudit.score}%` : 'not audited'}</strong>
          </p>
          <p className="mb-4 text-sm leading-6 text-neutral-700">
            {!activeAudit ? 'Content changed or has not been audited. Refine math to run a new audit.'
              : activeAudit.passed ? 'Automated checks passed; content quality still needs review.'
              : `${activeAudit.violations.length} axe violation(s), ${activeAudit.checks.filter(c => !c.passed && c.title !== 'Axe WCAG AA').length} failed custom check(s), and ${activeAudit.incomplete.length} incomplete check(s) need review.`}
          </p>
          <div className="mb-4 h-3 border border-black">
            <div className="h-full bg-black" style={{ width: `${activeAudit?.score || 0}%` }} />
          </div>
          <ul className="mb-5 space-y-1 text-xs text-neutral-700">
            {activeAudit?.checks.map(check => (
              <li key={check.title}>
                {check.passed ? '[x]' : '[ ]'} {check.title}
              </li>
            ))}
          </ul>
          <button onClick={onShowAudit} className="w-full border border-black bg-white px-3 py-2 text-sm hover:bg-neutral-100">
            view report
          </button>
        </section>

        <section className="border border-black bg-white p-4">
          <h2 className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest">actions</h2>
          <div className="space-y-2">
            <button onClick={onRefineMath} disabled={isRefining} className="w-full border border-black bg-white px-3 py-2 text-sm hover:bg-neutral-100 disabled:opacity-50">
              {isRefining ? 'refining...' : 'refine math'}
            </button>
            <button onClick={onBatchEdit} className="w-full border border-black bg-white px-3 py-2 text-sm hover:bg-neutral-100">
              edit figures
            </button>
            <button onClick={onDownloadHtml} className="w-full border border-black bg-black px-3 py-2 text-sm text-white hover:bg-white hover:text-black">
              download html
            </button>
            <button onClick={onReset} className="w-full border border-black bg-white px-3 py-2 text-sm hover:bg-neutral-100">
              new document
            </button>
          </div>
        </section>

        <nav className="border border-black bg-white p-4">
          <h2 className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest">pages</h2>
          <div className="grid grid-cols-3 gap-2">
            {results.map((result, index) => (
              <button
                key={result.pageNumber}
                onClick={() => setActiveTab(index)}
                className={`border border-black px-2 py-2 text-sm ${activeTab === index ? 'bg-black text-white' : 'bg-white hover:bg-neutral-100'}`}
              >
                {result.pageNumber}
              </button>
            ))}
          </div>
        </nav>
      </aside>

      <section className="min-w-0">
        <div className="mb-4 flex items-center justify-between border border-black bg-white p-3">
          <div className="flex gap-3">
            <button onClick={() => setViewMode('preview')} className={`text-sm underline-offset-4 ${viewMode === 'preview' ? 'underline' : ''}`}>
              preview
            </button>
            <button onClick={() => setViewMode('source')} className={`text-sm underline-offset-4 ${viewMode === 'source' ? 'underline' : ''}`}>
              source
            </button>
          </div>
          <p className="font-mono text-xs text-neutral-600">page {activeTab + 1} / {results.length}</p>
        </div>

        {viewMode === 'preview' ? (
          <article ref={contentRef} className="math-content min-h-[800px] border border-black bg-white p-6 md:p-10">
            <div dangerouslySetInnerHTML={{ __html: results[activeTab]?.html || '' }} />
          </article>
        ) : (
          <pre className="min-h-[800px] overflow-auto whitespace-pre-wrap border border-black bg-white p-6 font-mono text-xs leading-6 text-black">
            {results[activeTab]?.html}
          </pre>
        )}
      </section>
    </div>
  );
};

export default ResultsView;
