import axe from 'axe-core';
import { AccessibilityAudit, AccessibilityViolation, TableIssue } from '../types';
import { mathSourceIssues } from './modelJson';

export interface AuditOptions {
  requireH1?: boolean;
}

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
  if (headings.length === 0) return;

  let lastLevel = 0;
  headings.forEach((heading) => {
    const currentLevel = Number(heading.tagName.slice(1));
    const nextLevel = lastLevel === 0 ? currentLevel : Math.min(currentLevel, lastLevel + 1);
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
    if (!img.hasAttribute('alt')) img.setAttribute('alt', `Mathematical figure ${index + 1}; description requires review.`);
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

const normalizeGeneratedMathText = (html: string): string => html
  .replace(/\uFB00/g, 'ff')
  .replace(/\uFB01/g, 'fi')
  .replace(/\uFB02/g, 'fl')
  .replace(/\uFB03/g, 'ffi')
  .replace(/\uFB04/g, 'ffl');

const fixUnbalancedParenthesesInHeadings = (doc: Document) => {
  doc.body.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
    let html = h.innerHTML;
    if (!/^\s*\(/i.test(html) && /\\\([^)]*\\\)\s*pts\)/i.test(html)) {
      html = html.replace(/(?<!\()\s*(\\\([^)]*\\\)\s*pts\))/gi, ' ($1');
      h.innerHTML = html;
    }
  });
};

const removeSlideArtifacts = (doc: Document) => {
  doc.body.querySelectorAll('p').forEach(p => {
    const text = p.textContent?.trim() || '';
    if (/^(?:page|slide)?\s*\d{1,3}$/i.test(text) && !p.querySelector('img, svg, a, table, button, input')) {
      p.remove();
    } else if (text === '' && !p.querySelector('img, svg, a, table, button, input')) {
      p.remove();
    }
  });
};

