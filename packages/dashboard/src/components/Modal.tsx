'use client';

import { useEffect, useCallback, type ReactNode } from 'react';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: ModalSize;
  onEscapeKey?: (e: KeyboardEvent) => void;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export default function Modal({
  isOpen,
  onClose,
  children,
  size = 'lg',
  onEscapeKey,
}: ModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (onEscapeKey) {
        onEscapeKey(e);
      } else {
        onClose();
      }
    }
  }, [onClose, onEscapeKey]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={`bg-terminal-surface border border-terminal-border rounded-xl shadow-2xl ${sizeClasses[size]} w-full`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

interface ModalHeaderProps {
  children: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
}

export function ModalHeader({ children, onClose, actions }: ModalHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-terminal-border">
      <h2 className="text-lg font-semibold text-terminal-text">{children}</h2>
      <div className="flex items-center gap-2">
        {actions}
        <button
          onClick={onClose}
          className="p-2 text-terminal-muted hover:text-terminal-text hover:bg-terminal-bg rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface ModalFooterProps {
  children: ReactNode;
}

export function ModalFooter({ children }: ModalFooterProps) {
  return (
    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-terminal-border bg-terminal-bg rounded-b-xl">
      {children}
    </div>
  );
}
