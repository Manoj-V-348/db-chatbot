import { useEffect, useMemo, useState } from 'react';
import Chat from './components/Chat';
import DataTable from './components/DataTable';
import SportsTable from './components/SportsTable';
import EducationTable from './components/EducationTable';
import MergedLocationTable from './components/MergedLocationTable';

type TabId = 'chat' | 'data' | 'sports' | 'education' | 'merged';

const TABS: Array<{ id: TabId; label: string; description: string; icon: string }> = [
  {
    id: 'chat',
    label: 'Chat',
    description: 'Ask natural-language questions powered by AI',
    icon: '💬',
  },
  {
    id: 'data',
    label: 'Finance',
    description: 'Explore, filter, and export financial data',
    icon: '💰',
  },
  {
    id: 'sports',
    label: 'Sports',
    description: 'View sports metrics and achievements',
    icon: '🏆',
  },
  {
    id: 'education',
    label: 'Education',
    description: 'Track academic performance and metrics',
    icon: '📚',
  },
  {
    id: 'merged',
    label: 'Merged by Location',
    description: 'Unified view across all data sources',
    icon: '🗺️',
  },
];

function resolveHash(): TabId {
  if (typeof window === 'undefined') {
    return 'chat';
  }

  const hashValue = window.location.hash.replace('#', '').replace('/', '') as TabId;
  if (['chat', 'data', 'sports', 'education', 'merged'].includes(hashValue)) {
    return hashValue;
  }
  return 'chat';
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>(() => resolveHash());

  useEffect(() => {
    const handleHashChange = () => {
      setActiveTab(resolveHash());
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  useEffect(() => {
    const targetHash = `#/${activeTab}`;
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetHash);
    }
  }, [activeTab]);

  const currentTab = useMemo(() => TABS.find((tab) => tab.id === activeTab) ?? TABS[0], [activeTab]);

  return (
    <div className="relative min-h-screen">
      {/* Background with aurora effect */}
      <div className="pointer-events-none fixed inset-0 bg-aurora opacity-90" aria-hidden />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Enhanced Header */}
        <header className="sticky top-0 z-50 border-b border-white/10 bg-surface-glass/80 shadow-elevation backdrop-blur-xl">
          <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            {/* Top bar with branding and status */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {/* Logo/Brand */}
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-soft shadow-glow-sm">
                  <svg
                    className="h-7 w-7 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </div>

                {/* Title and subtitle */}
                <div>
                  <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
                    Varsity Chat
                  </h1>
                  <p className="text-xs text-slate-400 sm:text-sm">
                    AI-powered institutional data analytics
                  </p>
                </div>
              </div>

              {/* Status indicator */}
              <div className="flex items-center gap-2 rounded-full border border-success/20 bg-success/10 px-4 py-2 text-xs font-medium text-success-light backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success"></span>
                </span>
                Live Data
              </div>
            </div>

            {/* Navigation tabs */}
            <nav className="mt-6 flex flex-wrap gap-3" role="tablist" aria-label="Main navigation">
              {TABS.map((tab) => {
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`${tab.id}-panel`}
                    onClick={() => setActiveTab(tab.id)}
                    className={`group relative flex min-w-[200px] flex-1 items-center gap-3 overflow-hidden rounded-2xl border px-5 py-4 text-left transition-all duration-300 ease-gentle sm:min-w-[280px] sm:max-w-[320px] ${
                      isActive
                        ? 'border-white/80 bg-white/95 text-ink shadow-elevation-soft hover:shadow-elevation'
                        : 'border-white/15 bg-white/5 text-slate-100 hover:border-white/30 hover:bg-white/8 hover:shadow-pill-soft'
                    }`}
                  >
                    {/* Icon */}
                    <span className="text-2xl opacity-80 transition-transform duration-300 group-hover:scale-110">
                      {tab.icon}
                    </span>

                    {/* Tab content */}
                    <div className="flex-1">
                      <span className="block text-base font-semibold">{tab.label}</span>
                      <span
                        className={`mt-0.5 block text-xs transition-opacity duration-300 ${
                          isActive ? 'text-slate-600' : 'text-slate-400 group-hover:text-slate-300'
                        }`}
                      >
                        {tab.description}
                      </span>
                    </div>

                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-accent to-accent-soft" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        {/* Main content area */}
        <main
          id={`${currentTab.id}-panel`}
          role="tabpanel"
          aria-labelledby={`${currentTab.id}-tab`}
          className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-12 pt-8 text-slate-100 sm:px-6 lg:px-8"
        >
          <div className="animate-fade-in">
            {currentTab.id === 'chat' && <Chat />}
            {currentTab.id === 'data' && <DataTable />}
            {currentTab.id === 'sports' && <SportsTable />}
            {currentTab.id === 'education' && <EducationTable />}
            {currentTab.id === 'merged' && <MergedLocationTable />}
          </div>
        </main>

        {/* Enhanced footer */}
        <footer className="relative border-t border-white/8 bg-surface-glass/70 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              {/* Footer content */}
              <div className="text-center sm:text-left">
                <p className="text-sm font-medium text-slate-300">
                  Varsity Chat
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  AI-powered analytics for educational institutions
                </p>
              </div>

              {/* Copyright */}
              <div className="text-xs text-slate-500">
                © {new Date().getFullYear()} All rights reserved
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;

