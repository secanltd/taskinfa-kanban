import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kanban — by Taskinfa',
  description: 'Autonomous task automation with Claude Code',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-terminal-bg text-terminal-text font-mono">
        {children}
      </body>
    </html>
  );
}
