import React from 'react';

export type PageId = 'dashboard' | 'upload' | 'analysis' | 'evaluation' | 'about';

interface SidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  systemMode: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, systemMode }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-badge">🔍</div>
        <div className="logo-text">
          Agent<span>Lens</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div
          className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          <span className="nav-icon">📊</span>
          <span>Dashboard</span>
        </div>
        <div
          className={`nav-item ${currentPage === 'upload' ? 'active' : ''}`}
          onClick={() => onNavigate('upload')}
        >
          <span className="nav-icon">📤</span>
          <span>Upload / Paste</span>
        </div>
        <div
          className={`nav-item ${currentPage === 'analysis' ? 'active' : ''}`}
          onClick={() => onNavigate('analysis')}
        >
          <span className="nav-icon">🔬</span>
          <span>Analysis View</span>
        </div>
        <div
          className={`nav-item ${currentPage === 'evaluation' ? 'active' : ''}`}
          onClick={() => onNavigate('evaluation')}
        >
          <span className="nav-icon">📏</span>
          <span>Evaluation</span>
        </div>
        <div
          className={`nav-item ${currentPage === 'about' ? 'active' : ''}`}
          onClick={() => onNavigate('about')}
        >
          <span className="nav-icon">📖</span>
          <span>About</span>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          System Status
        </div>
        <div className="system-status">
          <div className="status-dot"></div>
          <span style={{ fontSize: '12px' }}>{systemMode}</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
          AgentLens v1.0.0
        </div>
      </div>
    </aside>
  );
};
