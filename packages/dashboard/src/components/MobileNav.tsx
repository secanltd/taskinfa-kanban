'use client';

import { useState } from 'react';
import LogoutButton from './auth/LogoutButton';

interface NavLink {
  href: string;
  label: string;
  active?: boolean;
}

interface MobileNavProps {
  links: NavLink[];
  userName?: string;
}

export default function MobileNav({ links, userName }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden">
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-terminal-muted hover:text-terminal-text rounded-lg hover:bg-terminal-bg transition-colors touch-manipulation"
        aria-label="Toggle menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 bg-terminal-surface border-b border-terminal-border z-50 shadow-lg shadow-black/30">
          <div className="px-4 py-3 space-y-1">
            {userName && (
              <div className="px-3 py-2 text-sm text-terminal-muted border-b border-terminal-border mb-2">
                {userName}
              </div>
            )}
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`block px-3 py-2.5 text-sm rounded-lg transition-colors touch-manipulation ${
                  link.active
                    ? 'text-terminal-text bg-terminal-bg'
                    : 'text-terminal-muted hover:text-terminal-text hover:bg-terminal-bg'
                }`}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-2 border-t border-terminal-border">
              <LogoutButton />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
