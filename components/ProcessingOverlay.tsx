import React from 'react';
import { PageProgressInfo } from '../types';

interface ProcessingOverlayProps {
  progress: number;
  status: string;
  elapsedTime?: number;
  pageProgress?: PageProgressInfo[];
  activeConcurrencyCount?: number;
  docSummary?: string | null;
  topicKeyword?: string | null;
}

const formatSeconds = (seconds: number = 0) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getStatusBadge = (status: PageProgressInfo['status']) => {
  switch (status) {
    case 'completed':
      return {
        label: 'Ready',
        className: 'bg-black text-white border-black',
        icon: '✓'
      };
    case 'converting':
      return {
        label: 'Vision OCR',
        className: 'bg-blue-50 text-blue-800 border-blue-600 animate-pulse',
        icon: null
      };
    case 'cropping':
      return {
        label: 'Figures',
        className: 'bg-amber-50 text-amber-800 border-amber-600 animate-pulse',
        icon: null
      };
    case 'auditing':
    case 'repairing':
      return {
        label: 'WCAG Audit',
        className: 'bg-purple-50 text-purple-800 border-purple-600 animate-pulse',
        icon: null
      };
    case 'error':
      return {
        label: 'Error',
        className: 'bg-red-50 text-red-800 border-red-600',
        icon: '✕'
      };
    case 'pending':
    default:
      return {
        label: 'Queued',
        className: 'bg-neutral-100 text-neutral-600 border-neutral-300',
        icon: null
      };
  }
};

const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({
  progress,
  status,
  elapsedTime = 0,
  pageProgress = [],
  activeConcurrencyCount = 0,
  docSummary,
  topicKeyword
}) => {
  const totalPages = pageProgress.length;
  const completedPages = pageProgress.filter(p => p.status === 'completed').length;
  const inFlightCount = activeConcurrencyCount || pageProgress.filter(p =>
    ['converting', 'cropping', 'auditing', 'repairing'].includes(p.status)
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
      <section className="w-full max-w-2xl border border-black bg-white p-6 sm:p-8 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black pb-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-600">AccessDocs / Parallel Digitizer</p>
            <h2 className="text-2xl font-bold text-black">Processing Document</h2>
          </div>
          <div className="flex items-center gap-3">
            {inFlightCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black bg-neutral-900 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                {inFlightCount} page{inFlightCount > 1 ? 's' : ''} in parallel
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-neutral-300 bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
                Finalizing
              </span>
            )}
            <span className="font-mono text-xs font-semibold text-neutral-600 bg-neutral-100 border border-neutral-300 px-2.5 py-1 rounded">
              {formatSeconds(elapsedTime)}
            </span>
          </div>
        </div>

        {/* Overall Status & Progress */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-neutral-800 truncate max-w-[75%]" title={status}>
              {status}
            </span>
            <span className="font-mono font-bold text-black">{Math.round(progress)}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden border border-black bg-neutral-100 p-0.5">
            <div
              className="h-full bg-black transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* User Topic & Global Document Context Banner */}
        {(topicKeyword || docSummary) && (
          <div className="mt-5 space-y-2 border-l-2 border-black bg-neutral-50 p-3.5 text-xs text-neutral-800">
            {topicKeyword && (
              <div className="flex items-start gap-2">
                <span className="font-bold uppercase tracking-wider text-black flex-shrink-0">Topic:</span>
                <span className="font-medium text-neutral-900">{topicKeyword}</span>
              </div>
            )}
            {docSummary && (
              <div className="flex items-start gap-2">
                <span className="font-bold uppercase tracking-wider text-black flex-shrink-0">Document Context:</span>
                <span className="italic text-neutral-700 leading-relaxed">{docSummary}</span>
              </div>
            )}
          </div>
        )}

        {/* Multi-Page Concurrency Flow Grid */}
        {totalPages > 0 && (
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-mono text-xs uppercase tracking-widest text-neutral-600">
                Live Page Execution Stream ({completedPages}/{totalPages} Done)
              </h3>
              {inFlightCount > 0 && (
                <span className="text-xs text-neutral-500">
                  Active concurrency: <strong className="text-black">{inFlightCount} worker{inFlightCount > 1 ? 's' : ''}</strong>
                </span>
              )}
            </div>

            <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 grid-cols-1 sm:grid-cols-2">
              {pageProgress.map(page => {
                const badge = getStatusBadge(page.status);
                const isActive = ['converting', 'cropping', 'auditing', 'repairing'].includes(page.status);

                return (
                  <div
                    key={page.pageNumber}
                    className={`flex items-center justify-between border p-2.5 text-xs transition-colors ${
                      isActive
                        ? 'border-black bg-neutral-50 ring-1 ring-black'
                        : page.status === 'completed'
                        ? 'border-neutral-300 bg-white'
                        : 'border-neutral-200 bg-neutral-50 opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="font-bold text-black flex-shrink-0">P.{page.pageNumber}</span>
                      <span className="truncate text-neutral-600 text-[11px]" title={page.statusMessage || badge.label}>
                        {page.statusMessage || badge.label}
                      </span>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] font-semibold ${badge.className}`}>
                      {badge.icon && <span>{badge.icon}</span>}
                      <span>{badge.label}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pipeline Phase List */}
        <div className="mt-6 border-t border-neutral-200 pt-4">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className={`p-2 border ${progress >= 10 ? 'border-black bg-black text-white font-semibold' : 'border-neutral-200 text-neutral-400'}`}>
              1. Extract & Context
            </div>
            <div className={`p-2 border ${progress >= 30 ? 'border-black bg-black text-white font-semibold' : 'border-neutral-200 text-neutral-400'}`}>
              2. Vision AI Transcribe
            </div>
            <div className={`p-2 border ${progress >= 85 ? 'border-black bg-black text-white font-semibold' : 'border-neutral-200 text-neutral-400'}`}>
              3. WCAG AA Audit & Fix
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ProcessingOverlay;
