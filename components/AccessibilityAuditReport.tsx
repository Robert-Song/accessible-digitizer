import React from 'react';
import { AccessibilityViolation, AppState, ConversionResult } from '../types';

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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white p-4">
      <section className="mx-auto max-w-5xl border border-black bg-white">
        <header className="flex items-start justify-between gap-6 border-b border-black p-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-600">axe-core report</p>
            <h2 className="mt-1 text-3xl font-semibold text-black">Accessibility audit</h2>
            <p className="mt-2 text-sm text-neutral-700">
              {activeAudit?.tool || 'axe-core'} / {activeAudit?.standard || 'WCAG automated checks'} / page {activeTab + 1}
            </p>
            {state.totalTime && (
              <p className="mt-2 font-mono text-xs text-neutral-600">
                time {state.totalTime}s / requests {state.sessionRequestCount} / daily {state.dailyRequestCount}
              </p>
            )}
          </div>
          <button onClick={onClose} className="border border-black bg-white px-3 py-2 text-sm hover:bg-neutral-100">
            close
          </button>
        </header>

        <div className="border-b border-black p-5">
          <div className="mb-2 flex justify-between text-sm">
            <span>automated score</span>
            <strong>{activeAudit?.score ?? 0}%</strong>
          </div>
          <div className="h-4 border border-black">
            <div className="h-full bg-black" style={{ width: `${activeAudit?.score || 0}%` }} />
          </div>
          <p className="mt-3 text-sm text-neutral-700">
            {activeAudit?.passed ? 'No automated WCAG AA violations found.' : 'Some automated checks still need review.'}
          </p>
        </div>

        <main className="space-y-8 p-5">
          <section>
            <h3 className="mb-3 border-b border-black pb-2 text-xl font-semibold">Summary checks</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {activeAudit?.checks.map(check => (
                <article key={check.title} className="border border-black p-4">
                  <p className="mb-1 font-mono text-xs">{check.passed ? '[x]' : '[ ]'} {check.title}</p>
                  <p className="text-sm leading-6 text-neutral-700">{check.description}</p>
                  {!check.passed && check.suggestion && (
                    <p className="mt-2 text-sm text-black">Fix: {check.suggestion}</p>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 border-b border-black pb-2 text-xl font-semibold">Axe violations</h3>
            {activeAudit?.violations.length === 0 ? (
              <p className="border border-black p-4 text-sm">No automated WCAG AA violations found. Math accuracy and alt text quality still need human review.</p>
            ) : (
              <div className="space-y-5">
                {impactOrder.filter(impact => groupedViolations[impact]).map(impact => (
                  <section key={impact}>
                    <h4 className="mb-2 font-mono text-xs uppercase tracking-widest">{impact}</h4>
                    <div className="space-y-3">
                      {groupedViolations[impact].map(violation => (
                        <article key={violation.id} className="border border-black p-4">
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <div>
                              <h5 className="font-semibold">{violation.id}: {violation.help}</h5>
                              <p className="mt-1 text-sm text-neutral-700">{violation.description}</p>
                            </div>
                            {violation.helpUrl && (
                              <a href={violation.helpUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-4">
                                rule
                              </a>
                            )}
                          </div>
                          <div className="space-y-2">
                            {violation.nodes.slice(0, 4).map((node, index) => (
                              <pre key={index} className="overflow-auto whitespace-pre-wrap border border-neutral-400 bg-neutral-50 p-3 font-mono text-xs">
target: {node.target.join(', ')}
{node.failureSummary || ''}
                              </pre>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>

          {(activeAudit?.incomplete.length || 0) > 0 && (
            <section>
              <h3 className="mb-3 border-b border-black pb-2 text-xl font-semibold">Incomplete checks</h3>
              <div className="space-y-3">
                {Object.keys(groupedIncomplete).map(impact => groupedIncomplete[impact].map(violation => (
                  <article key={violation.id} className="border border-black p-4">
                    <h4 className="font-semibold">{violation.id}: {violation.help}</h4>
                    <p className="mt-1 text-sm text-neutral-700">{violation.description}</p>
                  </article>
                )))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-3 border-b border-black pb-2 text-xl font-semibold">Manual review</h3>
            <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-700">
              {(activeAudit?.manualReview || []).map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </main>
      </section>
    </div>
  );
};

export default AccessibilityAuditReport;
