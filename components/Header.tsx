import React from 'react';
import { Braces, BookOpen, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  onShowDocs: () => void;
}

const Header: React.FC<HeaderProps> = ({ onShowDocs }) => {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-zinc-900 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1800px] items-center justify-between px-4 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center border-2 border-zinc-900 bg-zinc-950 text-teal-300 shadow-[4px_4px_0_#14b8a6]">
            <Braces className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-mono text-sm font-black uppercase tracking-widest text-zinc-950 md:text-base">
              qed.compiler
            </h1>
            <p className="hidden font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 sm:block">
              pdf to accessible html pipeline
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-widest md:text-xs">
          <button
            onClick={onShowDocs}
            className="inline-flex items-center gap-2 border border-zinc-300 bg-white px-3 py-2 text-zinc-700 hover:border-teal-500 hover:text-teal-700"
          >
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">docs</span>
          </button>
          <a
            href="https://www.w3.org/WAI/standards-guidelines/wcag/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-zinc-300 bg-white px-3 py-2 text-zinc-700 hover:border-teal-500 hover:text-teal-700"
          >
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">wcag aa</span>
          </a>
        </nav>
      </div>
    </header>
  );
};

export default Header;
