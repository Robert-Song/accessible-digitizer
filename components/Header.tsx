import React from 'react';

interface HeaderProps {
  onShowDocs: () => void;
}

const Header: React.FC<HeaderProps> = ({ onShowDocs }) => {
  return (
    <header className="sticky top-0 z-40 border-b border-black bg-white">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4">
        <a href="/" className="font-mono text-sm font-semibold text-black no-underline">
          AccessDocs
        </a>
        <nav className="flex items-center gap-4 text-sm">
          <button onClick={onShowDocs} className="text-black underline underline-offset-4 hover:no-underline">
            help
          </button>
          <a
            href="https://www.w3.org/WAI/standards-guidelines/wcag/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-black underline underline-offset-4 hover:no-underline"
          >
            wcag
          </a>
        </nav>
      </div>
    </header>
  );
};

export default Header;
