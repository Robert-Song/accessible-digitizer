import { AccessibilityAudit } from '../types';
import { AuditOptions, runAccessibilityAudit, sanitizeGeneratedHtml } from '../utils/accessibility';
import { repairAccessibility } from './aiService';

export const needsAccessibilityRepair = (audit: AccessibilityAudit) => audit.violations.length > 0
  || audit.checks.some(check => !check.passed && check.repairable !== false);

export const auditAndRepair = async (html: string, options: AuditOptions & {
  onRepair?: (attempt: number) => void;
  onRequest?: () => void;
} = {}) => {
  let finalHtml = sanitizeGeneratedHtml(html);
  let audit = await runAccessibilityAudit(finalHtml, options);
  for (let attempt = 1; attempt <= 2 && needsAccessibilityRepair(audit); attempt++) {
    options.onRepair?.(attempt);
    try {
      const repair = await repairAccessibility(finalHtml, audit);
      options.onRequest?.();
      if (!repair.html.trim()) throw new Error('Accessibility repair returned empty HTML.');
      const candidate = sanitizeGeneratedHtml(repair.html);
      if (candidate === finalHtml) {
        audit.manualReview.push('Automatic repair made no changes; unresolved findings need review.');
        break;
      }
      // Commit HTML and report together only after a successful re-audit.
      const candidateAudit = await runAccessibilityAudit(candidate, options);
      const newViolation = candidateAudit.violations.some(v => !audit.violations.some(old => old.id === v.id && old.nodes.length >= v.nodes.length));
      const newFailure = candidateAudit.checks.some(c => !c.passed && !audit.checks.some(old => old.title === c.title && !old.passed));
      const newIncomplete = candidateAudit.incomplete.some(v => !audit.incomplete.some(old => old.id === v.id));
      if (candidateAudit.score < audit.score || newViolation || newFailure || newIncomplete) {
        audit.manualReview.push('Automatic repair introduced new findings; the previous HTML was retained.');
        break;
      }
      finalHtml = candidate;
      audit = candidateAudit;
    } catch (error) {
      console.warn('Accessibility repair failed:', error);
      audit.manualReview.push('Automatic repair failed; the last audited HTML was retained.');
      break;
    }
  }
  return { html: finalHtml, audit };
};
