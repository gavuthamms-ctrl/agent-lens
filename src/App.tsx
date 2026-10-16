import React, { useEffect, useState } from 'react';
import { PageId, Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { DashboardPage } from './components/DashboardPage';
import { UploadPage } from './components/UploadPage';
import { AnalysisPage } from './components/AnalysisPage';
import { EvaluationPage } from './components/EvaluationPage';
import { AboutPage } from './components/AboutPage';
import { DefectDrawer, DrawerContent } from './components/DefectDrawer';
import { TraceReport, TraceSummaryItem } from './types';
import { TraceStorage } from './services/storage';

interface ToastItem {
  id: string;
  msg: string;
  type: 'success' | 'error' | 'info';
}

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [traces, setTraces] = useState<TraceSummaryItem[]>([]);
  const [allReports, setAllReports] = useState<TraceReport[]>([]);
  const [currentReport, setCurrentReport] = useState<TraceReport | null>(null);
  const [selectedEvalTraceId, setSelectedEvalTraceId] = useState<number | null>(null);
  const [drawerContent, setDrawerContent] = useState<DrawerContent>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('al-theme') as 'dark' | 'light') || 'dark';
  });
  const [systemMode, setSystemMode] = useState<string>('DETECTING ENGINE…');
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('al-theme', theme);
  }, [theme]);

  useEffect(() => {
    import('./services/llmJudge').then(({ LLMJudge }) => {
      LLMJudge.getEngineStatus().then(status => {
        if (status.hasApiKey) {
          setSystemMode('GEMINI 3.8 FLASH ACTIVE');
        } else {
          setSystemMode('OFFLINE HEURISTIC ENGINE');
        }
      }).catch(() => {
        setSystemMode('OFFLINE HEURISTIC ENGINE');
      });
    });
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3800);
  };

  const showLoading = (msg: string = 'Analyzing trace…') => {
    setLoadingMsg(msg);
  };

  const hideLoading = () => {
    setLoadingMsg(null);
  };

  const loadTraces = async () => {
    try {
      const list = await TraceStorage.listTraces();
      setTraces(list);
      const reports = await TraceStorage.getAllReports();
      setAllReports(reports);
      if (reports.length > 0 && !currentReport) {
        setCurrentReport(reports[0]);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load traces', 'error');
    }
  };

  useEffect(() => {
    loadTraces();
  }, []);

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleNavigate = (page: PageId) => {
    setCurrentPage(page);
    if (page === 'dashboard') {
      loadTraces();
    }
  };

  const handleOpenTrace = async (traceId: number) => {
    showLoading('Loading trace report…');
    try {
      const report = await TraceStorage.getTraceReport(traceId);
      setCurrentReport(report);
      setCurrentPage('analysis');
    } catch (err: any) {
      showToast(err.message || 'Failed to load trace report', 'error');
    } finally {
      hideLoading();
    }
  };

  const handleOpenEval = (traceId: number) => {
    setSelectedEvalTraceId(traceId);
    setCurrentPage('evaluation');
  };

  const handleDeleteTrace = async (traceId: number) => {
    if (!window.confirm(`Delete trace #${traceId}? This action cannot be undone.`)) return;
    showLoading('Deleting trace…');
    try {
      await TraceStorage.deleteTrace(traceId);
      showToast(`Trace #${traceId} deleted.`, 'success');
      await loadTraces();
      if (currentReport?.trace_id === traceId) {
        setCurrentReport(null);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete trace', 'error');
    } finally {
      hideLoading();
    }
  };

  const handleReanalyze = async (traceId: number) => {
    showLoading('Re-running detection pipeline…');
    try {
      const report = await TraceStorage.reanalyzeTrace(traceId);
      setCurrentReport(report);
      showToast('Re-analysis complete!', 'success');
      await loadTraces();
    } catch (err: any) {
      showToast(err.message || 'Re-analysis failed', 'error');
    } finally {
      hideLoading();
    }
  };

  const handleGenerateDemo = async (clean: boolean = false) => {
    showLoading(clean ? 'Generating clean demo trace…' : 'Generating defect-injected demo trace…');
    try {
      const report = await TraceStorage.generateDemo({ clean });
      setCurrentReport(report);
      showToast(`Demo trace "${report.trace_name}" generated!`, 'success');
      await loadTraces();
      setCurrentPage('analysis');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate demo', 'error');
    } finally {
      hideLoading();
    }
  };

  return (
    <div id="app">
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        systemMode={systemMode}
      />

      <div className="main-wrapper">
        <Topbar
          currentPage={currentPage}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onGenerateDemo={() => handleGenerateDemo(false)}
          onNavigate={handleNavigate}
        />

        <main className="content-area">
          {currentPage === 'dashboard' && (
            <DashboardPage
              traces={traces}
              latestReport={currentReport}
              allReports={allReports}
              theme={theme}
              onRefresh={loadTraces}
              onOpenTrace={handleOpenTrace}
              onOpenEval={handleOpenEval}
              onDeleteTrace={handleDeleteTrace}
              onNavigateUpload={() => setCurrentPage('upload')}
              onGenerateDemo={() => handleGenerateDemo(false)}
            />
          )}

          {currentPage === 'upload' && (
            <UploadPage
              onSuccess={report => {
                setCurrentReport(report);
                loadTraces();
                setCurrentPage('analysis');
              }}
              showToast={showToast}
              showLoading={showLoading}
              hideLoading={hideLoading}
              onGenerateDemo={handleGenerateDemo}
            />
          )}

          {currentPage === 'analysis' && (
            <AnalysisPage
              report={currentReport}
              theme={theme}
              onReanalyze={handleReanalyze}
              onOpenEval={handleOpenEval}
              onOpenDrawer={setDrawerContent}
            />
          )}

          {currentPage === 'evaluation' && (
            <EvaluationPage
              traces={traces}
              selectedTraceId={selectedEvalTraceId}
              theme={theme}
              showToast={showToast}
              showLoading={showLoading}
              hideLoading={hideLoading}
            />
          )}

          {currentPage === 'about' && <AboutPage />}
        </main>
      </div>

      {/* Defect / Node / Edge Drawer */}
      <DefectDrawer
        content={drawerContent}
        onClose={() => setDrawerContent(null)}
        onSelectDefect={d => setDrawerContent({ type: 'defect', defect: d })}
      />

      {/* Loading Overlay */}
      {loadingMsg && (
        <div className="loading-overlay open">
          <div className="spinner"></div>
          <div className="loading-msg">{loadingMsg}</div>
        </div>
      )}

      {/* Toast Container */}
      <div id="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
