import React, { useState } from 'react';
import { DigitizationOptions, LanguageLevel } from '../types';

interface DashboardProps {
  onFileUpload: (file: File, options: DigitizationOptions) => void;
  isProcessing: boolean;
  onShowDocs: () => void;
}

const modes: { id: LanguageLevel; label: string; description: string }[] = [
  { id: 'faithful', label: 'faithful', description: 'keep the original wording' },
  { id: 'natural', label: 'natural', description: 'make the prose smoother' },
  { id: 'fleshed_out', label: 'detailed', description: 'add explanation where useful' }
];

const Dashboard: React.FC<DashboardProps> = ({ onFileUpload, isProcessing, onShowDocs }) => {
  const [languageLevel, setLanguageLevel] = useState<LanguageLevel>('faithful');
  const [topicKeyword, setTopicKeyword] = useState<string>('');
  const [generateDocSummary, setGenerateDocSummary] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState(false);

  const getOptions = (): DigitizationOptions => ({
    languageLevel,
    generateDocSummary,
    topicKeyword: topicKeyword.trim() || undefined
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFileUpload(file, getOptions());
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    if (!isProcessing) setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    if (isProcessing) return;

    const file = event.dataTransfer.files?.[0];
    if (file) onFileUpload(file, getOptions());
  };

  return (
    <div className="mx-auto flex min-h-[78vh] w-full max-w-5xl flex-col justify-center px-4 py-12">
      <header className="mb-10 border-b border-black pb-6">
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-neutral-600">AccessDocs / PDF to Accessible HTML</p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-black md:text-6xl">
          Convert lecture slides into accessible documents.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-700">
          Upload a PDF, image, or text file. The app generates semantic HTML, checks it with axe-core, and keeps the result editable before export.
        </p>
      </header>

      <main className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border border-black bg-white p-6 ${isDragging ? 'outline outline-4 outline-black' : ''}`}
        >
          <h2 className="mb-2 text-2xl font-semibold text-black">Upload</h2>
          <p className="mb-6 text-sm leading-6 text-neutral-700">
            Drag a file here, or use the file picker. Supported inputs: PDF, image, HEIC/HEIF, or plain text.
          </p>

          <label className="inline-flex cursor-pointer items-center border border-black bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-white hover:text-black">
            choose file
            <input
              type="file"
              className="sr-only"
              accept="application/pdf,image/*,.heic,.heif,.txt"
              onChange={handleFileChange}
              disabled={isProcessing}
            />
          </label>

          <div className="mt-6 border-t border-black pt-5">
            <label htmlFor="topic-keyword-input" className="mb-2 block font-mono text-xs uppercase tracking-widest text-neutral-600">
              Topic / Main Keywords (Optional)
            </label>
            <input
              id="topic-keyword-input"
              type="text"
              value={topicKeyword}
              onChange={(e) => setTopicKeyword(e.target.value)}
              placeholder="e.g., Real Analysis: Metric Spaces, Stokes' Theorem, Eigenvalues..."
              disabled={isProcessing}
              className="w-full border border-black bg-white px-3 py-2.5 text-sm text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-black"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Helps the model accurately interpret domain-specific notation and abbreviations.
            </p>
          </div>

          <div className="mt-6 border-t border-black pt-5">
            <p className="mb-3 font-mono text-xs uppercase tracking-widest text-neutral-600">transcription mode</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {modes.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setLanguageLevel(mode.id)}
                  className={`border border-black px-3 py-3 text-left text-sm ${
                    languageLevel === mode.id ? 'bg-black text-white' : 'bg-white text-black hover:bg-neutral-100'
                  }`}
                >
                  <span className="block font-semibold">{mode.label}</span>
                  <span className={`mt-1 block text-xs ${languageLevel === mode.id ? 'text-neutral-300' : 'text-neutral-600'}`}>
                    {mode.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-neutral-200 pt-4">
            <label className="flex cursor-pointer items-start gap-3 select-none">
              <input
                type="checkbox"
                checked={generateDocSummary}
                onChange={(e) => setGenerateDocSummary(e.target.checked)}
                disabled={isProcessing}
                className="mt-0.5 h-4 w-4 rounded border-black text-black accent-black focus:ring-black"
              />
              <div>
                <span className="block text-sm font-semibold text-black">
                  Generate global document summary
                </span>
                <span className="block text-xs text-neutral-600 leading-relaxed">
                  Extracts whole-PDF text to build a 1–2 sentence global document abstract, providing cross-slide context to every page.
                </span>
              </div>
            </label>
          </div>
        </section>

        <aside className="border border-black bg-neutral-50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-black">Pipeline</h2>
          <ol className="space-y-3 text-sm text-neutral-800">
            <li className="border-b border-neutral-300 pb-3">1. render pages & extract full text</li>
            <li className="border-b border-neutral-300 pb-3">2. generate global context & summary</li>
            <li className="border-b border-neutral-300 pb-3">3. vision model generates semantic HTML</li>
            <li className="border-b border-neutral-300 pb-3">4. crop figures and attach alt text</li>
            <li className="border-b border-neutral-300 pb-3">5. run axe-core and repair issues</li>
            <li>6. export standalone accessible HTML</li>
          </ol>
        </aside>
      </main>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-black pt-5 text-sm">
        <div className="flex flex-wrap gap-4">
          <button onClick={onShowDocs} className="underline underline-offset-4 hover:no-underline">how to use</button>
          <a href="https://www.w3.org/WAI/standards-guidelines/wcag/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:no-underline">
            WCAG 2.2 AA
          </a>
          <span className="text-neutral-500">v1.0.0</span>
        </div>
        <p className="text-xs text-neutral-600">
          Influenced by Professor Kuan-Hua Chen&apos;s{' '}
          <a
            href="https://drjchen1.github.io/chenflix/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 text-black hover:no-underline"
          >
            Q.E.D. program
          </a>
        </p>
      </footer>
    </div>
  );
};

export default Dashboard;
