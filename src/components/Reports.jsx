import { useState } from 'react';
import {
  formatAmount, getCodeHeadStats,
  getTotalSpent, getImprestBalance, getTotalAllocated,
  getTotalCdaSpent, getCdaBalance, getTransactionTotalAmount,
} from '../store/budgetStore';

export default function Reports({ state: yd }) {
  const [activeTab, setActiveTab] = useState('summary');

  const codeHeads = yd.codeHeads || [];
  const totalSpent = getTotalSpent(yd);
  const imprest = getImprestBalance(yd);
  const totalAllocated = getTotalAllocated(yd);
  const cdaSpent = getTotalCdaSpent(yd);
  const cdaBalance = getCdaBalance(yd);
  const allotmentHistory = [...(yd.allotmentHistory || [])]
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const codeHeadReports = codeHeads.map(ch => ({
    ...ch,
    ...getCodeHeadStats(yd, ch.id),
    txnCount: (yd.transactions || []).filter(t => t.codeHeadId === ch.id).length,
  }));

  return (
    <div>
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="page-title">Reports — FY {yd.sanction.financialYear}</h2>
            <p className="page-subtitle">Budget utilization reports and statements</p>
          </div>
          <button id="print-report-btn" className="btn btn-ghost" onClick={() => window.print()}>
            🖨️ Print
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-sm mb-lg">
        {[
          { id: 'summary',  label: '📊 Summary' },
          { id: 'codehead', label: '📋 Code Head-wise' },
          { id: 'allotment', label: '💰 Allotment History' },
          { id: 'vendor',   label: '🏪 Vendor-wise' },
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

      {/* ── Vendor Tab ── */}
      {activeTab === 'vendor' && (
        <>
          {(yd.transactions || []).length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">🏪</div>
                <h3>No Vendor Payments</h3>
                <p>No transactions recorded yet.</p>
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Vendor Name</th>
                    <th>No. of PVs</th>
                    <th>Total Paid (₹)</th>
                    <th>Code Heads Used</th>
                    <th>Last Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(
                    (yd.transactions || []).reduce((acc, t) => {
                      if (!acc[t.vendorName]) acc[t.vendorName] = { bills: 0, total: 0, codeHeads: new Set(), lastDate: '' };
                      acc[t.vendorName].bills++;
                      acc[t.vendorName].total += getTransactionTotalAmount(t);
                      acc[t.vendorName].codeHeads.add(t.codeHeadId);
                      if (!acc[t.vendorName].lastDate || t.date > acc[t.vendorName].lastDate)
                        acc[t.vendorName].lastDate = t.date;
                      return acc;
                    }, {})
                  )
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([vendor, data]) => (
                      <tr key={vendor}>
                        <td className="bold">{vendor}</td>
                        <td>{data.bills}</td>
                        <td className="danger">₹{formatAmount(data.total)}</td>
                        <td>
                          <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                            {[...data.codeHeads].map(chId => {
                              const ch = codeHeads.find(c => c.id === chId);
                              return (
                                <span key={chId} className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                                  {ch ? `${ch.icon} ${ch.code}` : chId}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="muted">{data.lastDate}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