const ensureValidTableStructure = (doc: Document) => {
  doc.body.querySelectorAll('table').forEach((table, index) => {
    // 1. Ensure <caption> exists
    if (!table.querySelector('caption')) {
      const caption = doc.createElement('caption');
      // Look for a preceding paragraph or header mentioning table/matrix/truth
      const prevEl = table.previousElementSibling;
      const prevText = prevEl?.textContent?.trim() || '';
      if (prevText && (prevText.toLowerCase().includes('table') || prevText.toLowerCase().includes('matrix') || prevText.toLowerCase().includes('training set'))) {
        caption.textContent = prevText.slice(0, 100);
      } else {
        const headerTexts = Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim()).filter(Boolean);
        caption.textContent = headerTexts.length > 0 
          ? `Data table with columns: ${headerTexts.slice(0, 3).join(', ')}`
          : `Mathematical data table ${index + 1}`;
      }
      table.prepend(caption);
    }

    // 2. Ensure <thead>, <tbody>, and valid <th> headers exist
    let thead = table.querySelector('thead');
    let tbody = table.querySelector('tbody');

    // Promote a leading all-<th> row to <thead> when <thead> is missing
    if (!thead) {
      const firstRow = table.querySelector(':scope > tr') || tbody?.querySelector(':scope > tr');
      if (firstRow && firstRow.querySelector('th') && !firstRow.querySelector('td')) {
        thead = doc.createElement('thead');
        thead.appendChild(firstRow);
        const caption = table.querySelector('caption');
        if (caption) {
          caption.after(thead);
        } else {
          table.prepend(thead);
        }
      }
    }

    // 3. Ensure <tbody> exists and contains all non-thead data rows
    if (!tbody) {
      tbody = doc.createElement('tbody');
      const directRows = Array.from(table.querySelectorAll(':scope > tr'));
      directRows.forEach(tr => {
        tbody!.appendChild(tr);
      });
      if (tbody.children.length > 0) {
        table.appendChild(tbody);
      }
    }

    // Convert <td> inside <thead> to <th> if no <th> exists in <thead>
    if (thead && !thead.querySelector('th')) {
      thead.querySelectorAll('td').forEach(td => {
        const th = doc.createElement('th');
        th.innerHTML = td.innerHTML;
        Array.from(td.attributes).forEach(attr => th.setAttribute(attr.name, attr.value));
        td.replaceWith(th);
      });
    }

    // Synthesize positional column headers for headerless tables (e.g. matrices/grids)
    if (!table.querySelector('th')) {
      const allRows = Array.from(table.querySelectorAll('tr'));
      const colCount = Math.max(
        1,
        ...allRows.map(tr =>
          Array.from(tr.children)
            .filter(cell => cell.tagName === 'TD' || cell.tagName === 'TH')
            .reduce((sum, cell) => sum + Math.max(1, parseInt(cell.getAttribute('colspan') || '1', 10) || 1), 0)
        )
      );
      if (!thead) {
        thead = doc.createElement('thead');
        const caption = table.querySelector('caption');
        if (caption) {
          caption.after(thead);
        } else {
          table.prepend(thead);
        }
      }
      const headerRow = doc.createElement('tr');
      for (let c = 0; c < colCount; c++) {
        const th = doc.createElement('th');
        th.setAttribute('scope', 'col');
        th.textContent = `Column ${c + 1}`;
        headerRow.appendChild(th);
      }
      thead.appendChild(headerRow);
    }

    const headerCols: string[] = [];
    if (thead) {
      thead.querySelectorAll('th').forEach((th, thIdx) => {
        if (!th.getAttribute('scope')) th.setAttribute('scope', 'col');
        if (!th.textContent?.trim()) th.textContent = `Column ${thIdx + 1}`;
        headerCols[thIdx] = th.textContent.trim();
      });
    }

    if (tbody) {
      tbody.querySelectorAll('tr').forEach((tr, rIdx) => {
        tr.querySelectorAll('th').forEach(th => {
          if (!th.getAttribute('scope')) th.setAttribute('scope', 'row');
          if (!th.textContent?.trim()) th.textContent = `Row ${rIdx + 1}`;
        });
      });
    }

    // 4. Ensure table is wrapped in .table-wrap for horizontal accessibility
    const parent = table.parentElement;
    if (!parent || !parent.classList.contains('table-wrap')) {
      const wrapper = doc.createElement('div');
      wrapper.className = 'table-wrap';
      table.replaceWith(wrapper);
      wrapper.appendChild(table);
    }

    // 5. Ensure <tbody> contains data cells with accessible fallback for blank worksheet/exam tables
    if (tbody) {
      const rows = Array.from(tbody.querySelectorAll('tr'));
      if (rows.length === 0) {
        const colCount = Math.max(1, headerCols.length || 1);
        const tr = doc.createElement('tr');
        for (let c = 0; c < colCount; c++) {
          const td = doc.createElement('td');
          const colLabel = headerCols[c] || `Column ${c + 1}`;
          td.innerHTML = `<span class="sr-only">Blank response for ${colLabel}: </span>[ &nbsp;&nbsp;&nbsp;&nbsp; ]`;
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      } else {
        rows.forEach(tr => {
          const cells = Array.from(tr.querySelectorAll('td'));
          cells.forEach((td, cIdx) => {
            const text = td.textContent?.trim() || '';
            const hasChildEl = td.querySelector('input, textarea, select, button, img, svg, math, mjx-container, a, span') !== null;
            if (!text && !hasChildEl) {
              const colLabel = headerCols[cIdx] || `Column ${cIdx + 1}`;
              td.innerHTML = `<span class="sr-only">Blank response for ${colLabel}: </span>[ &nbsp;&nbsp;&nbsp;&nbsp; ]`;
            }
          });
        });
      }
    }
  });
};

export const detectTableIssues = (html: string): TableIssue[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tables = Array.from(doc.querySelectorAll('table'));
  const issues: TableIssue[] = [];

  tables.forEach((table, index) => {
    const tbody = table.querySelector('tbody');
    const rows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];

    const hasRows = rows.length > 0;
    const hasContent = hasRows && rows.some(tr => {
      const cells = Array.from(tr.querySelectorAll('td, th'));
      return cells.some(cell => {
        const text = cell.textContent?.trim() || '';
        const hasInteractiveOrMedia = cell.querySelector('input, textarea, select, button, img, svg, math, mjx-container, a') !== null;
        return text.length > 0 || hasInteractiveOrMedia;
      });
    });

    if (!hasRows || !hasContent) {
      const captionText = table.querySelector('caption')?.textContent?.trim() || `Table ${index + 1}`;
      issues.push({
        tableIndex: index,
        caption: captionText,
        htmlSnippet: table.outerHTML.slice(0, 400),
        reason: 'Table <tbody> is missing or contains no data cells with content (unfilled worksheet or quiz table).'
      });
    }
  });

  return issues;
};

