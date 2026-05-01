import axe from 'axe-core';
import { AccessibilityAudit, AccessibilityViolation } from '../types';

const LOW_CONTRAST_CLASSES = [
  'text-slate-300',
  'text-gray-300',
  'text-zinc-300',
  'text-slate-400',
  'text-gray-400',
  'text-zinc-400'
];

const normalizeHeadingOrder = (doc: Document) => {
  const headings = Array.from(doc.body.querySelectorAll('h1, h2, h3, h4, h5, h6'));

  if (headings.length === 0) {
    const h1 = doc.createElement('h1');
    h1.textContent = 'Accessible Math Notes';
    doc.body.prepend(h1);
    return;
  }

  let lastLevel = 0;
  headings.forEach((heading, index) => {
    const currentLevel = Number(heading.tagName.slice(1));
    const nextLevel = index === 0 ? 1 : Math.min(currentLevel, lastLevel + 1);
    if (nextLevel !== currentLevel) {
      const replacement = doc.createElement(`h${nextLevel}`);
      replacement.innerHTML = heading.innerHTML;
      replacement.setAttribute('class', heading.getAttribute('class') || '');
      heading.replaceWith(replacement);
      lastLevel = nextLevel;
    } else {
      lastLevel = currentLevel;
    }
  });
};

const stripUnsafeStyles = (doc: Document) => {
  doc.body.querySelectorAll<HTMLElement>('[style]').forEach(el => {
    const style = el.getAttribute('style') || '';
    if (/color\s*:|background(?:-color)?\s*:/i.test(style)) {
      el.removeAttribute('style');
    }
  });
};

const stripLowContrastClasses = (doc: Document) => {
  doc.body.querySelectorAll<HTMLElement>('[class]').forEach(el => {
    const classes = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
    const cleaned = classes.filter(className => !LOW_CONTRAST_CLASSES.includes(className));
    if (cleaned.length) {
      el.setAttribute('class', cleaned.join(' '));
    } else {
      el.removeAttribute('class');
    }
  });
};

const ensureImageText = (doc: Document) => {
  doc.body.querySelectorAll<HTMLImageElement>('img').forEach((img, index) => {
    const alt = img.getAttribute('alt')?.trim();
    if (!alt) img.setAttribute('alt', `Mathematical figure ${index + 1}; description requires review.`);
  });
};

const ensureInteractiveLabels = (doc: Document) => {
  doc.body.querySelectorAll<HTMLElement>('button, a, input, select, textarea, [role="button"], [role="link"]').forEach(el => {
    const hasName = Boolean(el.textContent?.trim() || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title'));
    if (!hasName) {
      el.setAttribute('aria-label', el.tagName.toLowerCase() === 'a' ? 'Link' : 'Control');
    }
  });
};

const ensureLandmark = (doc: Document) => {
  if (doc.body.querySelector('main, article, section, nav, header, footer')) return;

  const article = doc.createElement('article');
  article.setAttribute('class', 'generated-page');
  Array.from(doc.body.childNodes).forEach(node => article.appendChild(node));
  doc.body.appendChild(article);
};

export const sanitizeGeneratedHtml = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  stripUnsafeStyles(doc);
  stripLowContrastClasses(doc);
  ensureImageText(doc);
  ensureInteractiveLabels(doc);
  normalizeHeadingOrder(doc);
  ensureLandmark(doc);

  return doc.body.innerHTML.trim();
};

const toViolation = (violation: axe.Result): AccessibilityViolation => ({
  id: violation.id,
  impact: violation.impact,
  description: violation.description,
  help: violation.help,
  helpUrl: violation.helpUrl,
  tags: violation.tags,
  nodes: violation.nodes.map(node => ({
    target: node.target.map(selector => Array.isArray(selector) ? selector.join(' ') : String(selector)),
    html: node.html,
    failureSummary: node.failureSummary
  }))
});

