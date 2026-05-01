import React, { useState } from 'react';
import { UploadCloud, TerminalSquare, Cpu, Braces, FileCode2, ShieldCheck } from 'lucide-react';
import { LanguageLevel } from '../types';

interface DashboardProps {
  onFileUpload: (file: File, languageLevel: LanguageLevel) => void;
  isProcessing: boolean;
  onShowDocs: () => void;
}

const modes: { id: LanguageLevel; label: string; note: string }[] = [
  { id: 'faithful', label: 'raw', note: 'Exact transcription' },
  { id: 'natural', label: 'clean', note: 'Readable prose' },
  { id: 'fleshed_out', label: 'debug', note: 'Expanded explanation' }
];

const Dashboard: React.FC<DashboardProps> = ({ onFileUpload, isProcessing, onShowDocs }) => {
  const [languageLevel, setLanguageLevel] = useState<LanguageLevel>('faithful');
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFileUpload(file, languageLevel);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isProcessing) return;

    const file = e.dataTransfer.files?.[0];
    if (file) onFileUpload(file, languageLevel);
  };

  return (
    <div className="relative min-h-[82vh] w-full overflow-hidden px-4 py-10 md:py-16">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:32px_32px] opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(20,184,166,0.14),transparent_28%),radial-gradient(circle_at_80%_30%,rgba(245,158,11,0.14),transparent_24%)]" />

      <div className="relative mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_430px] lg:items-center">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-2 border border-zinc-300 bg-white px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-zinc-600 shadow-sm">
            <TerminalSquare className="h-4 w-4 text-teal-600" />
            <span>slides_to_html --wcag aa</span>
          </div>

          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center border-2 border-zinc-900 bg-zinc-950 text-teal-300 shadow-[6px_6px_0_#14b8a6]">
                <Braces className="h-8 w-8" />
              </div>
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.28em] text-teal-700">Q.E.D. compiler</p>
                <h1 className="text-4xl font-black tracking-tight text-zinc-950 md:text-6xl">
                  Accessible notes, built like source.
                </h1>
              </div>
            </div>
            <p className="max-w-3xl text-lg leading-8 text-zinc-600">
              Upload lecture slides or PDFs, run a vision model pass, repair the generated HTML with axe-backed feedback, and export a document that is easier to inspect, edit, and ship.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: FileCode2, label: 'semantic html', value: '<article>' },
              { icon: Cpu, label: 'open llm', value: '/v1/chat' },
              { icon: ShieldCheck, label: 'audit loop', value: 'axe-core' }
            ].map(item => (
              <div key={item.label} className="border border-zinc-300 bg-white p-4 shadow-[4px_4px_0_#e4e4e7]">
                <item.icon className="mb-4 h-5 w-5 text-amber-600" />
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">{item.label}</p>
                <p className="mt-1 font-mono text-sm font-black text-zinc-950">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 bg-white p-5 shadow-[10px_10px_0_#18181b] transition-all duration-200 ${
            isDragging ? 'translate-x-1 translate-y-1 border-teal-500 shadow-[6px_6px_0_#14b8a6]' : 'border-zinc-900'
          }`}
        >
          <div className="mb-5 flex items-center justify-between border-b border-zinc-200 pb-3">
            <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-zinc-500">
              <span className="h-2.5 w-2.5 bg-red-500" />
              <span className="h-2.5 w-2.5 bg-amber-400" />
              <span className="h-2.5 w-2.5 bg-teal-500" />
            </div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">ingest.ts</span>
          </div>

          <div className="border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center border border-zinc-900 bg-zinc-950 text-teal-300">
              <UploadCloud className="h-8 w-8" />
            </div>
            <h2 className="font-mono text-2xl font-black tracking-tight text-zinc-950">drop PDF / image / txt</h2>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-zinc-500">
              The pipeline will parse pages, extract figures, repair accessibility issues, and keep the result editable.
            </p>

            <div className="my-6 grid grid-cols-3 border border-zinc-300 bg-white p-1">
              {modes.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setLanguageLevel(mode.id)}
                  className={`px-2 py-3 font-mono text-[10px] font-black uppercase tracking-widest transition-colors ${
                    languageLevel === mode.id
                      ? 'bg-zinc-950 text-teal-300'
                      : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <p className="mb-6 font-mono text-[11px] font-bold uppercase tracking-widest text-zinc-500">
              {modes.find(mode => mode.id === languageLevel)?.note}
            </p>

            <label className="inline-flex w-full cursor-pointer items-center justify-center gap-3 border-2 border-zinc-950 bg-teal-400 px-6 py-4 font-mono text-sm font-black uppercase tracking-widest text-zinc-950 shadow-[5px_5px_0_#18181b] transition-transform hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-[2px_2px_0_#18181b]">
              <UploadCloud className="h-5 w-5" />
              <span>compile document</span>
              <input type="file" className="sr-only" accept="application/pdf,image/*,.heic,.heif,.txt" onChange={handleFileChange} disabled={isProcessing} />
            </label>
          </div>
        </section>
      </div>

      <div className="relative mx-auto mt-10 flex max-w-6xl flex-wrap items-center gap-4 font-mono text-xs font-bold uppercase tracking-widest text-zinc-500">
        <button onClick={onShowDocs} className="border border-zinc-300 bg-white px-3 py-2 hover:border-teal-500 hover:text-teal-700">docs</button>
        <a href="https://www.w3.org/WAI/standards-guidelines/wcag/" target="_blank" rel="noopener noreferrer" className="border border-zinc-300 bg-white px-3 py-2 hover:border-teal-500 hover:text-teal-700">wcag 2.2 aa</a>
        <span className="border border-zinc-300 bg-white px-3 py-2 text-zinc-400">v1.0.0</span>
      </div>
    </div>
  );
};

export default Dashboard;
