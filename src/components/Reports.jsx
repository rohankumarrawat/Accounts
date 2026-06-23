import { useState } from 'react';
import {
  formatAmount, getCodeHeadStats,
  getTotalSpent, getImprestBalance, getTotalAllocated,
  getTotalCdaSpent, getCdaBalance, getTransactionTotalAmount,
  getTransactionWorkingAmount, getTransactionCdaAmount,
} from '../store/budgetStore';

export default function Reports({ state: yd }) {
  const [activeTab, setActiveTab] = useState('summary');
  const [filterVendor, setFilterVendor] = useState('');
  const [filterCodeHead, setFilterCodeHead] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedVendors, setCollapsedVendors] = useState({});

  const codeHeads = yd.codeHeads || [];
  const transactions = yd.transactions || [];
  const totalSpent = getTotalSpent(yd);
  const imprest = getImprestBalance(yd);
  const totalAllocated = getTotalAllocated(yd);
  const cdaSpent = getTotalCdaSpent(yd);
  const cdaBalance = getCdaBalance(yd);
  const allotmentHistory = [...(yd.allotmentHistory || [])]
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // Compute unique vendors for filter dropdown
  const uniqueVendors = [...new Set(transactions.map(t => t.vendorName).filter(Boolean))].sort();

  // Filter transactions
  const filteredTxns = transactions.filter(t => {
    if (filterVendor && t.vendorName !== filterVendor) return false;
    if (filterCodeHead && t.codeHeadId !== filterCodeHead) return false;
    if (filterDateFrom && t.date < filterDateFrom) return false;
    if (filterDateTo && t.date > filterDateTo) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const ch = codeHeads.find(c => c.id === t.codeHeadId);
      const matches =
        (t.vendorName || '').toLowerCase().includes(q) ||
        (t.billNo || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.remarks || '').toLowerCase().includes(q) ||
        (t.iafsNo || '').toLowerCase().includes(q) ||
        (t.billNoDt || '').toLowerCase().includes(q) ||
        (ch && (ch.code || '').toLowerCase().includes(q)) ||
        (ch && (ch.name || '').toLowerCase().includes(q));
      if (!matches) return false;
    }
    return true;
  });

  // Calculate Code Head stats dynamically based on filtered transactions
  const codeHeadReports = codeHeads.map(ch => {
    const stats = getCodeHeadStats(yd, ch.id);
    const chFilteredTxns = filteredTxns.filter(t => t.codeHeadId === ch.id);
    const spent = chFilteredTxns.reduce((acc, t) => acc + getTransactionWorkingAmount(t), 0);
    const cdaSpent = chFilteredTxns.reduce((acc, t) => acc + getTransactionCdaAmount(t), 0);
    const txnCount = chFilteredTxns.length;
    const cfl = stats.workingAllocated - spent;
    const pct = stats.workingAllocated > 0 ? Math.min((spent / stats.workingAllocated) * 100, 100) : 0;

    return {
      ...ch,
      ...stats,
      spent,
      cdaSpent,
      cfl,
      txnCount,
      pct,
    };
  });

  return (
    <div>
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="page-title">Reports — FY {yd.sanction.financialYear}</h2>
            <p className="page-subtitle">Budget utilization reports and statements</p>
          </div>
          <button id="print-report-btn" className="btn btn-ghost no-print" onClick={() => window.print()}>
            🖨️ Print
          </button>
        </div>
      </div>

      {/* Print-only active filters banner */}
      {(filterVendor || filterCodeHead || filterDateFrom || filterDateTo || searchQuery) && (
        <div className="print-only" style={{ border: '1px solid var(--clr-border)', padding: '10px 14px', marginBottom: '1.5rem', borderRadius: 'var(--r-sm)', background: '#fff', fontSize: '0.78rem' }}>
          <strong style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--clr-primary)', display: 'block', marginBottom: '4px' }}>
            Active Filter Parameters:
          </strong>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {filterVendor && <span><strong>Vendor:</strong> {filterVendor}</span>}
            {filterCodeHead && <span><strong>Code Head:</strong> {codeHeads.find(c => c.id === filterCodeHead)?.code}</span>}
            {filterDateFrom && <span><strong>From Date:</strong> {filterDateFrom}</span>}
            {filterDateTo && <span><strong>To Date:</strong> {filterDateTo}</span>}
            {searchQuery && <span><strong>Search Keyword:</strong> "{searchQuery}"</span>}
            <span><strong>Total Filtered Transactions:</strong> {filteredTxns.length}</span>
          </div>
        </div>
      )}

      {/* Filter panel (no-print) */}
      <div className="card mb-lg no-print" style={{ border: '1px solid var(--clr-border)', padding: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>Filter by Vendor</label>
            <select className="form-select" value={filterVendor} onChange={e => setFilterVendor(e.target.value)}>
              <option value="">All Vendors</option>
              {uniqueVendors.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>Filter by Code Head</label>
            <select className="form-select" value={filterCodeHead} onChange={e => setFilterCodeHead(e.target.value)}>
              <option value="">All Code Heads</option>
              {codeHeads.map(ch => (
                <option key={ch.id} value={ch.id}>{ch.code} - {ch.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>From Date</label>
            <input type="date" className="form-input" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>To Date</label>
            <input type="date" className="form-input" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>Keyword Search</label>
            <input type="text" className="form-input" placeholder="Search PV, Description, Bill No, IAFS..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>

          <div>
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => {
              setFilterVendor('');
              setFilterCodeHead('');
              setFilterDateFrom('');
              setFilterDateTo('');
              setSearchQuery('');
            }}>
              🧹 Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-sm mb-lg no-print">
        {[
          { id: 'summary',  label: '📊 Summary' },
          { id: 'codehead', label: '📋 Code Head-wise' },
          { id: 'allotment', label: '💰 Allotment History' },
          { id: 'vendor',   label: '🏪 Vendor-wise' },
          { id: 'transactions', label: '📝 All Transactions' },
        ].map(tab => (
          <button key={tab.id} id={`tab-${tab.id}`}
            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Summary Tab ── */}
      {activeTab === 'summary' && (
        <div>
          {/* Active Filters Summary (If any filter is active) */}
          {(filterVendor || filterCodeHead || filterDateFrom || filterDateTo || searchQuery) && (
            <div className="card mb-lg" style={{ borderLeft: '4px solid var(--clr-primary)', padding: '1rem 1.25rem' }}>
              <h4 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--clr-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                🔍 Filtered Transactions Summary
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.25rem' }}>
                <div>
                  <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--clr-text-subtle)', fontWeight: 600, marginBottom: '4px' }}>Filtered PV Count</p>
                  <p style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--clr-text)' }}>{filteredTxns.length} bills</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--clr-text-subtle)', fontWeight: 600, marginBottom: '4px' }}>Filtered Working Share Spent</p>
                  <p style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--clr-text)' }}>
                    ₹{formatAmount(filteredTxns.reduce((sum, t) => sum + getTransactionWorkingAmount(t), 0))}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--clr-text-subtle)', fontWeight: 600, marginBottom: '4px' }}>Filtered CDA Share Spent</p>
                  <p style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--clr-text)' }}>
                    ₹{formatAmount(filteredTxns.reduce((sum, t) => sum + getTransactionCdaAmount(t), 0))}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--clr-text-subtle)', fontWeight: 600, marginBottom: '4px' }}>Filtered Total Paid</p>
                  <p style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--clr-danger)' }}>
                    ₹{formatAmount(filteredTxns.reduce((sum, t) => sum + getTransactionTotalAmount(t), 0))}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="card mb-lg">
            <div style={{ textAlign: 'center', borderBottom: '1px solid var(--clr-border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--clr-text)' }}>
                BUDGET UTILIZATION STATEMENT
              </h3>
              <p style={{ color: 'var(--clr-text-muted)', fontSize: '0.88rem' }}>
                {yd.sanction.depotName} · FY {yd.sanction.financialYear}
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: '1rem' }}>
              {[
                { label: 'Total Code Head Allotment', value: `₹${formatAmount(yd.sanction.totalAmount)}` },
                { label: 'Sanction No.', value: yd.sanction.sanctionNo },
                { label: 'Financial Year', value: yd.sanction.financialYear },
                { label: 'Sanction Date', value: yd.sanction.sanctionDate },
                { label: 'Issuing Authority', value: yd.sanction.issuingAuthority },
                { label: 'Total Transactions', value: (yd.transactions || []).length },
              ].map(r => (
                <div key={r.label}>
                  <p style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--clr-text-subtle)', fontWeight: 600, marginBottom: '4px' }}>{r.label}</p>
                  <p style={{ fontWeight: 600, color: 'var(--clr-text)' }}>{r.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount (₹)</th>
                  <th>% of Allotment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'A. Total Code Head Allotment', val: yd.sanction.totalAmount, pct: 100, badge: 'badge-primary', status: 'Allotted', bold: true },
                  { label: '  B. Working Funds Generated', val: yd.workingFunds, pct: yd.sanction.totalAmount > 0 ? (yd.workingFunds / yd.sanction.totalAmount) * 100 : 0, badge: 'badge-success', status: 'Available', indent: true },
                  { label: '  C. CDA Retention Generated', val: yd.cdaRetention, pct: yd.sanction.totalAmount > 0 ? (yd.cdaRetention / yd.sanction.totalAmount) * 100 : 0, badge: 'badge-warning', status: 'Held by CDA', indent: true },
                  { label: 'D. Gross Allotted to Code Heads', val: totalAllocated, pct: yd.sanction.totalAmount > 0 ? (totalAllocated / yd.sanction.totalAmount) * 100 : 0, badge: 'badge-info', status: 'Recorded', bold: true },
                  { label: 'E. Total Payments Made', val: totalSpent, pct: yd.workingFunds > 0 ? (totalSpent / yd.workingFunds) * 100 : 0, badge: 'badge-danger', status: 'Spent', bold: true, pctLabel: '% of WF' },
                  { label: 'F. Imprest Balance (B−E)', val: imprest, pct: yd.workingFunds > 0 ? (imprest / yd.workingFunds) * 100 : 0, badge: imprest < 0 ? 'badge-danger' : 'badge-success', status: imprest < 0 ? 'Overdrawn' : 'Positive', bold: true, pctLabel: '% of WF' },
                  { label: 'G. CDA Retention Paid', val: cdaSpent, pct: yd.cdaRetention > 0 ? (cdaSpent / yd.cdaRetention) * 100 : 0, badge: 'badge-warning', status: 'CDA Debit', bold: true, pctLabel: '% of CDA' },
                  { label: 'H. CDA Retention Balance', val: cdaBalance, pct: yd.cdaRetention > 0 ? (cdaBalance / yd.cdaRetention) * 100 : 0, badge: cdaBalance < 0 ? 'badge-danger' : 'badge-success', status: cdaBalance < 0 ? 'Overdrawn' : 'Positive', bold: true, pctLabel: '% of CDA' },
                ].map(r => (
                  <tr key={r.label} style={r.bold ? { borderTop: '2px solid var(--clr-border-active)' } : {}}>
                    <td className={r.bold ? 'bold' : ''} style={r.indent ? { paddingLeft: '2rem', color: 'var(--clr-text-muted)' } : {}}>
                      {r.label}
                    </td>
                    <td className={r.bold ? 'bold' : ''}>{`₹${formatAmount(r.val)}`}</td>
                    <td>{`${r.pct.toFixed(2)}${r.pctLabel || '%'}`}</td>
                    <td><span className={`badge ${r.badge}`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Code Head Tab ── */}
      {activeTab === 'codehead' && (
        <>
          {codeHeadReports.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">📂</div>
                <h3>No Code Heads</h3>
                <p>Add code heads from the Code Heads section.</p>
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Category / Name</th>
                    <th>Allotment (₹)</th>
                    <th>Working Share (₹)</th>
                    <th>CDA Share (₹)</th>
                    <th>Requested to Bank (₹)</th>
                    <th>Bank Balance (₹)</th>
                    <th>Spent (₹)</th>
                    <th>CFL (₹)</th>
                    <th>Utilization</th>
                    <th>PVs</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {codeHeadReports.map(ch => (
                    <tr key={ch.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--clr-text-subtle)' }}>{ch.code}</td>
                      <td className="bold">{ch.icon} {ch.name}</td>
                      <td>{ch.allocated > 0 ? `₹${formatAmount(ch.allocated)}` : '—'}</td>
                      <td>{ch.workingAllocated > 0 ? `₹${formatAmount(ch.workingAllocated)}` : '—'}</td>
                      <td>{ch.cdaAllocated > 0 ? `₹${formatAmount(ch.cdaAllocated)}` : '—'}</td>
                      <td>{ch.bankTransferred > 0 ? `₹${formatAmount(ch.bankTransferred)}` : '—'}</td>
                      <td className={ch.bankBalance <= 0 && ch.cfl > 0 ? 'warning' : 'green'}>
                        {ch.bankTransferred > 0 ? `₹${formatAmount(ch.bankBalance)}` : '—'}
                      </td>
                      <td className={ch.spent > 0 ? 'danger' : 'muted'}>
                        {ch.spent > 0 ? `₹${formatAmount(ch.spent)}` : '—'}
                      </td>
                      <td className={ch.cfl < ch.workingAllocated * 0.15 ? 'danger' : 'green'}>
                        {ch.allocated > 0 ? `₹${formatAmount(ch.cfl)}` : '—'}
                      </td>
                      <td>
                        {ch.allocated > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div className="progress-bar-track" style={{ width: '70px' }}>
                              <div className={`progress-bar-fill ${ch.pct > 85 ? 'danger' : ch.pct > 60 ? 'warning' : 'green'}`}
                                style={{ width: `${Math.min(ch.pct, 100)}%` }} />
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>{ch.pct.toFixed(0)}%</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="muted">{ch.txnCount || '—'}</td>
                      <td>
                        <span className={`badge ${ch.allocated === 0 ? 'badge-warning' : ch.pct >= 100 ? 'badge-danger' : ch.pct >= 85 ? 'badge-warning' : 'badge-success'}`}>
                          {ch.allocated === 0 ? 'No Allotment' : ch.pct >= 100 ? 'Exhausted' : ch.pct >= 85 ? 'Low' : 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Allotment History Tab ── */}
      {activeTab === 'allotment' && (
        <>
          {allotmentHistory.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <h3>No Allotment History</h3>
                <p>Allotment increases and decreases will appear here.</p>
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Code Head</th>
                    <th>Previous (₹)</th>
                    <th>New (₹)</th>
                    <th>Change (₹)</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {allotmentHistory.map(row => {
                    const ch = codeHeads.find(item => item.id === row.codeHeadId);
                    return (
                      <tr key={row.id}>
                        <td>{row.date}</td>
                        <td className="bold">{ch ? `${ch.icon} ${ch.name}` : row.codeHeadId}</td>
                        <td>₹{formatAmount(row.previousAmount)}</td>
                        <td>₹{formatAmount(row.newAmount)}</td>
                        <td className={row.delta < 0 ? 'danger' : 'green'}>
                          {row.delta < 0 ? '-' : '+'}₹{formatAmount(Math.abs(row.delta))}
                        </td>
                        <td>{row.remarks}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Vendor-wise Tab ── */}
      {activeTab === 'vendor' && (
        <>
          {filteredTxns.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">🏪</div>
                <h3>No Vendor Payments Found</h3>
                <p>Try adjusting your filter settings.</p>
              </div>
            </div>
          ) : (
            <div>
              {/* Expand/Collapse All controls (no-print) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }} className="no-print">
                <span style={{ fontSize: '0.88rem', color: 'var(--clr-text-muted)', fontWeight: 500 }}>
                  Grouped by <strong>{Object.keys(
                    filteredTxns.reduce((acc, t) => {
                      acc[t.vendorName] = true;
                      return acc;
                    }, {})
                  ).length}</strong> Vendor(s)
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setCollapsedVendors({})}>
                    👐 Expand All
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    const collapsed = {};
                    const vendors = new Set(filteredTxns.map(t => t.vendorName));
                    vendors.forEach(v => { collapsed[v] = true; });
                    setCollapsedVendors(collapsed);
                  }}>
                    📁 Collapse All
                  </button>
                </div>
              </div>

              {/* Vendor Sections */}
              {Object.entries(
                filteredTxns.reduce((acc, t) => {
                  if (!acc[t.vendorName]) acc[t.vendorName] = [];
                  acc[t.vendorName].push(t);
                  return acc;
                }, {})
              )
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([vendorName, vendorTxns]) => {
                  const totalPaid = vendorTxns.reduce((sum, t) => sum + getTransactionTotalAmount(t), 0);
                  const totalWorking = vendorTxns.reduce((sum, t) => sum + getTransactionWorkingAmount(t), 0);
                  const totalCda = vendorTxns.reduce((sum, t) => sum + getTransactionCdaAmount(t), 0);
                  const lastDate = vendorTxns.reduce((max, t) => !max || t.date > max ? t.date : max, '');
                  const codeHeadsUsed = [...new Set(vendorTxns.map(t => t.codeHeadId))];
                  const codeHeadCount = codeHeadsUsed.length;
                  const isCollapsed = collapsedVendors[vendorName] || false;

                  return (
                    <div key={vendorName} className={`vendor-section card mb-md ${isCollapsed ? 'collapsed' : ''}`} style={{ padding: '1rem 1.25rem', border: '1px solid var(--clr-border)' }}>
                      {/* Vendor Header Summary Card */}
                      <div 
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap', gap: '0.75rem' }}
                        onClick={() => setCollapsedVendors(prev => ({ ...prev, [vendorName]: !prev[vendorName] }))}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.85rem', cursor: 'pointer', color: 'var(--clr-primary)', fontWeight: 'bold' }} className="no-print">
                            {isCollapsed ? '▶' : '▼'}
                          </span>
                          <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--clr-text)' }}>{vendorName}</h3>
                            <p style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)' }}>
                              Last txn: <strong>{lastDate}</strong>
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                          <div>
                            <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--clr-text-subtle)', fontWeight: 600, marginBottom: '2px' }}>Total Payments</p>
                            <p style={{ fontWeight: 600, color: 'var(--clr-text)', fontSize: '0.9rem' }}>{vendorTxns.length} PVs</p>
                          </div>
                          <div>
                            <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--clr-text-subtle)', fontWeight: 600, marginBottom: '2px' }}>Unique Code Heads</p>
                            <p style={{ fontWeight: 600, color: 'var(--clr-text)', fontSize: '0.9rem' }}>
                              <strong>{codeHeadCount}</strong> code head{codeHeadCount === 1 ? '' : 's'}
                            </p>
                          </div>
                          <div>
                            <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--clr-text-subtle)', fontWeight: 600, marginBottom: '2px' }}>Total Paid</p>
                            <p style={{ fontWeight: 700, color: 'var(--clr-danger)', fontSize: '0.95rem' }}>₹{formatAmount(totalPaid)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Code heads list badges */}
                      <div style={{ marginTop: '0.625rem', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--clr-text-subtle)', fontWeight: 500 }}>Code heads used:</span>
                        {codeHeadsUsed.map(chId => {
                          const ch = codeHeads.find(c => c.id === chId);
                          return (
                            <span key={chId} className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                              {ch ? `${ch.icon} ${ch.code}` : chId}
                            </span>
                          );
                        })}
                      </div>

                      {/* Vendor Transactions Table */}
                      <div className="vendor-details" style={{ marginTop: '1rem', borderTop: '1px solid var(--clr-border)', paddingTop: '1rem' }}>
                        <h4 style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--clr-text-muted)', marginBottom: '0.75rem' }}>
                          Transaction breakdown for {vendorName}
                        </h4>
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>PV No.</th>
                                <th>Bill No & Dt</th>
                                <th>IAFS No.</th>
                                <th>Code Head</th>
                                <th>Description</th>
                                <th style={{ textAlign: 'right' }}>Working (₹)</th>
                                <th style={{ textAlign: 'right' }}>CDA Share (₹)</th>
                                <th style={{ textAlign: 'right' }}>Total (₹)</th>
                                <th>Remarks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {vendorTxns.map(t => {
                                const ch = codeHeads.find(c => c.id === t.codeHeadId);
                                return (
                                  <tr key={t.id}>
                                    <td>{t.date}</td>
                                    <td className="bold">{t.billNo}</td>
                                    <td>{t.billNoDt || '—'}</td>
                                    <td>{t.iafsNo || '—'}</td>
                                    <td>{ch ? `${ch.icon} ${ch.code}` : t.codeHeadId}</td>
                                    <td style={{ fontSize: '0.78rem', whiteSpace: 'normal', maxWidth: '240px' }}>{t.description || '—'}</td>
                                    <td style={{ textAlign: 'right' }}>{getTransactionWorkingAmount(t) > 0 ? `₹${formatAmount(getTransactionWorkingAmount(t))}` : '—'}</td>
                                    <td style={{ textAlign: 'right' }}>{getTransactionCdaAmount(t) > 0 ? `₹${formatAmount(getTransactionCdaAmount(t))}` : '—'}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--clr-danger)' }}>₹{formatAmount(getTransactionTotalAmount(t))}</td>
                                    <td style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)' }}>{t.remarks || '—'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr style={{ fontWeight: 700, backgroundColor: 'var(--clr-surface-2)' }}>
                                <td colSpan={6} style={{ textAlign: 'left', fontSize: '0.72rem', textTransform: 'uppercase' }}>Subtotal</td>
                                <td style={{ textAlign: 'right' }}>₹{formatAmount(totalWorking)}</td>
                                <td style={{ textAlign: 'right' }}>₹{formatAmount(totalCda)}</td>
                                <td style={{ textAlign: 'right', color: 'var(--clr-danger)' }}>₹{formatAmount(totalPaid)}</td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}

      {/* ── All Transactions Tab ── */}
      {activeTab === 'transactions' && (
        <>
          {filteredTxns.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">📝</div>
                <h3>No Transactions Found</h3>
                <p>Try adjusting your filter settings.</p>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }} className="no-print">
                <span style={{ fontSize: '0.88rem', color: 'var(--clr-text-muted)', fontWeight: 500 }}>
                  Showing <strong>{filteredTxns.length}</strong> matching transaction{filteredTxns.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date</th>
                      <th>PV No.</th>
                      <th>Vendor</th>
                      <th>Bill No & Dt</th>
                      <th>IAFS No.</th>
                      <th>Code Head</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Working (₹)</th>
                      <th style={{ textAlign: 'right' }}>CDA Share (₹)</th>
                      <th style={{ textAlign: 'right' }}>Total (₹)</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTxns.map((t, idx) => {
                      const ch = codeHeads.find(c => c.id === t.codeHeadId);
                      return (
                        <tr key={t.id}>
                          <td style={{ fontSize: '0.72rem', color: 'var(--clr-text-subtle)' }}>{idx + 1}</td>
                          <td>{t.date}</td>
                          <td className="bold" style={{ whiteSpace: 'nowrap' }}>{t.billNo}</td>
                          <td className="bold">{t.vendorName}</td>
                          <td>{t.billNoDt || '—'}</td>
                          <td>{t.iafsNo || '—'}</td>
                          <td>
                            {ch ? (
                              <span className="badge badge-info" style={{ fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                {ch.icon} {ch.code}
                              </span>
                            ) : (
                              t.codeHeadId
                            )}
                          </td>
                          <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', fontSize: '0.78rem' }}>{t.description || '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 500 }}>{getTransactionWorkingAmount(t) > 0 ? `₹${formatAmount(getTransactionWorkingAmount(t))}` : '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 500 }}>{getTransactionCdaAmount(t) > 0 ? `₹${formatAmount(getTransactionCdaAmount(t))}` : '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--clr-danger)' }}>₹{formatAmount(getTransactionTotalAmount(t))}</td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)' }}>{t.remarks || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--clr-border-active)', fontWeight: 700, backgroundColor: 'var(--clr-surface-2)' }}>
                      <td colSpan={8} style={{ textAlign: 'left', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Total Sum of Filtered Transactions</td>
                      <td style={{ textAlign: 'right' }}>
                        ₹{formatAmount(filteredTxns.reduce((sum, t) => sum + getTransactionWorkingAmount(t), 0))}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        ₹{formatAmount(filteredTxns.reduce((sum, t) => sum + getTransactionCdaAmount(t), 0))}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--clr-danger)', fontSize: '0.95rem' }}>
                        ₹{formatAmount(filteredTxns.reduce((sum, t) => sum + getTransactionTotalAmount(t), 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
