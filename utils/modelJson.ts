// JSON is the transport boundary: decode once, never guess which backslashes
// were JSON escapes versus TeX. A malformed response must be regenerated.
export class ModelResponseError extends Error {}

export const stripFences = (text: string) => text.trim()
  .replace(/^```(?:json|html)?\s*\r?\n/i, '').replace(/\r?\n?```$/, '').trim();

export const mathSourceIssues = (html: string): string[] => {
  // Code samples may intentionally contain escape sequences or TeX examples.
  const text = html.replace(/<(code|pre|script|style|textarea)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    // A TeX row break can have a legitimate optional spacing argument.
    .replace(/\\\\\[\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:pt|em|ex|cm|mm|in|pc|px|mu)\s*\]/g, '\\\\');
  const issues: string[] = [];
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)
    || /\t(?:imes|ext|heta|au|ilde|op|frac)\b|\r(?:ight|ho|angle)\b|\n(?:abla|eq|eg|u)\b/.test(text)) {
    issues.push('A JSON escape appears to have converted a TeX command into a control character.');
  }
  if (/\\{2,}[()[\]]/.test(text)) {
    issues.push('Math delimiters have extra backslashes. HTML needs one backslash per delimiter.');
  }
  const delimiters = text.match(/(?<!\\)\\[()[\]]/g) || [];
  let closing: string | undefined;
  for (const delimiter of delimiters) {
    if (delimiter === '\\(' || delimiter === '\\[') {
      if (closing) { issues.push('Nested or unclosed math delimiters.'); break; }
      closing = delimiter === '\\(' ? '\\)' : '\\]';
    } else {
      if (delimiter !== closing) { issues.push('Mismatched math delimiters.'); break; }
      closing = undefined;
    }
  }
  if (closing) issues.push('Unclosed math delimiter.');
  return issues;
};

export const parseModelJson = (rawText: string, pageCount?: number) => {
  let parsed: any;
  try {
    parsed = JSON.parse(stripFences(rawText));
  } catch {
    throw new ModelResponseError('Invalid JSON. Escape every TeX backslash once for JSON, including delimiters and row separators.');
  }
  const pages = pageCount === undefined ? [parsed] : parsed?.pages;
  if (!Array.isArray(pages) || (pageCount !== undefined && pages.length !== pageCount)) {
    throw new ModelResponseError('The response must contain exactly the requested pages.');
  }
  for (const page of pages) {
    if (!page || typeof page.html !== 'string' || !page.html.trim() || !Array.isArray(page.figures)) {
      throw new ModelResponseError('Each page must contain nonempty html and a figures array.');
    }
    const issues = mathSourceIssues(page.html);
    if (issues.length) throw new ModelResponseError(issues.join(' '));
  }
  return parsed;
};
