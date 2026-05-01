<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Q.E.D. Accessible Math Digitizer

This app converts uploaded slides, PDFs, images, or text notes into accessible HTML with math markup, figure alt text, and an axe-core accessibility audit/repair pass.

View your app in AI Studio: https://ai.studio/apps/6c7a3a5b-4f4a-4290-b42d-4e8347551f4c

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure an OpenAI-compatible LLM server in [.env.local](.env.local):
   `LLM_BASE_URL=http://localhost:11434/v1`
   `LLM_TEXT_MODEL=your-text-model`
   `LLM_VISION_MODEL=your-vision-model`
   `LLM_API_KEY=optional-key`
3. Run the app:
   `npm run dev`

The Vite dev server includes a backend proxy at `/api/llm/*`. For a standalone proxy, run `npm run proxy`.

Optional image generation/editing tools require a separate image backend adapter and `IMAGE_API_BASE_URL`. Without it, manual figure editing and vision-based alt text still work.
