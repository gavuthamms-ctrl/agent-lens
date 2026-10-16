import React from 'react';
import { PageId } from './Sidebar';

interface TopbarProps {
  currentPage: PageId;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onGenerateDemo: () => void;
  onNavigate: (page: PageId) => void;
}

const PAGE_TITLES: Record<PageId, string> = {
  dashboard: '📊 Dashboard',
  upload: '📤 Upload / Paste',
  analysis: '🔬 Analysis View',
  evaluation: '📏 Evaluation',
  about: '📖 About',
};

export const Topbar: React.FC<TopbarProps> = ({
  currentPage,
  theme,
  onToggleTheme,
  onGenerateDemo,
  onNavigate,
}) => {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <span>{PAGE_TITLES[currentPage] || currentPage}</span>
      </div>
      <div className="topbar-actions">
        <button className="btn btn-secondary btn-sm" onClick={onGenerateDemo}>
          🎭 Generate Demo
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => onNavigate('upload')}>
          📤 Upload Trace
        </button>
        <button className="btn-theme-toggle" onClick={onToggleTheme}>
          {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>
      </div>
    </header>
  );
};
