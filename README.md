<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Q.E.D. Accessible Math Digitizer

This app converts uploaded slides, PDFs, images, or text notes into accessible HTML with math markup, figure alt text, and an axe-core accessibility audit/repair pass.

View your app in AI Studio: https://ai.studio/apps/6c7a3a5b-4f4a-4290-b42d-4e8347551f4c

## Run Locally

**Prerequisites:**  Node.js. Python with `pdfplumber` is recommended for searchable PDFs.


1. Install dependencies:
   `npm install`
   Optional PDF text extraction:
   `python -m pip install -r requirements.txt`
2. Configure an OpenAI-compatible LLM server in [.env.local](.env.local):
   `LLM_BASE_URL=http://localhost:11434/v1`
   `LLM_TEXT_MODEL=your-text-model`
   `LLM_VISION_MODEL=your-vision-model`
   `LLM_API_KEY=optional-key`
3. Run the app:
   `npm run dev`

The Vite dev server includes a backend proxy at `/api/llm/*`. For a standalone proxy, run `npm run proxy`.

Optional image generation/editing tools require a separate image backend adapter and `IMAGE_API_BASE_URL`. Without it, manual figure editing and vision-based alt text still work.

### PDF text extraction

PDFs are still rendered page-by-page as images for visual grounding, layout, figures, and handwritten content. When `pdfplumber` is available on the server, the app also extracts each page's embedded text through `/api/pdf/extract`, then passes that page text alongside the page image to the vision model.

If `pdfplumber` is missing or fails on a PDF, the upload falls back to the previous image-only vision path. To use a specific Python environment, set:

```env
PDFPLUMBER_PYTHON=/path/to/python
```

### Split text and vision providers

For testing, you can use separate OpenAI-compatible endpoints and keys for text-only repair/refinement versus vision/PDF understanding:

```env
LLM_TEXT_BASE_URL=http://localhost:11434/v1
LLM_TEXT_MODEL=text-model-name
LLM_TEXT_API_KEY=optional-text-key

LLM_VISION_BASE_URL=http://localhost:8002/v1
LLM_VISION_MODEL=vision-model-name
LLM_VISION_API_KEY=optional-vision-key
```

If these split variables are omitted, the app falls back to `LLM_BASE_URL` and `LLM_API_KEY`.

For OpenRouter reasoning models, you can ask the proxy to keep reasoning out of the final response:

```env
LLM_VISION_REASONING_EFFORT=none
LLM_TEXT_REASONING_EFFORT=none
```

If a provider does not support the `reasoning` option, leave these unset.

To avoid rate limits, add a delay before each upstream provider request:

```env
LLM_VISION_REQUEST_DELAY_MS=5000
LLM_TEXT_REQUEST_DELAY_MS=1000
LLM_PROXY_TIMEOUT_MS=1200000
```

Use `0` or omit either delay value to disable that delay. `LLM_PROXY_TIMEOUT_MS` defaults to 20 minutes. Vision conversion runs one slide at a time so model-server task logs map cleanly to pages.
