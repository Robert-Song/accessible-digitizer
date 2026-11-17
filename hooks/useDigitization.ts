
import { useState, useEffect, useCallback } from 'react';
import { AppState, ConversionResult, DigitizationOptions, LanguageLevel, PageProcessingStatus, PageProgressInfo } from '../types';
import { pdfToImageData } from '../services/pdfService';
import { convertPageToHtml, getAiCapabilities, refineLatex, summarizeDocumentText } from '../services/aiService';
import { runAccessibilityAudit } from '../utils/accessibility';
import { auditAndRepair } from '../services/accessibilityPipeline';
import { cropImage } from '../utils/image';
import { cleanAltText } from '../utils/dom';

export const useDigitization = () => {
  const [state, setState] = useState<AppState>({
    isProcessing: false,
    progress: 0,
    results: [],
    error: null,
    statusMessage: 'Waiting for upload...',
    sessionRequestCount: 0,
    dailyRequestCount: 0,
    docSummary: null,
    topicKeyword: null,
    pageProgress: [],
    activeConcurrencyCount: 0
  });

  const [elapsedTime, setElapsedTime] = useState(0);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [isRefining, setIsRefining] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem('accessdocs_daily_usage');
    if (stored) {
      const { date, count } = JSON.parse(stored);
      if (date === today) {
        setState(prev => ({ ...prev, dailyRequestCount: count || 0 }));
      } else {
        localStorage.setItem('accessdocs_daily_usage', JSON.stringify({ date: today, count: 0 }));
      }
    } else {
      localStorage.setItem('accessdocs_daily_usage', JSON.stringify({ date: today, count: 0 }));
    }
  }, []);

  useEffect(() => {
    let interval: any;
    if (state.isProcessing) {
      const startTime = Date.now();
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [state.isProcessing]);

  const incrementUsage = useCallback(() => {
    setState(prev => {
      const newDailyCount = prev.dailyRequestCount + 1;
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem('accessdocs_daily_usage', JSON.stringify({ date: today, count: newDailyCount }));
      return {
        ...prev,
        sessionRequestCount: prev.sessionRequestCount + 1,
        dailyRequestCount: newDailyCount
      };
    });
  }, []);

  const updatePageProgress = useCallback((pageNumber: number, status: PageProcessingStatus, statusMsg?: string) => {
    setState(prev => {
      const updated = (prev.pageProgress || []).map(p =>
        p.pageNumber === pageNumber ? { ...p, status, statusMessage: statusMsg } : p
      );
      const activeCount = updated.filter(p =>
        p.status === 'converting' || p.status === 'cropping' || p.status === 'auditing' || p.status === 'repairing'
      ).length;
      return {
        ...prev,
        pageProgress: updated,
        activeConcurrencyCount: activeCount
      };
    });
  }, []);

  const auditAndRepairHtml = useCallback(async (html: string, pageNumber: number) => {
    return auditAndRepair(html, {
      requireH1: pageNumber === 1,
      onRepair: attempt => updatePageProgress(pageNumber, 'repairing', `Repairing accessibility (${attempt}/2)`),
      onRequest: incrementUsage
    });
  }, [incrementUsage, updatePageProgress]);

  const handleFileUpload = async (file: File, optionsInput: DigitizationOptions | LanguageLevel) => {
    if (!file) return;

    const options: DigitizationOptions = typeof optionsInput === 'string'
      ? { languageLevel: optionsInput, generateDocSummary: true }
      : optionsInput;

    const { languageLevel, generateDocSummary = true, topicKeyword } = options;

    let effectiveConcurrency = options.concurrencyLimit;
    if (!effectiveConcurrency) {
      try {
        const caps = await getAiCapabilities();
        if (caps.concurrencyLimit && caps.concurrencyLimit > 0) {
          effectiveConcurrency = caps.concurrencyLimit;
        }
      } catch {
        // Fallback
      }
    }
    const concurrencyLimit = Math.max(1, Math.min(effectiveConcurrency || 2, 20));

    setOriginalFile(file);
    const startTime = Date.now();
    setState(prev => ({
      ...prev,
      isProcessing: true,
      progress: 5,
      results: [],
      error: null,
      statusMessage: 'Reading file and preparing pages...',
      topicKeyword: topicKeyword || null,
      docSummary: null,
      pageProgress: [],
      activeConcurrencyCount: 0
    }));

    try {
      const pageData = await pdfToImageData(file, true);
      const totalPages = pageData.length;

      const initialProgress: PageProgressInfo[] = pageData.map((_, idx) => ({
        pageNumber: idx + 1,
        status: 'pending',
        statusMessage: 'Queued'
      }));

      setState(prev => ({
        ...prev,
        progress: 10,
        pageProgress: initialProgress,
        statusMessage: `Loaded ${totalPages} page${totalPages > 1 ? 's' : ''}. Analyzing document...`
      }));

      // Document-level summary pass if requested & text is extracted
      let globalDocSummary = '';
      const allExtractedText = pageData
        .map((p, i) => p.extractedText ? `Page ${i + 1}:\n${p.extractedText}` : '')
        .filter(Boolean)
        .join('\n\n');

      if (generateDocSummary && allExtractedText.trim().length > 0) {
        setState(prev => ({
          ...prev,
          progress: 15,
          statusMessage: 'Generating global document summary from extracted PDF text...'
        }));

        try {
          const summaryResult = await summarizeDocumentText(allExtractedText, topicKeyword);
          if (summaryResult.summary) {
            globalDocSummary = summaryResult.summary;
            incrementUsage();
            setState(prev => ({
              ...prev,
              docSummary: globalDocSummary,
              statusMessage: 'Global document summary generated.'
            }));
          }
        } catch (e) {
          console.warn('Global summary generation skipped:', e);
        }
      }

      setState(prev => ({
        ...prev,
        progress: 20,
        statusMessage: `Starting transcription (${Math.min(concurrencyLimit, totalPages)} in parallel)...`
      }));

      const results: ConversionResult[] = new Array(totalPages);
      let completedPages = 0;

      const processSinglePage = async (i: number) => {
        const pageNum = i + 1;
        try {
          updatePageProgress(pageNum, 'converting', 'Vision AI Transcription');
          setState(prev => ({
            ...prev,
            statusMessage: `Transcribing page ${pageNum} with Vision AI...`
          }));

          const pageResponse = await convertPageToHtml(
            pageData[i].base64,
            pageNum,
            languageLevel,
            {
              extractedText: pageData[i].extractedText,
              textSource: pageData[i].textSource,
              docSummary: globalDocSummary || undefined,
              topicKeyword: topicKeyword || undefined
            }
          );
          incrementUsage();

          updatePageProgress(pageNum, 'cropping', 'Extracting figures');
          const modelResponse = pageResponse.page;
          let finalHtml = modelResponse?.html || '';
          const rawFigures = Array.isArray(modelResponse?.figures) ? modelResponse.figures : [];

          const figureResults = rawFigures.map((fig) => {
            const screenshotBase64 = cropImage(pageData[i].canvas, fig);
            return {
              id: fig.id,
              originalSrc: screenshotBase64,
              currentSrc: screenshotBase64,
              alt: fig.alt
            };
          });

          if (figureResults.length > 0) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(finalHtml, 'text/html');

            figureResults.forEach(figResult => {
              const targetImg = doc.getElementById(figResult.id) || doc.querySelector(`img[id="${figResult.id}"]`);
              if (targetImg) {
                const cleanAlt = cleanAltText(figResult.alt);
                const displayAlt = figResult.alt;

                const figureEl = doc.createElement('figure');
                figureEl.className = 'my-8 p-6 bg-slate-50 rounded-2xl border border-slate-100 group/fig';
                figureEl.setAttribute('role', 'group');
                figureEl.setAttribute('aria-label', `Visual figure: ${cleanAlt}`);

                figureEl.innerHTML = `
                  <div class="relative overflow-hidden rounded-lg shadow-sm border border-slate-200 bg-white flex justify-center">
                    <img src="${figResult.currentSrc}" alt="${cleanAlt}" class="max-w-full h-auto" data-figure-id="${figResult.id}">
                    <button class="edit-figure-btn absolute top-2 right-2 p-2 bg-white/90 backdrop-blur shadow-lg rounded-lg opacity-0 group-hover/fig:opacity-100 transition-all hover:bg-purdue hover:text-black" data-figure-id="${figResult.id}" title="Edit Figure">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                  </div>
                  <figcaption class="mt-4 text-sm text-slate-700 font-sans text-center italic leading-relaxed" aria-hidden="true">
                    Figure: ${displayAlt}
                  </figcaption>
                `;

                targetImg.replaceWith(figureEl);
              }
            });

            finalHtml = doc.body.innerHTML;
          }

          updatePageProgress(pageNum, 'auditing', 'Accessibility audit & repair');
          const repaired = await auditAndRepairHtml(finalHtml, pageNum);
          finalHtml = repaired.html;

          results[i] = {
            html: finalHtml,
            pageNumber: pageNum,
            width: pageData[i].width,
            height: pageData[i].height,
            audit: repaired.audit,
            figures: figureResults
          };

          completedPages++;
          updatePageProgress(pageNum, 'completed', 'Ready');

          setState(prev => ({
            ...prev,
            progress: Math.max(prev.progress, 20 + Math.round((completedPages / totalPages) * 78)),
            statusMessage: `Completed ${completedPages} of ${totalPages} pages...`,
            results: results.filter(r => r !== undefined).sort((a, b) => a.pageNumber - b.pageNumber)
          }));
        } catch (err: any) {
          console.error(`Error processing page ${pageNum}:`, err);
          updatePageProgress(pageNum, 'error', err.message || 'Error occurred');
          throw err;
        }
      };

      // Worker pool for concurrency
      let nextIndex = 0;
      const worker = async () => {
        while (nextIndex < totalPages) {
          const indexToProcess = nextIndex++;
          await processSinglePage(indexToProcess);
        }
      };

      const activeWorkers = Math.min(concurrencyLimit, totalPages);
      const workerPromises = Array.from({ length: activeWorkers }, () => worker());
      await Promise.all(workerPromises);

      // Whole-document harmonization pass: clean cross-page banners, deduplicate slide headers
      setState(prev => ({
        ...prev,
        statusMessage: 'Harmonizing document structure and running final accessibility review...'
      }));

      const sortedResults = results.filter(Boolean).sort((a, b) => a.pageNumber - b.pageNumber);
      const docTitleHeading = new DOMParser().parseFromString(sortedResults[0]?.html || '', 'text/html').querySelector('h1, h2');
      const mainDocTitle = docTitleHeading?.textContent?.trim() || '';

      const harmonizedResults = await Promise.all(sortedResults.map(async (r, idx) => {
        const pageParser = new DOMParser();
        const pageDoc = pageParser.parseFromString(r.html, 'text/html');

        // On continuation pages (idx > 0), only remove exact duplicate repeats of the main document title
        if (idx > 0 && mainDocTitle) {
          pageDoc.body.querySelectorAll('h1, h2').forEach(heading => {
            const headingText = heading.textContent?.trim() || '';
            const isExactTitleRepeat = headingText.toLowerCase().replace(/[^a-z0-9]/g, '') === mainDocTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
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

        const html = pageDoc.body.innerHTML;
        return {
          ...r,
          html,
          audit: html === r.html ? r.audit : await runAccessibilityAudit(html, { requireH1: idx === 0 })
        };
      }));

      const totalTime = Math.floor((Date.now() - startTime) / 1000);

      setState(prev => ({
        ...prev,
        isProcessing: false,
        statusMessage: 'Digitization complete. Review the accessibility reports before sharing.',
        progress: 100,
        totalTime,
        activeConcurrencyCount: 0,
        results: harmonizedResults
      }));
    } catch (err: any) {
      let userMessage = "An unexpected error occurred during digitization.";
      let workaround = "Please try refreshing the page or uploading a smaller file.";

      const errMsg = err.message?.toLowerCase() || "";

      if (errMsg.includes("quota") || errMsg.includes("rate limit") || errMsg.includes("429")) {
        userMessage = "High Traffic Detected (Rate Limit).";
        workaround = "We're processing many requests right now. Please wait 60 seconds and try again.";
      } else if (errMsg.includes("safety") || errMsg.includes("blocked")) {
        userMessage = "Content Restricted by Safety Filter.";
        workaround = "The AI was unable to process this page due to safety guidelines. Please ensure the content is strictly educational and clear.";
      } else if (errMsg.includes("output") || errMsg.includes("token") || errMsg.includes("cut off")) {
        userMessage = "Page Too Complex to Process.";
        workaround = "This page has a lot of content. Try splitting it into two separate images or scans for better results.";
      } else if (errMsg.includes("upstream llm") || errMsg.includes("closed the connection") || errMsg.includes("closed the socket") || errMsg.includes("fetch failed")) {
        userMessage = "LLM Server Connection Issue.";
        workaround = "The model server connection dropped or returned an unreadable response. Check the LLM server/proxy logs for the failed page and try again.";
      } else if (errMsg.includes("network")) {
        userMessage = "Network Connection Issue.";
        workaround = "Please check your connection and try again.";
      }

      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: `${userMessage}|${workaround}`,
        statusMessage: 'Error',
        activeConcurrencyCount: 0
      }));
    }
  };

  const handleRefineMath = async (activeTab: number) => {
    if (state.results.length === 0) return;
    setIsRefining(true);
    try {
      const page = state.results[activeTab];
      const { html: refinedHtml } = await refineLatex(page.html);
      incrementUsage();
      const repaired = await auditAndRepairHtml(refinedHtml, page.pageNumber);

      const newResults = [...state.results];
      newResults[activeTab] = { ...page, html: repaired.html, audit: repaired.audit };
      setState(prev => ({ ...prev, results: newResults }));
    } catch (err) {
      console.error('Manual refinement failed:', err);
      alert('Failed to refine math on this page.');
    } finally {
      setIsRefining(false);
    }
  };

  const saveEditedFigures = (updates: { figureId: string, pageIndex: number, newSrc: string, newAlt?: string }[]) => {
    setState(prev => {
      const newResults = [...prev.results];

      updates.forEach(({ figureId, pageIndex, newSrc, newAlt }) => {
        const page = { ...newResults[pageIndex] };
        const figureIndex = page.figures.findIndex(f => f.id === figureId);

        if (figureIndex !== -1) {
          const newFigures = [...page.figures];
          const updatedFig = { ...newFigures[figureIndex], currentSrc: newSrc };
          if (newAlt !== undefined) updatedFig.alt = newAlt;
          newFigures[figureIndex] = updatedFig;
          page.figures = newFigures;

          const parser = new DOMParser();
          const doc = parser.parseFromString(page.html, 'text/html');
          const img = doc.querySelector(`img[data-figure-id="${figureId}"]`);
          const figure = img?.closest('figure');

          if (img && figure) {
            const cleanAlt = cleanAltText(newAlt || updatedFig.alt);
            img.setAttribute('src', newSrc);
            img.setAttribute('alt', cleanAlt);
            figure.setAttribute('aria-label', `Visual figure: ${cleanAlt}`);

            let figcaption = figure.querySelector('figcaption');
            if (!figcaption) {
              figcaption = doc.createElement('figcaption');
              figure.appendChild(figcaption);
            }
            figcaption.innerHTML = `Figure: ${newAlt || updatedFig.alt}`;

            page.html = doc.body.innerHTML;
            page.audit = undefined;
          }
          newResults[pageIndex] = page;
        }
      });

      return { ...prev, results: newResults };
    });
  };

  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      progress: 0,
      results: [],
      error: null,
      statusMessage: 'Waiting for upload...',
      sessionRequestCount: 0,
      dailyRequestCount: state.dailyRequestCount, // Keep daily count
      docSummary: null,
      topicKeyword: null,
      pageProgress: [],
      activeConcurrencyCount: 0
    });
    setOriginalFile(null);
    setElapsedTime(0);
    setIsRefining(false);
  }, [state.dailyRequestCount]);

  return {
    state,
    elapsedTime,
    originalFile,
    isRefining,
    handleFileUpload,
    handleRefineMath,
    saveEditedFigures,
    incrementUsage,
    reset
  };
};
