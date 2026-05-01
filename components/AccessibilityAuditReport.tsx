import React from 'react';
import { AppState, AccessibilityViolation, ConversionResult } from '../types';

interface AccessibilityAuditReportProps {
  results: ConversionResult[];
  activeTab: number;
  state: AppState;
  onClose: () => void;
}

const groupByImpact = (violations: AccessibilityViolation[]) => {
  return violations.reduce<Record<string, AccessibilityViolation[]>>((groups, violation) => {
    const key = violation.impact || 'review';
    groups[key] = groups[key] || [];
    groups[key].push(violation);
    return groups;
  }, {});
};

const AccessibilityAuditReport: React.FC<AccessibilityAuditReportProps> = ({ results, activeTab, state, onClose }) => {
  const activeAudit = results[activeTab]?.audit;
  const groupedViolations = groupByImpact(activeAudit?.violations || []);
  const groupedIncomplete = groupByImpact(activeAudit?.incomplete || []);
  const impactOrder = ['critical', 'serious', 'moderate', 'minor', 'review'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden border-2 border-zinc-900 bg-white shadow-[12px_12px_0_#18181b]">
        <button
          onClick={onClose}
          className="absolute right-6 top-6 z-10 border border-zinc-300 bg-white px-3 py-2 font-mono text-xs font-black uppercase tracking-widest text-zinc-500 hover:border-zinc-900 hover:text-zinc-900"
          aria-label="Close accessibility report"
        >
          esc
        </button>

        <div className="border-b-2 border-zinc-900 p-8 pr-24">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center border-2 border-zinc-900 bg-zinc-950 text-teal-300 shadow-[4px_4px_0_#14b8a6]">
              <span className="font-mono text-lg font-black">AA</span>
            </div>
            <div>
              <h2 className="font-mono text-3xl font-black tracking-tight text-zinc-950">audit.report</h2>
              <p className="text-sm font-medium text-zinc-500">
                {activeAudit?.tool || 'axe-core'} / {activeAudit?.standard || 'WCAG automated checks'} / page {activeTab + 1}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <div className="mb-2 flex justify-between font-mono text-xs font-black uppercase tracking-widest">
                <span className="text-zinc-900">automated score</span>
                <span className={activeAudit?.passed ? 'text-teal-700' : 'text-amber-700'}>{activeAudit?.score ?? 0}%</span>
              </div>
              <div className="h-3 w-full bg-zinc-200">
                <div
                  className={`h-full ${activeAudit?.passed ? 'bg-teal-500' : 'bg-amber-500'}`}
                  style={{ width: `${activeAudit?.score || 0}%` }}
                />
              </div>
            </div>
            <div className={`border px-4 py-3 font-mono text-xs font-black uppercase tracking-widest ${activeAudit?.passed ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-amber-500 bg-amber-50 text-amber-700'}`}>
              {activeAudit?.passed ? 'no automated violations' : 'review required'}
            </div>
          </div>

          {state.totalTime && (
            <div className="mt-5 flex flex-wrap gap-3 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              <span>time: {state.totalTime}s</span>
              <span>requests: {state.sessionRequestCount}</span>
              <span>daily: {state.dailyRequestCount}</span>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto p-8">
          <section>
            <h3 className="mb-4 font-mono text-xs font-black uppercase tracking-widest text-zinc-400">summary checks</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {activeAudit?.checks.map((check, idx) => (
                <div key={idx} className={`border p-4 ${check.passed ? 'border-zinc-200 bg-zinc-50' : 'border-amber-300 bg-amber-50'}`}>
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h4 className="font-mono text-sm font-black text-zinc-900">{check.title}</h4>
                    <span className={`px-2 py-1 font-mono text-[10px] font-black uppercase ${check.passed ? 'bg-teal-100 text-teal-700' : 'bg-amber-200 text-amber-800'}`}>
                      {check.passed ? 'pass' : 'fail'}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-zinc-500">{check.description}</p>
                  {!check.passed && check.suggestion && <p className="mt-3 text-sm font-medium text-amber-800">{check.suggestion}</p>}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-4 font-mono text-xs font-black uppercase tracking-widest text-zinc-400">axe violations</h3>
            {activeAudit?.violations.length === 0 ? (
              <div className="border border-zinc-200 bg-zinc-50 p-6">
                <p className="font-mono font-black text-zinc-800">No automated WCAG AA violations found.</p>
                <p className="mt-2 text-sm text-zinc-500">Math accuracy and alt-text usefulness still need human review.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {impactOrder.filter(impact => groupedViolations[impact]).map(impact => (
                  <div key={impact}>
                    <h4 className="mb-3 font-mono text-[10px] font-black uppercase tracking-widest text-zinc-500">{impact} impact</h4>
                    <div className="space-y-3">
                      {groupedViolations[impact].map(violation => (
                        <div key={violation.id} className="border border-amber-300 bg-amber-50/70 p-4">
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <div>
                              <h5 className="font-mono text-sm font-black text-zinc-900">{violation.id}: {violation.help}</h5>
                              <p className="mt-1 text-sm text-zinc-600">{violation.description}</p>
                            </div>
                            {violation.helpUrl && (
                              <a href={violation.helpUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] font-black uppercase tracking-widest text-teal-700">
                                rule
                              </a>
                            )}
                          </div>
                          <div className="space-y-2">
                            {violation.nodes.slice(0, 4).map((node, idx) => (
                              <div key={idx} className="border border-amber-200 bg-white p-3">
                                <p className="font-mono text-[10px] font-black uppercase tracking-widest text-zinc-400">target</p>
                                <p className="break-all font-mono text-[11px] text-zinc-700">{node.target.join(', ')}</p>
                                {node.failureSummary && <p className="mt-2 whitespace-pre-wrap text-xs text-zinc-500">{node.failureSummary}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {(activeAudit?.incomplete.length || 0) > 0 && (
            <section>
              <h3 className="mb-4 font-mono text-xs font-black uppercase tracking-widest text-zinc-400">incomplete checks</h3>
              <div className="space-y-3">
                {Object.keys(groupedIncomplete).map(impact => groupedIncomplete[impact].map(violation => (
                  <div key={violation.id} className="border border-zinc-200 bg-zinc-50 p-4">
                    <h4 className="font-mono text-sm font-black text-zinc-900">{violation.id}: {violation.help}</h4>
                    <p className="mt-1 text-sm text-zinc-500">{violation.description}</p>
                  </div>
                )))}
              </div>
            </section>
          )}

          <section className="border border-zinc-200 bg-zinc-50 p-6">
            <h3 className="mb-3 font-mono text-xs font-black uppercase tracking-widest text-zinc-900">manual review</h3>
            <ul className="space-y-2">
              {(activeAudit?.manualReview || []).map(item => (
                <li key={item} className="text-sm leading-6 text-zinc-500">{item}</li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex justify-end border-t-2 border-zinc-900 bg-zinc-50 p-6">
          <button onClick={onClose} className="bg-zinc-950 px-6 py-3 font-mono text-sm font-black uppercase tracking-widest text-teal-300 hover:bg-zinc-800">
            close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccessibilityAuditReport;
