<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AccessDocs - Accessible Math & Document Digitizer

**AccessDocs** converts uploaded lecture slides, problem sets, handwritten notes, and scanned PDFs into high-fidelity, accessible HTML documents with semantic markup, LaTeX mathematical typesetting (MathJax 3), grounded visual figure extraction, and automated WCAG 2.1/2.2 AA auditing and repair.

For a detailed technical walkthrough of the end-to-end pipeline, data transformations, and extensibility, read the [Architecture Guide](ARCHITECTURE.md).

---

## Key Features

- **Multimodal Vision Transcription**: Uses high-capacity vision models to transcribe visual slides and notes into semantic HTML5, strictly enforcing inline (`\( ... \)`) and block (`\[ ... \]`) LaTeX math.
- **Visual Grounding & Figure Cropping**: Automatically locates coordinate bounding boxes for diagrams, plots, and geometry charts, crops them into standalone image assets, and provides contextual alt text.
- **Interactive Figure Editor**: Adjust bounding boxes, fine-tune dimensions, or regenerate alt text directly in the browser.
- **Two-Phase Accessibility Engine**:
  - **Phase 1 (Domain-Specific Rules)**: Normalizes table structure and adds deterministic screen-reader placeholders for empty response cells.
  - **Phase 2 (Audit and Repair Loop)**: Runs `axe-core` and MathJax in isolated browser frames, then sends violations and failed custom checks to at most two AI repair attempts. Each candidate is re-audited before acceptance; no-op and failed repairs retain the previous HTML/report. Scores summarize automated findings, not WCAG compliance.
- **Harmonized Cross-Page Output**: Deduplicates repeating slide titles and headers, rendering continuous documents.
- **Standalone Export**: Download a fully self-contained HTML document with bundled CSS tokens, MathJax 3 rendering, print media styles, and `.sr-only` accessibility classes, or export a complete ZIP bundle with all cropped figures.

---

## Processing Pipeline Summary

```
Uploaded PDF / Image
       │
       ▼
[Page Rendering & Text Extraction]
       │  (PDF.js Canvas + optional server-side pdfplumber)
       ▼
[Vision AI Transcription Worker Pool]
       │  (Multimodal prompt + Resilient LaTeX/JSON parser)
       ▼
[Figure Grounding & Cropping]
       │  (Canvas coordinate slice + semantic <figure> injection)
       ▼
[Deterministic DOM Sanitization]
       │  (Heading normalization, style safety, MathJax relax spacing)
       ▼
[Phase 1: Domain & Table Rules]
       │  (sanitizeGeneratedHtml)
       ▼
[Phase 2: axe-core, Math Rendering & Custom Checks]
       │  (runAccessibilityAudit ──> repairAccessibility)
       ▼
[Cross-Page Harmonization & Export]
          (Interactive Web Viewer / Standalone HTML / ZIP)
```

*For complete details, see [ARCHITECTURE.md](ARCHITECTURE.md).*

---

## Run Locally

**Prerequisites:** Node.js (v18+ recommended). Python 3.10+ with `pdfplumber` is recommended for searchable PDFs.

### 1. Install Dependencies
```bash
npm install
```

*(Optional) Install Python text extraction dependencies:*
```bash
python -m pip install -r requirements.txt
```

### 2. Configure Environment Variables
Copy `.env.local.example` or create `.env.local`:
```env
LLM_BASE_URL=http://localhost:11434/v1
LLM_TEXT_MODEL=your-text-model
LLM_VISION_MODEL=your-vision-model
LLM_API_KEY=optional-key
```

### 3. Run Dev Server
```bash
npm run dev
```

The Vite dev server includes a built-in backend proxy at `/api/llm/*` and `/api/pdf/*`. For a standalone proxy, run:
```bash
npm run proxy
```

---

## Advanced Configuration

### PDF Text Extraction (`pdfplumber`)
PDFs are always rendered page-by-page as high-resolution images for visual grounding, layout, and handwritten equations. When `pdfplumber` is installed, the server extracts selectable text and passes it alongside the image as supplementary context for maximum fidelity.

To specify a custom Python binary:
```env
PDFPLUMBER_PYTHON=/path/to/python
```

### Split Text and Vision Providers
You can configure separate OpenAI-compatible endpoints and API keys for text-only repair/refinement versus vision understanding:
```env
LLM_TEXT_BASE_URL=http://localhost:11434/v1
LLM_TEXT_MODEL=text-model-name
LLM_TEXT_API_KEY=optional-text-key

LLM_VISION_BASE_URL=http://localhost:8002/v1
LLM_VISION_MODEL=vision-model-name
LLM_VISION_API_KEY=optional-vision-key
```

### Concurrency, Delays, & Reasoning
```env
# Concurrency limit for parallel page processing (default: 2)
LLM_CONCURRENCY_LIMIT=2

# Throttle requests to avoid provider rate limits (in milliseconds)
LLM_VISION_REQUEST_DELAY_MS=5000
LLM_TEXT_REQUEST_DELAY_MS=1000

# Proxy request timeout (default: 20 minutes)
LLM_PROXY_TIMEOUT_MS=1200000

# Exclude reasoning content for OpenRouter / reasoning models
LLM_VISION_REASONING_EFFORT=none
LLM_TEXT_REASONING_EFFORT=none
```

---

## Testing & Validation

### Backslash contract

Model page responses are strict JSON. In the JSON transport, `"\\(10 \\times 10\\)"` decodes once to `\(10 \times 10\)` in HTML. A TeX row separator needs four backslashes in JSON and two in HTML. Raw HTML repair/refinement responses are already decoded and must not be JSON-unescaped again.

Malformed JSON, corrupted TeX control characters, extra delimiter escapes, and invalid page schemas cause a bounded conversion retry instead of heuristic backslash replacement. Legitimate code escapes and TeX row breaks are preserved. This validation cannot establish mathematical correctness.

MathJax 3's `textmacros` extension is enabled in the preview, export, and audit frame. It interprets text-mode escapes such as `\text{leaky\_relu}` correctly. Preserve `\_` in TeX source; removing it globally can turn literal underscores into mathematical subscripts.

Audits use preview styling and render math before running axe. Continuation pages do not require a new h1. Heading harmonization refreshes changed reports; figure edits invalidate the old report. Incomplete axe checks and unavailable rendering/resources require review and cannot produce a clean pass. The separately styled exported HTML still needs a final document review.

```bash
# Backslash and model-response regression tests
npm test

# Type check with TypeScript
npm run lint

# Build production bundle
npm run build
```

Browser regressions use mocked LLM responses and real axe/MathJax. They require Playwright plus Chromium (`npm install --no-save --package-lock=false playwright`, then `npx playwright install chromium`). Run `npm run test:browser`. Alternatively, set `PLAYWRIGHT_MODULE_PATH` to a provided Playwright `index.mjs` and `BROWSER_CHANNEL=chrome` to use installed Chrome. MathJax rendering tests require access to the same CDN as the app.

---

## Acknowledgments

Influenced by Professor Kuan-Hua Chen's [Q.E.D. program](https://drjchen1.github.io/chenflix/).
