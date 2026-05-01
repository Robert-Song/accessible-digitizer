import React, { useState } from 'react';
import { LanguageLevel } from '../types';

interface DashboardProps {
  onFileUpload: (file: File, languageLevel: LanguageLevel) => void;
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
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFileUpload(file, languageLevel);
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
    if (file) onFileUpload(file, languageLevel);
  };

  return (
    <div className="mx-auto flex min-h-[78vh] w-full max-w-5xl flex-col justify-center px-4 py-12">
      <header className="mb-10 border-b border-black pb-6">
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-neutral-600">qed / pdf to accessible html</p>
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

          <div className="mt-8 border-t border-black pt-5">
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
        </section>

        <aside className="border border-black bg-neutral-50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-black">Pipeline</h2>
          <ol className="space-y-3 text-sm text-neutral-800">
            <li className="border-b border-neutral-300 pb-3">1. render pages to images</li>
            <li className="border-b border-neutral-300 pb-3">2. ask the vision model for semantic HTML</li>
            <li className="border-b border-neutral-300 pb-3">3. crop figures and attach alt text</li>
            <li className="border-b border-neutral-300 pb-3">4. run axe-core and repair issues</li>
            <li>5. export one standalone HTML file</li>
          </ol>
        </aside>
      </main>

      <footer className="mt-8 flex flex-wrap gap-4 border-t border-black pt-5 text-sm">
        <button onClick={onShowDocs} className="underline underline-offset-4 hover:no-underline">how to use</button>
        <a href="https://www.w3.org/WAI/standards-guidelines/wcag/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:no-underline">
          WCAG 2.2 AA
        </a>
        <span className="text-neutral-500">v1.0.0</span>
      </footer>
    </div>
  );
};

export default Dashboard;
