'use client';

import { useEffect, useMemo, useState } from 'react';
import Section from '@/components/Section';

type SectionKey = 'home' | 'journal' | 'learning' | 'resources';
type AccountPoint = { date: string; value: number };

export default function Home() {
  const [activeSection, setActiveSection] = useState<SectionKey>('home');
  const [accountPoints, setAccountPoints] = useState<AccountPoint[]>([]);
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newValue, setNewValue] = useState('3000');
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const saved = localStorage.getItem('accountValues');
    if (saved) {
      try {
        setAccountPoints(JSON.parse(saved));
        return;
      } catch (err) {
        console.error('Failed to parse saved account values', err);
      }
    }
    const today = new Date().toISOString().slice(0, 10);
    setAccountPoints([{ date: today, value: 3000 }]);
  }, []);

  useEffect(() => {
    if (accountPoints.length) {
      localStorage.setItem('accountValues', JSON.stringify(accountPoints));
    }
  }, [accountPoints]);

  const orderedPoints = useMemo(() => {
    const sorted = [...accountPoints].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length === 0) return [];
    const today = new Date();
    const lastRecorded = new Date(sorted[sorted.length - 1].date + 'T00:00:00');
    if (lastRecorded < today) {
      const filler: AccountPoint[] = [];
      const lastValue = sorted[sorted.length - 1].value;
      const cursor = new Date(lastRecorded);
      cursor.setDate(cursor.getDate() + 1);
      while (cursor <= today) {
        filler.push({ date: cursor.toISOString().slice(0, 10), value: lastValue });
        cursor.setDate(cursor.getDate() + 1);
      }
      return [...sorted, ...filler];
    }
    return sorted;
  }, [accountPoints]);

  const handleAddPoint = (e: React.FormEvent) => {
    e.preventDefault();
    const valueNum = Number(newValue);
    if (Number.isNaN(valueNum)) return;
    setAccountPoints(prev => {
      const filtered = prev.filter(p => p.date !== newDate);
      return [...filtered, { date: newDate, value: valueNum }];
    });
  };

  const graphPath = useMemo(() => {
    if (orderedPoints.length === 0) return '';
    const values = orderedPoints.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const width = 100;
    const height = 60;
    return orderedPoints
      .map((p, idx) => {
        const x = (idx / Math.max(orderedPoints.length - 1, 1)) * width;
        const y = height - ((p.value - min) / range) * height;
        return `${x},${y}`;
      })
      .join(' ');
  }, [orderedPoints]);

  return (
    <>
      <div className="bg-grid"></div>
      <div className="bg-noise"></div>

      <header className="site-header">
        <div className="logo">
          WZ<span className="logo-dot">·</span><span className="logo-sub">LAB</span>
        </div>
        <nav className="nav">
          <button
            className={`nav-link ${activeSection === 'home' ? 'active' : ''}`}
            onClick={() => setActiveSection('home')}
          >
            Home
          </button>
          <button
            className={`nav-link ${activeSection === 'journal' ? 'active' : ''}`}
            onClick={() => setActiveSection('journal')}
          >
            Journal
          </button>
          <button
            className={`nav-link ${activeSection === 'learning' ? 'active' : ''}`}
            onClick={() => setActiveSection('learning')}
          >
            Learning
          </button>
          <button
            className={`nav-link ${activeSection === 'resources' ? 'active' : ''}`}
            onClick={() => setActiveSection('resources')}
          >
            Resources
          </button>
        </nav>
      </header>

      <main className="wrapper">
        {activeSection === 'home' && (
          <>
            <section className="hero">
              <div className="hero-left">
                <p className="eyebrow">project / investing</p>
                <h1>William Zhang&apos;s<br /><span className="accent">Investing Lab</span></h1>
                <p className="hero-text">
                  A public lab notebook for my investing journey – tracking account
                  value, trades, and learning progress. Built to keep me honest,
                  curious, and compounding.
                </p>
                <div className="hero-tags">
                  <span className="tag">long-term</span>
                  <span className="tag">AI & semis</span>
                  <span className="tag">learning in public</span>
                </div>
              </div>
              <div className="hero-right">
                <div className="stat-card">
                  <div className="stat-label">Current focus</div>
                  <div className="stat-value">AI hardware & infra</div>
                  <div className="stat-sub">chips · memory · cloud · tools</div>
                </div>
                <div className="stat-row">
                  <div className="stat-card small">
                    <div className="stat-label">Account</div>
                    <div className="stat-value">
                      {orderedPoints.length ? `$${orderedPoints[orderedPoints.length - 1].value.toLocaleString()}` : '$3,000'}
                    </div>
                    <div className="stat-sub">real money, high learning</div>
                  </div>
                </div>
                <p className="hero-disclaimer">
                  Nothing here is financial advice. This is a student experimenting
                  with a tiny amount of capital and writing down what he learns.
                </p>
              </div>
            </section>

            <section className="account-section">
              <div className="account-header">
                <div>
                  <p className="eyebrow">Account value</p>
                  <h2>Trajectory</h2>
                  <p className="hero-text">Log values manually; days without updates stay flat. Built for honesty, not precision.</p>
                </div>
                <form className="account-form" onSubmit={handleAddPoint}>
                  <label>
                    Date
                    <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required />
                  </label>
                  <label>
                    Value (USD)
                    <input type="number" value={newValue} onChange={(e) => setNewValue(e.target.value)} required min="0" step="1" />
                  </label>
                  <button type="submit" className="btn-primary">Add / Update</button>
                </form>
              </div>
              <div className="account-graph">
                {orderedPoints.length ? (
                  <>
                    <svg viewBox="0 0 100 60" preserveAspectRatio="none">
                      <polyline points={graphPath} fill="none" stroke="url(#grad)" strokeWidth="1.2" />
                      <defs>
                        <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" />
                          <stop offset="100%" stopColor="#0ea5e9" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="account-stats">
                      <div>
                        <p className="stat-label">Latest</p>
                        <p className="stat-value">${orderedPoints[orderedPoints.length - 1].value.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="stat-label">Start</p>
                        <p className="stat-value">${orderedPoints[0].value.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="stat-label">Entries</p>
                        <p className="stat-value">{accountPoints.length}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="empty-message">Add your first account value to see the graph.</p>
                )}
              </div>
            </section>
          </>
        )}

        <section className={`panel ${activeSection === 'journal' ? 'panel-active' : ''}`}>
          {activeSection === 'journal' && (
            <Section
              type="journal"
              title="Trade Journal"
              description="Chronicle of moves with rationale, emotions, and post-trade reflections."
            />
          )}
        </section>

        <section className={`panel ${activeSection === 'learning' ? 'panel-active' : ''}`}>
          {activeSection === 'learning' && (
            <Section
              type="learning"
              title="Learning Planner"
              description="Weekly sprints, checkpoints, and progress notes toward competency."
            />
          )}
        </section>

        <section className={`panel ${activeSection === 'resources' ? 'panel-active' : ''}`}>
          {activeSection === 'resources' && (
            <Section
              type="resources"
              title="Research Library"
              description="Links, papers, videos, and tools with quick notes and tags."
            />
          )}
        </section>
      </main>

      <footer className="site-footer">
        <p>© {currentYear} William Zhang · Investing Lab</p>
        <p className="footer-sub">
          Built as a long-term experiment in learning markets, not a
          recommendation engine.
        </p>
      </footer>
    </>
  );
}
