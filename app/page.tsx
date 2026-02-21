'use client';

import { useState } from 'react';

import AuthControls from '@/components/AuthControls';
import DashboardSection from '@/components/features/dashboard/DashboardSection';
import JournalSection from '@/components/features/journal/JournalSection';
import KnowledgeSection from '@/components/KnowledgeSection';
import StatsPanel from '@/components/StatsPanel';

type SectionKey = 'dashboard' | 'journal' | 'knowledge' | 'stats';

export default function Home() {
  const [activeSection, setActiveSection] = useState<SectionKey>('dashboard');
  const currentYear = new Date().getFullYear();

  return (
    <>
      <div className="bg-marble"></div>
      <div className="bg-grid"></div>
      <div className="bg-noise"></div>
      <div className="bg-vines"></div>
      <div className="bg-halo"></div>
      <div className="bg-aurora"></div>

      <header className="site-header">
        <div className="logo">
          Investing<span className="logo-dot">·</span><span className="logo-sub">Garden</span>
        </div>
        <div className="header-actions">
          <nav className="nav">
            <button
              className={`nav-link ${activeSection === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveSection('dashboard')}
            >
              Dashboard
            </button>
            <button
              className={`nav-link ${activeSection === 'journal' ? 'active' : ''}`}
              onClick={() => setActiveSection('journal')}
            >
              Journal
            </button>
            <button
              className={`nav-link ${activeSection === 'knowledge' ? 'active' : ''}`}
              onClick={() => setActiveSection('knowledge')}
            >
              Knowledge
            </button>
            <button
              className={`nav-link ${activeSection === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveSection('stats')}
            >
              Stats
            </button>
          </nav>
          <AuthControls />
        </div>
      </header>

      <main className="wrapper">
        {activeSection === 'dashboard' && <DashboardSection />}

        <section className={`panel ${activeSection === 'journal' ? 'panel-active' : ''}`}>
          {activeSection === 'journal' && <JournalSection />}
        </section>

        <section className={`panel ${activeSection === 'knowledge' ? 'panel-active' : ''}`}>
          {activeSection === 'knowledge' && <KnowledgeSection />}
        </section>

        <section className={`panel ${activeSection === 'stats' ? 'panel-active' : ''}`}>
          {activeSection === 'stats' && <StatsPanel />}
        </section>
      </main>

      <footer className="site-footer">
        <p>© {currentYear} Investing Garden · Built by QD</p>
        <p className="footer-sub">
          Designed for long-term portfolio reflection, not a recommendation engine.
        </p>
      </footer>
    </>
  );
}
