import { useState, useCallback, useEffect } from 'react';
import {
  loadRoot, clearAllData,
  getActiveYearData,
  createFinancialYear, switchYear, deleteFinancialYear,
  initializeSanction,
} from './store/budgetStore';
import SanctionSetup from './components/SanctionSetup';
import Dashboard from './components/Dashboard';
import CodeHeadsView from './components/CodeHeadsView';
import MyBank from './components/MyBank';
import VendorBilling from './components/VendorBilling';
import TransactionLedger from './components/TransactionLedger';
import Reports from './components/Reports';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',      icon: '🏠' },
  { id: 'codeheads', label: 'Code Heads',     icon: '📂' },
  { id: 'mybank',    label: 'My Bank',        icon: '🏦' },
  { id: 'billing',   label: 'Vendor Billing', icon: '🧾' },
  { id: 'ledger',    label: 'Ledger',         icon: '📒' },
  { id: 'reports',   label: 'Reports',        icon: '📊' },
];

export default function App() {
  const [root, setRoot] = useState({ financialYears: {}, activeYear: null });
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [activePage, setActivePage] = useState('dashboard');
  const [showYearPanel, setShowYearPanel] = useState(false);
  const [newYearInput, setNewYearInput] = useState('');
  const [yearError, setYearError] = useState('');
  const [deleteYearConfirm, setDeleteYearConfirm] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  // ── Initial load ──────────────────────────────────────────────
  useEffect(() => {
    loadRoot()
      .then(r => { setRoot(r); setLoading(false); })
      .catch(err => {
        setApiError('Cannot connect to the database server. Please make sure the backend is running (npm run server).');
        setLoading(false);
      });
  }, []);

  const yd = getActiveYearData(root);
  const years = Object.keys(root.financialYears).sort();

  // ── Generic async mutation wrapper ────────────────────────────
  const mutate = useCallback(async (fn, onSuccess) => {
    setIsMutating(true);
    setYearError('');
    try {
      const newRoot = await fn();
      setRoot(newRoot);
      if (onSuccess) onSuccess();
    } catch (e) {
      setYearError(e.message);
    } finally {
      setIsMutating(false);
    }
  }, []);

  // Called by child components when they get a new root back from an API call
  const updateRoot = useCallback((newRoot) => {
    setRoot(newRoot);
  }, []);

  const handleInit = useCallback((newRoot) => {
    setRoot(newRoot);
    setActivePage('dashboard');
  }, []);

  const handleSwitchYear = (y) => {
    mutate(() => switchYear(y), () => {
      setShowYearPanel(false);
      setActivePage('dashboard');
    });
  };

  const handleCreateYear = () => {
    if (!newYearInput.trim()) return;
    mutate(() => createFinancialYear(newYearInput.trim()), () => {
      setNewYearInput('');
      setShowYearPanel(false);
      setActivePage('dashboard');
    });
  };

  const handleDeleteYear = (y) => {
    mutate(() => deleteFinancialYear(y), () => {
      setDeleteYearConfirm(null);
      setShowYearPanel(false);
      setActivePage('dashboard');
    });
  };

  const handleClearAll = () => {
    mutate(() => clearAllData(), () => {
      setShowResetConfirm(false);
      setActivePage('dashboard');
    });
  };

  const renderPage = () => {
    if (!yd) return null;
    switch (activePage) {
      case 'dashboard':  return <Dashboard   state={yd} />;
      case 'codeheads':  return <CodeHeadsView state={yd} root={root} year={root.activeYear} onRootChange={updateRoot} />;
      case 'mybank':     return <MyBank state={yd} root={root} year={root.activeYear} onRootChange={updateRoot} />;
      case 'billing':    return <VendorBilling  state={yd} root={root} year={root.activeYear} onRootChange={updateRoot} />;
      case 'ledger':     return <TransactionLedger state={yd} root={root} year={root.activeYear} onRootChange={updateRoot} />;
      case 'reports':    return <Reports       state={yd} />;
      default:           return <Dashboard   state={yd} />;
    }
  };

  // ── Loading state ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="setup-screen">
        <div className="setup-card" style={{ maxWidth: '380px', textAlign: 'center' }}>
          <div className="setup-card-icon" style={{ fontSize: '2.5rem' }}>⏳</div>
          <h2 className="page-title" style={{ marginBottom: '0.5rem' }}>Connecting to Database</h2>
          <p className="page-subtitle">Loading your financial data...</p>
        </div>
      </div>
    );
  }

  // ── API error / server not running ────────────────────────────
  if (apiError) {
    return (
      <div className="setup-screen">
        <div className="setup-card" style={{ maxWidth: '520px' }}>
          <div className="setup-card-icon" style={{ fontSize: '2.5rem' }}>🔌</div>
          <h2 className="page-title" style={{ marginBottom: '0.5rem', color: 'var(--clr-danger)' }}>Database Server Offline</h2>
          <p className="page-subtitle" style={{ marginBottom: '1.5rem' }}>The backend API server is not running.</p>
          <div className="alert alert-danger">
            <span>⚠️</span>
            <span>{apiError}</span>
          </div>
          <div style={{ marginTop: '1.5rem', background: 'var(--clr-surface-2)', borderRadius: 'var(--r-sm)', padding: '1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--clr-text)' }}>
            <p style={{ marginBottom: '0.5rem', fontWeight: 700 }}>Start the server:</p>
            <code>npm run dev:full</code>
            <p style={{ marginTop: '0.75rem', marginBottom: '0.25rem', color: 'var(--clr-text-subtle)' }}>or separately:</p>
            <code>npm run server</code>
          </div>
          <button
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '1.5rem' }}
            onClick={() => { setLoading(true); setApiError(''); loadRoot().then(r => { setRoot(r); setLoading(false); }).catch(() => { setApiError('Still cannot connect. Please start the server.'); setLoading(false); }); }}
          >
            🔄 Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // ── No years at all — show new-year prompt ───────────────────
  if (years.length === 0 || !root.activeYear) {
    return (
      <div className="setup-screen">
        <div className="setup-card" style={{ maxWidth: '480px' }}>
          <div className="setup-card-icon">📅</div>
          <h1 className="page-title text-center" style={{ marginBottom: '0.25rem' }}>
            CDA Budget Workflow
          </h1>
          <p className="page-subtitle text-center" style={{ marginBottom: '2rem' }}>
            Create your first Financial Year to begin
          </p>
          <div className="form-group">
            <label className="form-label">Financial Year</label>
            <input
              id="first-year-input"
              className="form-input"
              placeholder="e.g. 2025-26"
              value={newYearInput}
              onChange={e => { setNewYearInput(e.target.value); setYearError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleCreateYear()}
            />
          </div>
          {yearError && (
            <div className="alert alert-danger mt-sm"><span>⚠️</span><span>{yearError}</span></div>
          )}
          <button
            id="create-first-year-btn"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '1rem' }}
            onClick={handleCreateYear}
            disabled={isMutating}
          >
            {isMutating ? '⏳ Creating...' : '📅 Create Financial Year'}
          </button>
        </div>
      </div>
    );
  }

  // ── Year not initialized — show sanction setup ───────────────
  if (!yd || !yd.initialized) {
    return <SanctionSetup root={root} year={root.activeYear} onInit={handleInit} onYearSwitch={() => setShowYearPanel(true)} />;
  }

  // ── Main App ─────────────────────────────────────────────────
  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">💰</div>
          <h1>CDA Budget<br />Workflow</h1>
          <p>Supply Depot ASC</p>
        </div>

        {/* Year Selector */}
        <div style={{ padding: '0 var(--sp-sm) var(--sp-md)', borderBottom: '1px solid rgba(255,255,255,0.12)', marginBottom: 'var(--sp-sm)' }}>
          <button
            id="year-selector-btn"
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', justifyContent: 'space-between', color: '#fff8e7', borderColor: 'rgba(239,202,126,0.36)', background: 'rgba(183,121,31,0.18)' }}
            onClick={() => setShowYearPanel(true)}
          >
            <span>📅 FY {root.activeYear}</span>
            <span style={{ fontSize: '0.65rem', color: 'rgba(247,250,239,0.66)' }}>▼ Switch</span>
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <p style={{ fontSize: '0.65rem', color: 'rgba(247,250,239,0.66)' }}>
            SQLite Database · Data persists on disk
          </p>
          <button
            id="reset-all-data-btn"
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--clr-danger)', borderColor: 'rgba(239, 68, 68, 0.15)', width: '100%', fontSize: '0.68rem', padding: '4px 6px' }}
            onClick={() => setShowResetConfirm(true)}
          >
            ⚠️ Clear All Data
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {renderPage()}
      </main>

      {/* Year Panel (Side Drawer) */}
      {showYearPanel && (
        <div className="modal-overlay" onClick={() => setShowYearPanel(false)}>
          <div
            className="modal-box"
            style={{ maxWidth: '400px', marginLeft: 'auto', marginRight: '2rem' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">📅 Financial Years</h3>
              <button className="modal-close" onClick={() => setShowYearPanel(false)}>✕</button>
            </div>

            {/* Existing Years */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {years.map(y => (
                <div
                  key={y}
                  className="flex items-center justify-between"
                  style={{
                    padding: '0.625rem var(--sp-md)',
                    borderRadius: 'var(--r-sm)',
                    border: `1px solid ${y === root.activeYear ? 'rgba(67,92,43,0.38)' : 'var(--clr-border)'}`,
                    background: y === root.activeYear ? 'rgba(67,92,43,0.1)' : 'var(--clr-surface-2)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => handleSwitchYear(y)}
                >
                  <div>
                    <span style={{ fontWeight: 700, color: y === root.activeYear ? 'var(--clr-primary)' : 'var(--clr-text)', fontSize: '0.9rem' }}>
                      FY {y}
                    </span>
                    {root.financialYears[y]?.initialized ? (
                      <span className="badge badge-success" style={{ marginLeft: '0.5rem', fontSize: '0.62rem' }}>Active</span>
                    ) : (
                      <span className="badge badge-warning" style={{ marginLeft: '0.5rem', fontSize: '0.62rem' }}>Setup Pending</span>
                    )}
                    <p style={{ fontSize: '0.7rem', color: 'var(--clr-text-subtle)', marginTop: '2px' }}>
                      {(root.financialYears[y]?.transactions || []).length} transactions
                    </p>
                  </div>
                  <div className="flex gap-sm">
                    {y === root.activeYear && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--clr-primary)', fontWeight: 600 }}>CURRENT</span>
                    )}
                    {years.length > 1 && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--clr-danger)', padding: '2px 6px', fontSize: '0.75rem' }}
                        onClick={e => { e.stopPropagation(); setDeleteYearConfirm(y); }}
                        title="Delete this year"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add new year */}
            <div className="divider" />
            <p className="form-label" style={{ marginBottom: '0.5rem', marginTop: '1rem' }}>Add New Financial Year</p>
            <div className="flex gap-sm">
              <input
                id="new-year-input"
                className="form-input"
                placeholder="e.g. 2026-27"
                value={newYearInput}
                onChange={e => { setNewYearInput(e.target.value); setYearError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleCreateYear()}
                style={{ flex: 1 }}
              />
              <button id="add-year-btn" className="btn btn-primary" onClick={handleCreateYear} disabled={isMutating}>
                {isMutating ? '...' : '+ Add'}
              </button>
            </div>
            {yearError && (
              <div className="alert alert-danger mt-sm" style={{ marginTop: '0.5rem' }}>
                <span>⚠️</span><span>{yearError}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Year Confirm */}
      {deleteYearConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteYearConfirm(null)}>
          <div className="modal-box" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete FY {deleteYearConfirm}?</h3>
              <button className="modal-close" onClick={() => setDeleteYearConfirm(null)}>✕</button>
            </div>
            <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
              <span>⚠️</span>
              <span>
                All data for <strong>FY {deleteYearConfirm}</strong> — including transactions, allocations, and code heads — will be permanently deleted.
              </span>
            </div>
            <div className="flex gap-md">
              <button id="confirm-delete-year-btn" className="btn btn-danger" onClick={() => handleDeleteYear(deleteYearConfirm)} disabled={isMutating}>
                {isMutating ? '⏳...' : '🗑️ Delete Year'}
              </button>
              <button className="btn btn-ghost" onClick={() => setDeleteYearConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset System Confirm */}
      {showResetConfirm && (
        <div className="modal-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="modal-box" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Clear All Data?</h3>
              <button className="modal-close" onClick={() => setShowResetConfirm(false)}>✕</button>
            </div>
            <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
              <span>⚠️</span>
              <span>
                <strong>Warning:</strong> This will permanently delete all financial years, code heads, allocations, and transaction ledgers from the database. This action cannot be undone.
              </span>
            </div>
            <div className="flex gap-md">
              <button
                id="confirm-reset-btn"
                className="btn btn-danger"
                disabled={isMutating}
                onClick={handleClearAll}
              >
                {isMutating ? '⏳ Clearing...' : '🚨 Yes, Delete Everything'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowResetConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
