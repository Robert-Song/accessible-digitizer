
import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import Header from './components/Header';
import ProcessingOverlay from './components/ProcessingOverlay';
import ImageEditor from './components/ImageEditor';
import Dashboard from './components/Dashboard';
import ResultsView from './components/ResultsView';
import AccessibilityAuditReport from './components/AccessibilityAuditReport';
import HelpModal from './components/HelpModal';
import { useDigitization } from './hooks/useDigitization';

const App: React.FC = () => {
  const {
    state,
    elapsedTime,
    originalFile,
    isRefining,
    handleFileUpload,
    handleRefineMath,
    saveEditedFigures,
    incrementUsage,
    reset
  } = useDigitization();

  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');
  const [activeTab, setActiveTab] = useState<number>(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showAuditReport, setShowAuditReport] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [showResetWarning, setShowResetWarning] = useState(false);
  const [editingFigures, setEditingFigures] = useState<{ id: string, src: string, originalSrc: string, alt: string, pageIndex: number }[] | null>(null);

  const handleReset = () => {
    if (state.results.length > 0 && !hasDownloaded) {
      setShowResetWarning(true);
    } else {
      performReset();
    }
  };

  const performReset = () => {
    reset();
    setActiveTab(0);
    setViewMode('preview');
    setShowAuditReport(false);
    setEditingFigures(null);
    setHasDownloaded(false);
    setShowResetWarning(false);
  };

  const handleEditFigure = (pageIndex: number, figureId: string) => {
    const page = state.results[pageIndex];
    const figure = page.figures.find(f => f.id === figureId);
    if (figure) {
      setEditingFigures([{ 
        id: figureId,
        pageIndex, 
        src: figure.currentSrc,
        originalSrc: figure.originalSrc,
        alt: figure.alt
      }]);
    }
  };

  const handleBatchEdit = () => {
    const page = state.results[activeTab];
    if (page && page.figures.length > 0) {
      setEditingFigures(page.figures.map(f => ({
        id: f.id,
        pageIndex: activeTab,
        src: f.currentSrc,
        originalSrc: f.originalSrc,
        alt: f.alt
      })));
    } else {
      alert('No figures found on this page to batch edit.');
    }
  };

  const handleDownloadHtml = () => {
    const firstPageHtml = state.results[0]?.html || '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(firstPageHtml, 'text/html');
    const firstHeading = doc.querySelector('h1, h2, h3');
    const extractedTitle = firstHeading ? firstHeading.textContent?.trim() : 'Accessible Document';

    const cleanResults = state.results.map((r, idx) => {
      const pageParser = new DOMParser();
      const pageDoc = pageParser.parseFromString(r.html, 'text/html');

      // Remove edit figure buttons
      pageDoc.querySelectorAll('.edit-figure-btn').forEach(btn => btn.remove());

      // Remove standalone slide number paragraphs
      pageDoc.body.querySelectorAll('p').forEach(p => {
        const text = p.textContent?.trim() || '';
        if (/^(?:page|slide)?\s*\d{1,3}$/i.test(text) && !p.querySelector('img, svg, a, table, button, input')) {
          p.remove();
        }
      });

      // On continuation pages (idx > 0), only remove exact duplicate repeats of the main document title
      if (idx > 0 && extractedTitle) {
        pageDoc.body.querySelectorAll('h1, h2').forEach(heading => {
          const headingText = heading.textContent?.trim() || '';
          const isExactTitleRepeat = headingText.toLowerCase().replace(/[^a-z0-9]/g, '') === extractedTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (isExactTitleRepeat && pageDoc.body.children.length > 1) {
            heading.remove();
          }
        });

        // Demote any remaining <h1> to <h2>
        pageDoc.body.querySelectorAll('h1').forEach(h1 => {
          const h2 = pageDoc.createElement('h2');
          h2.innerHTML = h1.innerHTML;
          Array.from(h1.attributes).forEach(attr => h2.setAttribute(attr.name, attr.value));
          h1.replaceWith(h2);
        });
      }

      // Unwrap outer <article class="generated-page"> if present
      const outerArticle = pageDoc.body.querySelector('article.generated-page');
      let pageContent = pageDoc.body.innerHTML;
      if (outerArticle && pageDoc.body.children.length === 1) {
        pageContent = outerArticle.innerHTML;
      }

      return { ...r, html: pageContent };
    });

    const template = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${extractedTitle} - AccessDocs</title>
    <script>
        window.MathJax = {
          tex: {
            inlineMath: [['\\\\(', '\\\\)']],
            displayMath: [['\\\\[', '\\\\]']],
            processEscapes: true
          },
          options: {
            skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'code', 'pre']
          }
        };
    </script>
    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');

        :root {
            --purple: #581c87;
            --purple-50: #faf5ff;
            --purple-100: #f3e8ff;
            --indigo-600: #4f46e5;
            --indigo-50: #eef2ff;
            --slate-900: #1e293b;
            --slate-700: #334155;
            --slate-400: #595959;
            --slate-300: #cbd5e1;
            --slate-200: #e2e8f0;
            --slate-50: #f8fafc;
            --emerald-600: #059669;
            --emerald-50: #ecfdf5;
            --amber-600: #d97706;
            --amber-50: #fffbeb;
            --fg-1: var(--slate-900);
            --fg-2: var(--slate-700);
            --border: var(--slate-200);
            --rule: var(--slate-300);
            --accent: var(--purple);
            --bg: #ffffff;
            --bg-soft: var(--slate-50);
            --font-display: 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
            --font-body: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            --font-mono: ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace;
        }

        * { box-sizing: border-box; }
        html { -webkit-text-size-adjust: 100%; }

        body {
            margin: 0;
            background: var(--bg);
            color: var(--fg-1);
            font-family: var(--font-body);
            font-size: 1.125rem; /* 18px / 13.5pt >= 12pt */
            line-height: 1.7;
            text-rendering: optimizeLegibility;
            -webkit-font-smoothing: antialiased;
        }

        #main {
            max-width: 920px;
            margin: 0 auto;
            padding: 3.5rem 2rem 6rem;
        }

        @media (max-width: 640px) {
            #main { padding: 2rem 1.25rem 4rem; }
            body { font-size: 1.05rem; }
        }

        #main > * + * { margin-top: 1.3em; }

        h1, h2, h3, h4, h5, h6 {
            font-family: var(--font-display);
            margin: 2.2em 0 0.5em;
            font-weight: 700;
            line-height: 1.25;
            letter-spacing: -0.01em;
            color: var(--fg-1);
        }

        h1 { font-size: 2.35rem; margin-top: 0; }
        h2 { font-size: 1.8rem; margin-top: 2em; border-bottom: 1px solid var(--border); padding-bottom: 0.45rem; }
        h3 { font-size: 1.4rem; }
        h4 { font-size: 1.2rem; }

        p { margin: 0 0 1.15em; }
        strong { font-weight: 700; }
        em { font-style: italic; }

        a {
            color: var(--accent);
            text-decoration: underline;
            text-underline-offset: 3px;
        }
        a:hover { color: var(--indigo-600); }
        a:focus-visible {
            outline: 3px solid var(--accent);
            outline-offset: 2px;
            border-radius: 2px;
        }

        ul, ol { padding-left: 1.7em; margin: 1.1em 0; }
        li { margin: 0.45em 0; }
        ul ul, ol ol, ul ol, ol ul { margin: 0.4em 0; }

        blockquote, .solution-box {
            margin: 1.8em 0;
            padding: 1.15rem 1.5rem;
            border-left: 4px solid var(--accent);
            background: var(--purple-50);
            border-radius: 0 10px 10px 0;
            font-size: 1.05rem;
        }
        blockquote > :last-child, .solution-box > :last-child { margin-bottom: 0; }

        .table-wrap { overflow-x: auto; margin: 2em 0; }
        table {
            border-collapse: collapse;
            width: 100%;
            font-size: 1.05rem; /* >= 12pt */
            margin: 1.5em 0;
        }
        caption {
            font-family: var(--font-display);
            font-weight: 700;
            font-size: 1.05rem; /* >= 12pt */
            text-align: left;
            margin-bottom: 0.65rem;
            color: var(--fg-1);
        }
        thead th {
            font-family: var(--font-display);
            font-weight: 700;
            font-size: 1rem; /* 16px / 12pt */
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: var(--fg-2);
            text-align: left;
            padding: 0.85rem 1.1rem;
            border-bottom: 2px solid var(--rule);
            background: var(--bg-soft);
        }
        tbody td {
            padding: 0.85rem 1.1rem;
            border-bottom: 1px solid var(--border);
            font-size: 1.05rem; /* >= 12pt */
        }
        tbody tr:hover td { background: var(--bg-soft); }

        mjx-container[display="true"] {
            display: block;
            margin: 1.6em auto;
            padding: 1.35rem 1.6rem;
            background: var(--bg-soft);
            border: 1px solid var(--border);
            border-radius: 12px;
            text-align: center;
            overflow-x: auto;
            font-size: 1.15rem;
        }

        figure {
            margin: 2.2em 0;
            padding: 1.35rem;
            background: #fff;
            border: 1px solid var(--border);
            border-radius: 12px;
            text-align: center;
        }
        figure img, figure svg {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 0 auto;
            border-radius: 8px;
        }
        figcaption {
            margin-top: 0.85rem;
            font-size: 1rem; /* 16px / 12pt */
            color: var(--fg-2);
            font-style: italic;
        }

        .page-break-divider {
            display: flex;
            align-items: center;
            margin: 3.5rem 0 2rem;
            border-top: 1px dashed var(--slate-300);
            position: relative;
        }
        .page-break-divider .page-num {
            position: absolute;
            right: 0;
            top: -0.85rem;
            background: var(--bg);
            padding: 0 0.65rem;
            font-family: var(--font-mono);
            font-size: 1rem; /* 16px / 12pt minimum */
            color: var(--slate-400);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        @media print {
            body { font-size: 12pt; color: #000; background: #fff; }
            #main { max-width: none; padding: 0; }
            .no-print { display: none !important; }
            .page-break-divider { page-break-after: always; border: 0; margin: 0; }
            h2, h3 { break-after: avoid; }
            figure, table, mjx-container[display="true"] { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <article id="main">
        ${cleanResults.map((r, idx) => `
        <section class="page-section" id="page-${r.pageNumber}" aria-label="Page ${r.pageNumber}">
            ${idx > 0 ? `<div class="page-break-divider no-print" role="separator" aria-label="Page ${r.pageNumber}"><span class="page-num">Page ${r.pageNumber}</span></div>` : ''}
            ${r.html}
        </section>`).join('\n')}
    </article>
</body>
</html>`;

    const blob = new Blob([template], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const baseFileName = originalFile ? originalFile.name.replace(/\.[^/.]+$/, "") : `accessdocs_${new Date().getTime()}`;
    link.download = `${baseFileName}-acc.html`;
    link.click();
    URL.revokeObjectURL(url);
    setHasDownloaded(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      {(state.results.length > 0 || state.isProcessing) && (
        <Header onShowDocs={() => setShowHelp(true)} />
      )}
      
      {state.isProcessing && (
        <ProcessingOverlay 
          progress={state.progress} 
          status={state.statusMessage}
          elapsedTime={elapsedTime}
          pageProgress={state.pageProgress}
          activeConcurrencyCount={state.activeConcurrencyCount}
          docSummary={state.docSummary}
          topicKeyword={state.topicKeyword}
        />
      )}

      {showAuditReport && (
        <AccessibilityAuditReport 
          results={state.results}
          activeTab={activeTab}
          state={state}
          onClose={() => setShowAuditReport(false)}
        />
      )}

      {showHelp && (
        <HelpModal onClose={() => setShowHelp(false)} />
      )}

      {showResetWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white">
          <div className="bg-white max-w-md w-full p-6 border border-black">
            <div className="w-12 h-12 border border-black flex items-center justify-center mb-6 text-black">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            </div>
            <h3 className="text-xl font-semibold text-black mb-2">Unsaved Changes</h3>
            <p className="text-neutral-700 mb-8 leading-relaxed">
              You haven't downloaded your digitized notes yet. Starting a new document will permanently discard your current work.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowResetWarning(false)}
                className="flex-1 py-3 px-4 bg-white text-black border border-black font-semibold hover:bg-neutral-100 transition-colors"
              >
                Go Back
              </button>
              <button 
                onClick={performReset}
                className="flex-1 py-3 px-4 bg-black text-white border border-black font-semibold hover:bg-white hover:text-black transition-colors"
              >
                Discard & Reset
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {editingFigures && (
          <ImageEditor 
            figures={editingFigures}
            onSave={(updates) => {
              saveEditedFigures(updates);
              setEditingFigures(null);
            }}
            onClose={() => setEditingFigures(null)}
            onApiCall={incrementUsage}
          />
        )}
      </AnimatePresence>

      <main className="flex-1 max-w-[1800px] mx-auto w-full px-4 sm:px-6 lg:px-12 py-8" role="main">
        {state.error && (
          <div className="mb-8 p-5 bg-white border border-black flex items-start gap-4">
            <div className="w-10 h-10 border border-black flex items-center justify-center text-black flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div>
              <h3 className="font-semibold text-black text-sm mb-1">{state.error.split('|')[0]}</h3>
              <p className="text-neutral-700 text-xs leading-relaxed font-medium">{state.error.split('|')[1] || state.error}</p>
            </div>
            <button 
              onClick={() => reset()} 
              className="ml-auto p-2 text-black border border-black hover:bg-neutral-100 transition-colors"
              title="Clear Error"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        )}

        {!state.results.length && !state.isProcessing ? (
          <>
            <Dashboard 
              onFileUpload={handleFileUpload} 
              isProcessing={state.isProcessing} 
              onShowDocs={() => setShowHelp(true)}
            />
          </>
        ) : (
          <ResultsView 
            results={state.results}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            viewMode={viewMode}
            setViewMode={setViewMode}
            onEditFigure={handleEditFigure}
            onBatchEdit={handleBatchEdit}
            onRefineMath={() => handleRefineMath(activeTab)}
            onDownloadHtml={handleDownloadHtml}
            onShowAudit={() => setShowAuditReport(true)}
            onReset={handleReset}
            isRefining={isRefining}
          />
        )}
      </main>

      <style>{`
        .notebox {
          border-left: 4px solid #CEB888;
          padding: 1.5rem 2rem;
          margin: 2.5rem 0;
          background-color: #f8fafc;
          border-radius: 0 0.75rem 0.75rem 0;
          font-style: italic;
          color: #334155;
          box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
        }
        @media (min-width: 1400px) {
          .math-content {
            display: grid;
            grid-template-columns: 1fr 350px;
            gap: 0 4rem;
            align-items: start;
          }
          .math-content > * {
            grid-column: 1;
          }
          .math-content > figure {
            grid-column: 2;
            grid-row: span 20;
            margin: 0;
            width: 100%;
            max-width: none;
          }
          .math-content h1, .math-content h2, .math-content h3 {
            grid-column: 1 / -1;
            clear: both;
          }
          .grid-layout {
            display: grid;
            grid-template-columns: 1fr 350px;
            gap: 0 4rem;
            align-items: start;
          }
          .grid-layout > *:not(figure) {
            grid-column: 1;
          }
          .grid-layout > figure {
            grid-column: 2;
            margin: 0;
            width: 100%;
            max-width: none;
          }
        }
        @media print {
          header, aside, button, label, .border-b { display: none !important; }
          main, .flex-1, .w-full { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; margin: 0 !important; padding: 0 !important; }
          article { border: none !important; padding: 0 !important; margin: 0 !important; page-break-after: always; }
        }
      `}</style>
    </div>
  );
};

export default App;
