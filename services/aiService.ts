import { BatchResponse, LanguageLevel, ModelPageResponse, AccessibilityAudit, AccessibilityViolation } from "../types";

const getSystemInstruction = (level: LanguageLevel) => {
  let adaptationInstruction = "";

  if (level === 'faithful') {
    adaptationInstruction = "FAITHFULNESS: Transcribe every word and symbol exactly as written. Preserve the logical flow and hierarchy.";
  } else if (level === 'natural') {
    adaptationInstruction = "NATURAL ADAPTATION: Convert the notes into natural, complete sentences using simple English. Ensure the flow is smooth while maintaining the original meaning and mathematical rigor.";
  } else if (level === 'fleshed_out') {
    adaptationInstruction = "FLESHED OUT ADAPTATION: Expand on the notes. Provide more context, explain steps more thoroughly, and complete any shorthand into full, detailed explanations. Act as a helpful tutor expanding on the lecture.";
  }

  return `
You are a mathematics education and web accessibility specialist.
Your task is to convert scanned mathematics lecture slides or notes into high-fidelity, accessible HTML.

Rules:
1. ${adaptationInstruction}
2. ACCESSIBILITY: Use semantic HTML5 elements. Start the page with <h1>, use <h2> for major sections, and do not skip heading levels. Do not use headings only for visual size.
3. WCAG AA SAFETY: Do not use inline color/background styles. Avoid low-contrast Tailwind classes such as text-slate-300, text-gray-300, text-zinc-300, or text-slate-400.
4. MATHEMATICS: Convert mathematical expressions into LaTeX. Use \\( ... \\) for inline math and \\[ ... \\] for standalone display math.
5. FIGURES: Only mark actual visual representations as figures: graphs, coordinate systems, geometry, diagrams, or flowcharts. Hand-drawn circles, arrows, boxed labels, and brackets used only as emphasis are annotations, not figures.
6. FIGURE OUTPUT: For each actual figure, provide a normalized [ymin, xmin, ymax, xmax] box from 0-1000 and concise alt text.
7. HTML OUTPUT: Put matching placeholders into the HTML as <img id="fig_ID" alt="[description]">.

Return ONLY JSON in this exact shape:
{
  "html": "The full semantic HTML string",
  "figures": [
    { "id": "fig_1", "box_2d": [0, 0, 1000, 1000], "alt": "Concise visual description" }
  ]
}
`;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const stripFences = (text: string) => {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json|html)?\n?/, '').replace(/\n?```$/, '');
  }
  return cleaned.trim();
};

const extractJson = (text: string) => {
  const cleaned = stripFences(text);
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      return cleaned.slice(first, last + 1);
    }
    return cleaned;
  }
};

const escapeInvalidJsonBackslashes = (text: string) => {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (!inString) {
      result += char;
      if (char === '"') inString = true;
      continue;
    }

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === '"') {
      result += char;
      inString = false;
      continue;
    }

    if (char === '\\') {
      const next = text[i + 1] || '';
      if (/["\\/bfnrtu]/.test(next)) {
        result += char;
        escaped = true;
      } else {
        result += '\\\\';
      }
      continue;
    }

    result += char;
  }

  return result;
};

const looksLikeLatexEscape = (text: string, index: number) => {
  const next = text[index + 1] || '';
  const rest = text.slice(index + 2);

  return (next === 't' && /^(?:ext|imes|heta|au|ilde|frac|op|riangle)/.test(rest))
    || (next === 'f' && /^(?:rac|orall)/.test(rest))
    || (next === 'b' && /^(?:eta|ig|mod|oldsymbol)/.test(rest))
    || (next === 'n' && /^(?:abla|u\b)/.test(rest))
    || (next === 'r' && /^(?:ho|angle|ightarrow)/.test(rest))
    || (next === 'v' && /^(?:ec|ar|ert)/.test(rest));
};

const protectLatexEscapesBeforeJsonParse = (text: string) => {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (!inString) {
      result += char;
      if (char === '"') inString = true;
      continue;
    }

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === '"') {
      result += char;
      inString = false;
      continue;
    }

    if (char === '\\') {
      if (looksLikeLatexEscape(text, i)) {
        result += '\\\\';
      } else {
        result += char;
        escaped = true;
      }
      continue;
    }

    result += char;
  }

  return result;
};

const parseModelJson = (text: string) => {
  const extracted = protectLatexEscapesBeforeJsonParse(extractJson(text));
  try {
    return JSON.parse(extracted);
  } catch (error) {
    const repaired = escapeInvalidJsonBackslashes(extracted);
    try {
      return JSON.parse(repaired);
    } catch {
      console.error('Failed to parse model JSON:', {
        error,
        preview: extracted.slice(0, 1000)
      });
      throw error;
    }
  }
};

const contentToText = (content: any): string => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(part => part?.text || '').join('\n').trim();
  }
  return '';
};

const PAGE_CONVERSION_MAX_TOKENS = 65536;

interface ChatOptions {
  messages: any[];
  vision?: boolean;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
}

interface PageTextContext {
  extractedText?: string;
  textSource?: 'pdfplumber';
}

interface PageImageInput extends PageTextContext {
  base64: string;
  pageNumber: number;
}

const sanitizeExtractedText = (text: string) => text
  .replace(/\u2022/g, '-')
  .replace(/\u210b/g, '\\mathcal{H}')
  .replace(/\u2264/g, '\\le')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/[\u2013\u2014\u2212]/g, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/[^\S\n\t]+/g, ' ')
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  .trim();

const buildPageContextPrompt = (context?: PageTextContext) => {
  const extractedText = sanitizeExtractedText(context?.extractedText || '');

  if (!extractedText) return '';

  return `
PDF TEXT CONTEXT:
The following text was extracted from this PDF page. Use it as helpful context for readable text, but use the page image as the authority for layout, math, figures, and anything the extraction missed.

${extractedText}
`;
};

const chatCompletion = async ({ messages, vision = false, temperature = 0.1, maxTokens, json = false }: ChatOptions): Promise<{ text: string, tokenCount: number }> => {
  const response = await fetch('/api/llm/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      messages,
      vision,
      temperature,
      max_tokens: maxTokens,
      response_format: json ? { type: 'json_object' } : undefined
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const cause = payload.cause?.message || payload.details?.cause?.message || payload.details?.message;
    const detail = payload.upstreamBody || payload.message || cause || payload.hint;
    console.error('LLM proxy request failed:', {
      status: response.status,
      error: payload.error,
      message: payload.message,
      detail,
      hint: payload.hint,
      cause: payload.cause || payload.details?.cause,
      details: payload.details,
      model: payload.model,
      baseUrl: payload.baseUrl
    });
    throw new Error([payload.error || `LLM proxy error (${response.status})`, detail].filter(Boolean).join(' '));
  }

  const message = payload.choices?.[0]?.message;
  const text = contentToText(message?.content);
  if (!text) {
    const finishReason = payload.choices?.[0]?.finish_reason;
    const reasoning = message?.reasoning_content;
    throw new Error(`Empty response from LLM${finishReason ? ` (finish_reason: ${finishReason})` : ''}${reasoning ? '. Provider returned reasoning_content but no final content.' : ''}`);
  }

  return { text, tokenCount: payload.usage?.total_tokens || 0 };
};

const imagePart = (base64: string, mimeType = 'image/jpeg') => ({
  type: 'image_url',
  image_url: {
    url: base64.startsWith('data:') ? base64 : `data:${mimeType};base64,${base64}`
  }
});

async function callPageWithRetry(base64Image: string, pageNumber: number, level: LanguageLevel = 'faithful', pageContext?: PageTextContext, retries = 5): Promise<{ text: string, tokenCount: number }> {
  for (let i = 0; i < retries; i++) {
    try {
      const contextPrompt = buildPageContextPrompt(pageContext);
      const content = [
        ...(contextPrompt ? [{ type: 'text', text: contextPrompt }] : []),
        imagePart(base64Image),
        {
          type: 'text',
          text: `Analyze page ${pageNumber}. Output only the JSON object.`
        }
      ];

      console.info(`Starting vision conversion for page ${pageNumber}`, {
        hasExtractedText: Boolean(pageContext?.extractedText?.trim()),
        extractedTextChars: pageContext?.extractedText?.length || 0
      });

      const response = await chatCompletion({
        vision: true,
        json: false,
        maxTokens: PAGE_CONVERSION_MAX_TOKENS,
        messages: [
          { role: 'system', content: getSystemInstruction(level) },
          {
            role: 'user',
            content
          }
        ]
      });

      console.info(`Completed vision conversion for page ${pageNumber}`, {
        tokenCount: response.tokenCount
      });

      return { text: extractJson(response.text), tokenCount: response.tokenCount };
    } catch (error: any) {
      const message = error.message?.toLowerCase() || '';
      const isRateLimit = message.includes('429') || message.includes('rate limit');
      const isTransientConnection = message.includes('econnreset')
        || message.includes('socket hang up')
        || message.includes('terminated')
        || message.includes('headers timeout')
        || message.includes('body timeout')
        || message.includes('llm_proxy_timeout');

      if ((isRateLimit || isTransientConnection) && i < retries - 1) {
        const delayMs = Math.pow(2, i + 1) * 1000;
        console.warn(`Retrying page ${pageNumber} after LLM connection failure (${i + 1}/${retries}) in ${delayMs} ms:`, error.message);
        await sleep(delayMs);
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

async function callBatchWithRetry(images: PageImageInput[], level: LanguageLevel = 'faithful', retries = 5): Promise<{ text: string, tokenCount: number }> {
  for (let i = 0; i < retries; i++) {
    try {
      const content = images.flatMap(img => {
        const contextPrompt = buildPageContextPrompt({
          extractedText: img.extractedText,
          textSource: img.textSource
        });

        return [
          ...(contextPrompt ? [{ type: 'text', text: contextPrompt }] : []),
          imagePart(img.base64),
          { type: 'text', text: `This is page ${img.pageNumber}.` }
        ];
      });

      content.push({
        type: 'text',
        text: `Analyze these ${images.length} pages in order. Return only JSON with a "pages" array containing exactly ${images.length} objects in the same order. Each object must have "html" and "figures".`
      });

      const response = await chatCompletion({
        vision: true,
        json: true,
        maxTokens: 65536,
        messages: [
          {
            role: 'system',
            content: `${getSystemInstruction(level)}\nFor batch mode, return {"pages":[...]} instead of a single page object.`
          },
          { role: 'user', content }
        ]
      });

      return { text: extractJson(response.text), tokenCount: response.tokenCount };
    } catch (error: any) {
      const isRateLimit = error.message?.includes('429') || error.message?.toLowerCase().includes('rate limit');
      if (isRateLimit && i < retries - 1) {
        await sleep(Math.pow(2, i + 1) * 1000);
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

export const convertBatchToHtml = async (images: PageImageInput[], level: LanguageLevel = 'faithful'): Promise<BatchResponse> => {
  try {
    const result = await callBatchWithRetry(images, level);
    const parsed = parseModelJson(result.text);
    return { pages: parsed.pages as ModelPageResponse[], tokenCount: result.tokenCount };
  } catch (error: any) {
    throw new Error(`Failed to process batch: ${error.message}`);
  }
};

export const convertPageToHtml = async (base64Image: string, pageNumber: number, level: LanguageLevel = 'faithful', pageContext?: PageTextContext): Promise<{ page: ModelPageResponse, tokenCount: number }> => {
  try {
    const result = await callPageWithRetry(base64Image, pageNumber, level, pageContext);
    return { page: parseModelJson(result.text) as ModelPageResponse, tokenCount: result.tokenCount };
  } catch (error: any) {
    throw new Error(`Failed to process page ${pageNumber}: ${error.message}`);
  }
};

export const refineLatex = async (html: string): Promise<{ html: string, tokenCount: number }> => {
  try {
    const response = await chatCompletion({
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: 'You are a mathematical typesetting and accessibility cleanup specialist. Return only the refined HTML string.'
        },
        {
          role: 'user',
          content: `Review this HTML and fix broken LaTeX delimiters, obvious OCR math notation errors, unsafe color/background inline styles, low-contrast classes, and skipped heading levels. Do not change meaning or remove content.\n\n${html}`
        }
      ]
    });

    return { html: stripFences(response.text), tokenCount: response.tokenCount };
  } catch (error) {
    console.error('LaTeX refinement error:', error);
    return { html, tokenCount: 0 };
  }
};

export const repairAccessibility = async (html: string, audit: AccessibilityAudit): Promise<{ html: string, tokenCount: number }> => {
  const violations = audit.violations.map((violation: AccessibilityViolation) => ({
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    help: violation.help,
    tags: violation.tags,
    nodes: violation.nodes.map(node => ({
      target: node.target,
      failureSummary: node.failureSummary
    }))
  }));

  const response = await chatCompletion({
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: 'You repair HTML for WCAG 2.1/2.2 AA. Return only the corrected HTML string. Do not add explanations.'
      },
      {
        role: 'user',
        content: `Fix only accessibility issues in this generated document fragment. Allowed edits: semantic structure, heading order, labels, alt text, table markup, ARIA cleanup, contrast-safe classes, and keyboard/focus safety. Preserve all math, wording, and figures unless needed for accessibility.\n\nAxe violations:\n${JSON.stringify(violations, null, 2)}\n\nHTML:\n${html}`
      }
    ]
  });

  return { html: stripFences(response.text), tokenCount: response.tokenCount };
};

export const describeFigure = async (base64Image: string): Promise<{ result: string, tokenCount: number }> => {
  const response = await chatCompletion({
    vision: true,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: 'Generate concise accessible alt text for mathematical figures. Return only the description.'
      },
      {
        role: 'user',
        content: [
          imagePart(base64Image, 'image/png'),
          {
            type: 'text',
            text: 'Describe this mathematical figure for a blind student in 1-2 complete sentences, under 125 characters if possible. Use LaTeX for formulas when helpful.'
          }
        ]
      }
    ]
  });

  return { result: response.text.trim(), tokenCount: response.tokenCount };
};

export const getAiCapabilities = async (): Promise<{
  chat: boolean;
  image: boolean;
  textModel?: string;
  visionModel?: string;
  baseUrl?: string;
  textBaseUrl?: string;
  visionBaseUrl?: string;
  splitProviders?: boolean;
}> => {
  const response = await fetch('/api/llm/capabilities');
  if (!response.ok) return { chat: false, image: false };
  return response.json();
};

const unsupportedImageFeature = async (): Promise<{ result: string, tokenCount: number }> => {
  const response = await fetch('/api/llm/image', { method: 'POST' });
  const payload = await response.json().catch(() => ({}));
  throw new Error(payload.error || 'AI image generation/editing is not configured.');
};

export const recreateFigure = async (_base64Image: string, _alt: string) => unsupportedImageFeature();
export const generateGraph = async (_equations: string) => unsupportedImageFeature();
export const touchUpImage = async (_base64Image: string, _prompt: string) => unsupportedImageFeature();