const buildCustomChecks = (html: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const images = Array.from(doc.querySelectorAll('img'));
  const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'));

  let headingOrderValid = true;
  let lastLevel = 0;
  for (const h of headings) {
    const level = parseInt(h.tagName[1]);
    if (level > lastLevel + 1 && lastLevel !== 0) {
      headingOrderValid = false;
      break;
    }
    lastLevel = level;
  }

  const allImagesHaveAlt = images.every(img => Boolean(img.getAttribute('alt')?.trim()));
  const hasH1 = headings.some(h => h.tagName === 'H1');
  const hasLandmarks = doc.querySelector('article, section, main, nav, header, footer') !== null;
  const hasUnsafeColor = /style=["'][^"']*(?:color\s*:|background(?:-color)?\s*:)/i.test(html);
  const hasLowContrastClasses = LOW_CONTRAST_CLASSES.some(className => html.includes(className));

  return [
    {
      title: 'Axe WCAG AA',
      passed: true,
      description: 'Automated axe-core WCAG 2.1/2.2 AA checks ran on the generated page.',
      suggestion: undefined
    },
    {
      title: 'Alt Text (1.1.1)',
      passed: allImagesHaveAlt,
      description: 'All images and figures should have non-empty alternative text.',
      suggestion: allImagesHaveAlt ? undefined : 'Add descriptive alt text to every generated figure.'
    },
    {
      title: 'Heading Order (1.3.1)',
      passed: headingOrderValid && headings.length > 0 && hasH1,
      description: 'Headings should start with h1 and avoid skipped levels.',
      suggestion: headingOrderValid && hasH1 ? undefined : 'Normalize heading levels so the document starts with h1 and proceeds sequentially.'
    },
    {
      title: 'Landmarks (1.3.1)',
      passed: hasLandmarks,
      description: 'Generated content should be organized with semantic landmarks.',
      suggestion: hasLandmarks ? undefined : 'Wrap the page content in article, section, or main.'
    },
    {
      title: 'Contrast Guard (1.4.3)',
      passed: !hasUnsafeColor && !hasLowContrastClasses,
      description: 'Generated HTML should avoid known low-contrast classes and unsafe inline colors.',
      suggestion: !hasUnsafeColor && !hasLowContrastClasses ? undefined : 'Remove unsafe inline colors and replace low-contrast classes.'
    }
  ];
};

const scoreAudit = (violations: AccessibilityViolation[], checks: { passed: boolean }[]) => {
  const impactPenalty: Record<string, number> = {
    critical: 28,
    serious: 18,
    moderate: 10,
    minor: 4
  };
  const axePenalty = violations.reduce((sum, violation) => sum + (impactPenalty[violation.impact || 'minor'] || 6), 0);
  const customPenalty = checks.filter(check => !check.passed).length * 8;
  return Math.max(0, Math.min(100, 100 - axePenalty - customPenalty));
};

export const runAccessibilityAudit = async (html: string): Promise<AccessibilityAudit> => {
  const container = document.createElement('div');
  container.className = 'math-content';
  container.setAttribute('data-audit-root', 'true');
  container.style.position = 'absolute';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '1000px';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const results = await axe.run(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
      },
      resultTypes: ['violations', 'incomplete']
    });

    const violations = results.violations.map(toViolation);
    const incomplete = results.incomplete.map(toViolation);
    const checks = buildCustomChecks(html);
    checks[0] = {
      ...checks[0],
      passed: violations.length === 0,
      suggestion: violations.length === 0 ? undefined : 'Review and repair the axe-core violations listed below.'
    };

    const manualReview = [
      'Automated tools cannot verify mathematical correctness.',
      'Automated tools cannot fully verify whether figure alt text is educationally complete.'
    ];
    if (incomplete.length > 0) {
      manualReview.push('Some axe checks were incomplete and require manual review.');
    }

    const score = scoreAudit(violations, checks);
    return {
      score,
      passed: violations.length === 0 && checks.every(check => check.passed),
      tool: `axe-core ${axe.version}`,
      standard: 'WCAG 2.1/2.2 Level AA automated checks',
      checks,
      violations,
      incomplete,
      manualReview
    };
  } finally {
    container.remove();
  }
};
