'use client';

import { useState } from 'react';
import Section from '@/components/Section';

export default function Home() {
  const [activeSection, setActiveSection] = useState<'journal' | 'learning' | 'resources'>('journal');
  const currentYear = new Date().getFullYear();

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
                <div className="stat-value">$3,000</div>
                <div className="stat-sub">real money, high learning</div>
              </div>
              <div className="stat-card small">
                <div className="stat-label">Sim return</div>
                <div className="stat-value">+40%</div>
                <div className="stat-sub">Investopedia, since Feb 2025</div>
              </div>
            </div>
            <p className="hero-disclaimer">
              Nothing here is financial advice. This is a student experimenting
              with a tiny amount of capital and writing down what he learns.
            </p>
          </div>
        </section>

        <section className={`panel ${activeSection === 'journal' ? 'panel-active' : ''}`}>
          {activeSection === 'journal' && (
            <Section
              type="journal"
              title="Journal & Trades"
              description="Logs of real & simulated trades, with the reasoning behind them."
            />
          )}
        </section>

        <section className={`panel ${activeSection === 'learning' ? 'panel-active' : ''}`}>
          {activeSection === 'learning' && (
            <Section
              type="learning"
              title="Learning Plan"
              description="What I'm studying each week to get better at investing."
            />
          )}
        </section>

        <section className={`panel ${activeSection === 'resources' ? 'panel-active' : ''}`}>
          {activeSection === 'resources' && (
            <Section
              type="resources"
              title="Resource Vault"
              description="Curated links, courses, and tools with my own notes."
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
