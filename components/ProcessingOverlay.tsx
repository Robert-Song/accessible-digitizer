import React from 'react';

interface ProcessingOverlayProps {
  progress: number;
  status: string;
}

const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({ progress, status }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white p-6">
      <section className="w-full max-w-lg border border-black bg-white p-6">
        <h2 className="mb-2 text-2xl font-semibold text-black">Processing</h2>
        <p className="mb-6 min-h-6 text-sm text-neutral-700">{status}</p>

        <div className="mb-3 flex items-center justify-between font-mono text-xs">
          <span>{Math.round(progress)}%</span>
          <span>qed pipeline</span>
        </div>
        <div className="h-4 border border-black">
          <div className="h-full bg-black" style={{ width: `${progress}%` }} />
        </div>

        <ol className="mt-6 space-y-2 text-sm text-neutral-800">
          <li className={progress >= 0 ? 'font-semibold text-black' : ''}>1. read input</li>
          <li className={progress >= 35 ? 'font-semibold text-black' : ''}>2. generate HTML</li>
          <li className={progress >= 70 ? 'font-semibold text-black' : ''}>3. audit and repair</li>
        </ol>
      </section>
    </div>
  );
};

export default ProcessingOverlay;
