import React from 'react';

interface HelpModalProps {
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white p-4">
      <section className="mx-auto max-w-2xl border border-black bg-white p-5">
        <header className="mb-6 flex items-start justify-between gap-6 border-b border-black pb-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-600">help</p>
            <h2 className="mt-1 text-3xl font-semibold">How to use Q.E.D.</h2>
          </div>
          <button onClick={onClose} className="border border-black bg-white px-3 py-2 text-sm hover:bg-neutral-100">
            close
          </button>
        </header>

        <ol className="space-y-4 text-sm leading-6 text-neutral-800">
          <li><strong>1. Upload a file.</strong> Use a PDF, image, HEIC/HEIF, or plain text file containing math notes or slides.</li>
          <li><strong>2. Choose a transcription mode.</strong> Faithful keeps wording close to the original; natural smooths it; detailed expands explanations.</li>
          <li><strong>3. Review the result.</strong> Check the generated HTML, figures, alt text, and math rendering.</li>
          <li><strong>4. Run edits if needed.</strong> Use refine math or the figure editor for local cleanup.</li>
          <li><strong>5. Download HTML.</strong> The export includes an automated accessibility status note.</li>
        </ol>

        <section className="mt-8 border-t border-black pt-5">
          <h3 className="mb-3 text-xl font-semibold">Tips</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-neutral-800">
            <li>Use high-contrast scans when possible.</li>
            <li>Split very long slide decks into smaller files.</li>
            <li>Automated accessibility checks do not prove math accuracy or alt-text quality.</li>
          </ul>
        </section>
      </section>
    </div>
  );
};

export default HelpModal;