export const sanitizeGeneratedHtml = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(normalizeGeneratedMathText(html), 'text/html');

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement?.closest('code, pre, script, style, textarea')) continue;
    node.textContent = (node.textContent || '').replace(/(?<!\\)\\\[[\s\S]*?\\\]|(?<!\\)\\\([\s\S]*?\\\)/g,
      math => math.replace(/\\\\(\s*)\[(?!\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:pt|em|ex|cm|mm|in|pc|px|mu)\s*\])/g, '\\\\\\relax$1['));
  }

  removeSlideArtifacts(doc);
  fixUnbalancedParenthesesInHeadings(doc);
  ensureValidTableStructure(doc);
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

const buildCustomChecks = (html: string, { requireH1 = true }: AuditOptions = {}) => {
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

  const allImagesHaveAlt = images.every(img => img.hasAttribute('alt')
    && !/description requires review/i.test(img.getAttribute('alt') || ''));
  const hasH1 = headings.some(h => h.tagName === 'H1');
  const validHeadings = headingOrderValid && (!requireH1 || (hasH1 && headings[0]?.tagName === 'H1'));
  const mathIssues = mathSourceIssues(html);
  const hasLandmarks = doc.querySelector('article, section, main, nav, header, footer') !== null;
  const hasUnsafeColor = /style=["'][^"']*(?:color\s*:|background(?:-color)?\s*:)/i.test(html);
  const hasLowContrastClasses = LOW_CONTRAST_CLASSES.some(className => html.includes(className));

  const tables = Array.from(doc.querySelectorAll('table'));
  const allTablesHaveBodyContent = tables.every(table => {
    const tbody = table.querySelector('tbody');
    const rows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
    if (rows.length === 0) return false;
    return rows.some(tr => {
      const cells = Array.from(tr.querySelectorAll('td, th'));
      return cells.some(cell => {
        const text = cell.textContent?.trim() || '';
        const hasInteractiveOrMedia = cell.querySelector('input, textarea, select, button, img, svg, math, mjx-container, a, span') !== null;
        return text.length > 0 || hasInteractiveOrMedia;
      });
    });
  });

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
      description: 'Images need alternative text; decorative images may have an empty alt. Placeholder descriptions require review.',
      suggestion: allImagesHaveAlt ? undefined : 'Add descriptive alt text to every generated figure.'
    },
    {
      title: 'Heading Order (1.3.1)',
      passed: validHeadings,
      description: 'The document starts with h1; continuation pages may begin at a lower level or have no heading.',
      suggestion: validHeadings ? undefined : 'Normalize heading levels without inventing headings for continuation pages.'
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
    },
    {
      title: 'Math source integrity',
      passed: mathIssues.length === 0,
      description: 'TeX delimiters and backslash encoding should survive JSON decoding.',
      suggestion: mathIssues.length ? mathIssues.join(' ') : undefined
    },
    {
      title: 'Table header text',
      passed: tables.every(table => {
        const headers = Array.from(table.querySelectorAll('th'));
        return headers.length > 0 && headers.every(th => Boolean(th.textContent?.trim()));
      }),
      description: 'Tables must have at least one header cell (<th>) and all header cells must contain meaningful text.',
      suggestion: 'Label matrix columns by position (<th scope="col">Column 1</th>, ...), or ensure existing header cells are non-empty.'
    },
    {
      title: 'Table Integrity (1.3.1)',
      passed: allTablesHaveBodyContent,
      description: 'Tables must include <tbody> with data cells, form controls, or non-empty placeholders.',
      suggestion: allTablesHaveBodyContent ? undefined : 'Add data, accessible placeholders, or input fields to empty table bodies.'
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

// Each audit owns a browsing context and axe instance. Parallel conversions
// cannot collide with axe._running, duplicate IDs in the app, or offscreen
// element geometry (the content is at 0,0 within the iframe viewport).
export const runAccessibilityAudit = async (html: string, options: AuditOptions = {}): Promise<AccessibilityAudit> => {
  const frame = document.createElement('iframe');
  frame.title = 'Temporary accessibility audit';
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = 'position:absolute;left:-12000px;top:0;width:1000px;height:900px;border:0;';
  document.body.appendChild(frame);

  const bounded = <T,>(promise: Promise<T>, label: string): Promise<T> => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), 15000);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });

  try {
    const doc = frame.contentDocument!;
    const view = frame.contentWindow as Window & { axe: typeof axe };
    doc.documentElement.lang = document.documentElement.lang || 'en';
    doc.title = 'Generated page accessibility audit';
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(style => {
      const clone = style.cloneNode(true) as HTMLStyleElement | HTMLLinkElement;
      const ready = clone instanceof HTMLLinkElement
        ? new Promise<void>((resolve, reject) => {
          clone.onload = () => resolve();
          clone.onerror = () => reject(new Error('Audit stylesheet failed to load'));
        }) : Promise.resolve();
      doc.head.appendChild(clone);
      return ready;
    });
    // Match the white preview surface; inherited application UI classes must
    // not change generated content colors.
    doc.body.style.cssText = 'margin:0;background:white;color:black;';
    const container = doc.createElement('main');
    container.className = 'math-content';
    container.innerHTML = html;
    doc.body.appendChild(container);
    const checks: AccessibilityAudit['checks'] = buildCustomChecks(html, options);
    const manualReview = [
      'Automated tools cannot verify mathematical correctness.',
      'Automated tools cannot fully verify whether figure alt text is educationally complete.',
      'This report covers a page in the preview styles, not the separately styled exported document.'
    ];

    try {
      await bounded(Promise.all(styles), 'Audit styles');
      await bounded(doc.fonts.ready, 'Audit fonts');
      await bounded(Promise.all(Array.from(container.querySelectorAll('img')).map(img =>
        img.decode().catch(() => undefined))), 'Audit images');
    } catch (error) {
      checks.push({ title: 'Audit resources', passed: false, repairable: false,
        description: String(error), suggestion: 'Load the preview styles and resources, then run the audit again.' });
    }

    if (/\\[([]/.test(container.textContent || '')) {
      try {
        const source = document.querySelector<HTMLScriptElement>('#MathJax-script')?.src;
        if (!source) throw new Error('MathJax script is unavailable');
        const config = doc.createElement('script');
        config.textContent = `window.MathJax = {
          loader: { load: ['[tex]/textmacros'] },
          tex: { packages: { '[+]': ['textmacros'] }, inlineMath: [['\\\\(', '\\\\)']], displayMath: [['\\\\[', '\\\\]']], processEscapes: true },
          options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'code', 'pre'] },
          startup: { typeset: false }
        };`;
        doc.head.appendChild(config);
        const script = doc.createElement('script');
        script.src = source;
        await bounded(new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('MathJax failed to load'));
          doc.head.appendChild(script);
        }), 'MathJax load');
        const mathJax = (view as any).MathJax;
        await bounded(Promise.resolve(mathJax.startup.promise), 'MathJax startup');
        await bounded(mathJax.typesetPromise([container]), 'MathJax rendering');
        await bounded(doc.fonts.ready, 'MathJax fonts');
        const errors = Array.from(container.querySelectorAll('[data-mjx-error], mjx-merror, merror'));
        checks.push({ title: 'Math rendering', passed: errors.length === 0,
          description: 'MathJax typeset the generated math before the accessibility scan.',
          suggestion: errors.length ? errors.map(el => el.getAttribute('data-mjx-error') || el.textContent).join('; ') : undefined });
      } catch (error) {
        checks.push({ title: 'Math rendering', passed: false, repairable: false,
          description: String(error), suggestion: 'Restore MathJax loading and rerun the audit; math rendering was not verified.' });
      }
    }

    const script = doc.createElement('script');
    script.textContent = axe.source;
    doc.head.appendChild(script);
    const results = await view.axe.run(doc, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
      },
      resultTypes: ['violations', 'incomplete']
    });
    const violations = results.violations.map(toViolation);
    const incomplete = results.incomplete.map(toViolation);
    checks[0] = { ...checks[0], passed: violations.length === 0,
      suggestion: violations.length ? 'Review and repair the accessibility violations listed below.' : undefined };
    if (incomplete.length) manualReview.push('Some axe checks were incomplete and require manual review.');
    return {
      score: Math.min(scoreAudit(violations, checks), incomplete.length ? 99 : 100),
      passed: violations.length === 0 && incomplete.length === 0 && checks.every(check => check.passed),
      tool: `axe-core ${axe.version}`,
      standard: 'WCAG 2.1/2.2 Level AA automated checks',
      checks, violations, incomplete, manualReview
    };
  } finally {
    frame.remove();
  }
};
