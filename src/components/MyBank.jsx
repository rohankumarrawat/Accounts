import { useState } from 'react';
import {
  formatAmount,
  formatAmountNoDecimals,
  recordBankTransfer,
  approveBankTransfer,
  rejectBankTransfer,
  getBankBalance,
  getBankLedgerRows,
  getCdaWorkingBalance,
  getTotalBankTransfers,
  getTotalSpent,
  getCdaBalance,
  BANK_BALANCE_LIMIT,
  getBankLimitRemaining,
  getBankLimitStatus,
  getCodeHeadStats,
  getCodeHeadCdaWorkingBalance,
  getCodeHeadBankBalance,
} from '../store/budgetStore';

const emptyRequest = () => ({
  date: new Date().toISOString().split('T')[0],
  requestNo: '',
  items: [{ codeHeadId: '', amount: '' }],
  requestedBy: '',
  purpose: '',
  remarks: '',
});

export default function MyBank({ state: yd, root, year, onRootChange }) {
  const [form, setForm] = useState(emptyRequest());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const bankBalance = getBankBalance(yd);
  const cdaWorkingBalance = getCdaWorkingBalance(yd);
  const totalRequested = getTotalBankTransfers(yd);
  const workingPaid = getTotalSpent(yd);
  const cdaBalance = getCdaBalance(yd);
  const bankLimitRemaining = getBankLimitRemaining(yd);
  const bankStatus = getBankLimitStatus(yd);
  const requestAmount = form.items.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
  
  const pendingTransfers = (yd.bankTransfers || []).filter(t => t.status === 'pending');
  const approvedTransfers = (yd.bankTransfers || []).filter(t => t.status === 'approved');
  const pendingAmount = pendingTransfers.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const netLimitRemaining = bankLimitRemaining - pendingAmount;

  const cdaWorkingAfter = cdaWorkingBalance - requestAmount;
  const bankAfter = bankBalance + requestAmount;
  const bankLimitAfter = BANK_BALANCE_LIMIT - bankAfter;
  const ledgerRows = getBankLedgerRows(yd);
  const codeHeads = yd.codeHeads || [];
  const requestableCodeHeads = codeHeads.filter(ch => getCodeHeadStats(yd, ch.id).workingAllocated > 0);

  const handleChange = (field, value) => {
    setError('');
    setSuccess('');
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const addItemRow = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { codeHeadId: '', amount: '' }]
    }));
  };

  const removeItemRow = (index) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }));
  };

  const handleItemChange = (index, field, value) => {
    setError('');
    setSuccess('');
    setForm(prev => {
      const newItems = prev.items.map((item, idx) => {
        if (idx === index) {
          return { ...item, [field]: value };
        }
        return item;
      });
      return { ...prev, items: newItems };
    });
  };

  const handleApprove = async (id, amount) => {
    try {
      const newRoot = await approveBankTransfer(year, id);
      onRootChange(newRoot);
      setSuccess(`Requisition of ₹${formatAmount(amount)} approved and credited to bank.`);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleReject = async (id, amount) => {
    try {
      const newRoot = await rejectBankTransfer(year, id);
      onRootChange(newRoot);
      setSuccess(`Requisition of ₹${formatAmount(amount)} rejected/removed.`);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.requestedBy.trim()) { setError('Requested by is required.'); return; }
    if (!form.items || form.items.length === 0) { setError('At least one request item is required.'); return; }
    
    // Check for empty fields or invalid values in items
    const selectedHeads = new Set();
    for (let i = 0; i < form.items.length; i++) {
      const item = form.items[i];
      if (!item.codeHeadId) {
        setError(`Please select a code head for row ${i + 1}.`);
        return;
      }
      if (selectedHeads.has(item.codeHeadId)) {
        const duplicateHead = codeHeads.find(ch => ch.id === item.codeHeadId);
        setError(`Duplicate code head selected: "${duplicateHead?.name || item.codeHeadId}" is requested multiple times. Please combine them into a single row.`);
        return;
      }
      selectedHeads.add(item.codeHeadId);

      const parsedAmt = parseFloat(item.amount);
      if (isNaN(parsedAmt) || parsedAmt <= 0) {
        setError(`Please enter a valid amount greater than zero for row ${i + 1}.`);
        return;
      }

      // Check code head availability
      const codeHeadAvailable = getCodeHeadCdaWorkingBalance(yd, item.codeHeadId);
      if (parsedAmt > codeHeadAvailable) {
        const head = codeHeads.find(ch => ch.id === item.codeHeadId);
        setError(`Request amount for "${head?.name || item.codeHeadId}" (₹${formatAmount(parsedAmt)}) exceeds its available limit of ₹${formatAmount(codeHeadAvailable)}.`);
        return;
      }
    }

    if (requestAmount > cdaWorkingBalance) {
      setError(`Total request (₹${formatAmount(requestAmount)}) exceeds Working Funds available with CDA (₹${formatAmount(cdaWorkingBalance)}).`);
      return;
    }
    if (requestAmount > netLimitRemaining) {
      setError(`Total request (₹${formatAmount(requestAmount)}) exceeds army bank limit. Available bank capacity (accounting for pending requests) is ₹${formatAmount(netLimitRemaining)} and max bank balance is ₹${formatAmount(BANK_BALANCE_LIMIT)}.`);
      return;
    }

    try {
      const newRoot = await recordBankTransfer(year, form);
      onRootChange(newRoot);
      setSuccess(`Requisition request for a total of ₹${formatAmount(requestAmount)} submitted for approval.`);
      setForm(emptyRequest());
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex justify-between items-center" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h2 className="page-title">My Bank — FY {year}</h2>
            <p className="page-subtitle">Army bank account requests and CDA Working Funds ledger</p>
          </div>
          <button id="print-bank-ledger-btn" className="btn btn-ghost no-print" onClick={() => window.print()}>
            🖨️ Print / Save PDF
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card green">
          <div className="stat-icon">🏦</div>
          <div className="stat-label">Army Bank Balance</div>
          <div className={`stat-value ${bankBalance < 0 ? 'danger' : 'green'}`}>₹{formatAmountNoDecimals(bankBalance)}</div>
          <div className="stat-sub">Cash available for Working Funds payments</div>
        </div>
        <div className={`stat-card ${bankStatus.badge === 'badge-danger' ? 'danger' : bankStatus.badge === 'badge-warning' ? 'warning' : ''}`}>
          <div className="stat-icon">🛡️</div>
          <div className="stat-label">Bank Limit Status</div>
          <div className={`stat-value ${bankStatus.badge === 'badge-danger' ? 'danger' : bankStatus.badge === 'badge-warning' ? 'warning' : 'blue'}`}>
            {bankStatus.label}
          </div>
          <div className="stat-sub">Max ₹{formatAmountNoDecimals(BANK_BALANCE_LIMIT)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🏛️</div>
          <div className="stat-label">CDA Working Funds Held</div>
          <div className={`stat-value ${cdaWorkingBalance < 0 ? 'danger' : 'blue'}`}>₹{formatAmountNoDecimals(cdaWorkingBalance)}</div>
          <div className="stat-sub">Can still be requested from CDA</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📥</div>
          <div className="stat-label">Requested From CDA</div>
          <div className="stat-value accent">₹{formatAmountNoDecimals(totalRequested)}</div>
          <div className="stat-sub">Cumulative transfers to bank</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-icon">📤</div>
          <div className="stat-label">Working Funds Paid</div>
          <div className="stat-value danger">₹{formatAmountNoDecimals(workingPaid)}</div>
          <div className="stat-sub">Debited from army bank</div>
        </div>
      </div>

      <div className="flex gap-lg no-print" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div className="card" style={{ flex: 1, minWidth: '340px' }}>
          <div className="section-header">
            <div>
              <h3 className="section-title">Request Funds From CDA</h3>
              <p className="section-sub">Amount cannot exceed CDA availability or the ₹7.50 Cr bank limit</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="form-section">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="bank-request-date">Request Date *</label>
                <input id="bank-request-date" type="date" className="form-input"
                  value={form.date} onChange={e => handleChange('date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="bank-request-no">Request No.</label>
                <input id="bank-request-no" className="form-input" placeholder="Auto if blank"
                  value={form.requestNo} onChange={e => handleChange('requestNo', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="bank-requested-by">Requested By *</label>
                <input id="bank-requested-by" className="form-input" placeholder="Army personnel / section"
                  value={form.requestedBy} onChange={e => handleChange('requestedBy', e.target.value)} />
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', marginBottom: '1.25rem' }}>
              <div className="flex justify-between items-center" style={{ marginBottom: '0.5rem' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 0 }}>
                  Requested Heads and Amounts *
                </label>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={addItemRow}
                  style={{ color: 'var(--clr-primary)', fontWeight: 600, padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                >
                  ➕ Add Code Head Row
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {form.items.map((item, idx) => {
                  const itemAmt = parseFloat(item.amount) || 0;
                  const itemCHAvailable = item.codeHeadId ? getCodeHeadCdaWorkingBalance(yd, item.codeHeadId) : 0;
                  const itemCHAfter = itemCHAvailable - itemAmt;

                  return (
                    <div key={idx} className="card-glass" style={{ padding: '0.75rem', border: '1px solid var(--clr-border)' }}>
                      <div className="flex gap-md" style={{ alignItems: 'flex-start' }}>
                        <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                          <select
                            className="form-select"
                            value={item.codeHeadId}
                            onChange={e => handleItemChange(idx, 'codeHeadId', e.target.value)}
                          >
                            <option value="">— Select Code Head —</option>
                            {requestableCodeHeads.map(ch => {
                              const stats = getCodeHeadStats(yd, ch.id);
                              const isAlreadySelected = form.items.some((otherItem, otherIdx) => otherIdx !== idx && otherItem.codeHeadId === ch.id);
                              return (
                                <option key={ch.id} value={ch.id} disabled={stats.cdaWorkingBalance <= 0 || isAlreadySelected}>
                                  {ch.icon} {ch.name} ({ch.code}) - Avail: ₹{formatAmount(stats.cdaWorkingBalance)}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                          <input
                            type="number"
                            className="form-input"
                            min="0.01"
                            step="any"
                            placeholder="Amount (₹)"
                            value={item.amount}
                            onChange={e => handleItemChange(idx, 'amount', e.target.value)}
                          />
                        </div>
                        {form.items.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => removeItemRow(idx)}
                            style={{ padding: '0.5rem', color: 'var(--clr-danger)', marginTop: '2px' }}
                            title="Remove this head"
                          >
                            🗑️
                          </button>
                        )}
                      </div>

                      {item.amount && item.codeHeadId && (
                        <div className="flex justify-between items-center" style={{ marginTop: '0.4rem', fontSize: '0.75rem' }}>
                          <span style={{ color: itemCHAfter < 0 ? 'var(--clr-danger)' : 'var(--clr-success)' }}>
                            CDA balance after request: ₹{formatAmount(itemCHAfter)} {itemCHAfter < 0 ? '⚠️ Exceeds limit' : '✓ OK'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="bank-purpose">Purpose</label>
              <input id="bank-purpose" className="form-input" placeholder="e.g. Vendor payments, ration procurement"
                value={form.purpose} onChange={e => handleChange('purpose', e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="bank-remarks">Remarks</label>
              <textarea id="bank-remarks" className="form-textarea" rows={2}
                placeholder="Any additional notes"
                value={form.remarks} onChange={e => handleChange('remarks', e.target.value)} />
            </div>

            <div className="card-glass" style={{ padding: '1rem' }}>
              <h4 className="form-label" style={{ fontWeight: 700, borderBottom: '1px solid var(--clr-border)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                Request Summary
              </h4>
              {form.items.some(item => item.codeHeadId && parseFloat(item.amount) > 0) && (
                <div style={{ marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {form.items.map((item, idx) => {
                    const ch = codeHeads.find(c => c.id === item.codeHeadId);
                    const amt = parseFloat(item.amount) || 0;
                    if (!ch || amt <= 0) return null;
                    return (
                      <div key={idx} className="flex justify-between items-center" style={{ fontSize: '0.8rem', color: 'var(--clr-text-subtle)' }}>
                        <span>{ch.icon} {ch.code} - {ch.name}</span>
                        <span>₹{formatAmount(amt)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex justify-between items-center" style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--clr-border)', borderTop: '1px solid var(--clr-border)' }}>
                <strong>Total Request Amount</strong>
                <strong style={{ color: 'var(--clr-accent)', fontSize: '1rem' }}>₹{formatAmount(requestAmount)}</strong>
              </div>
              <div className="flex justify-between items-center" style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--clr-border)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)' }}>Current Bank Balance</span>
                <strong>₹{formatAmount(bankBalance)}</strong>
              </div>
              <div className="flex justify-between items-center" style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--clr-border)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)' }}>Maximum Bank Balance</span>
                <strong>₹{formatAmount(BANK_BALANCE_LIMIT)}</strong>
              </div>
              <div className="flex justify-between items-center" style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--clr-border)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)' }}>Bank Balance After Request</span>
                <strong style={{ color: bankAfter > BANK_BALANCE_LIMIT ? 'var(--clr-danger)' : 'var(--clr-success)' }}>
                  ₹{formatAmount(bankAfter)} {bankAfter > BANK_BALANCE_LIMIT ? '⚠️ Over limit' : ''}
                </strong>
              </div>
              <div className="flex justify-between items-center" style={{ paddingTop: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)' }}>CDA Working Funds After Request</span>
                <strong style={{ color: cdaWorkingAfter < 0 ? 'var(--clr-danger)' : 'var(--clr-success)' }}>
                  ₹{formatAmount(cdaWorkingAfter)} {cdaWorkingAfter < 0 ? '⚠️ Insufficient funds' : ''}
                </strong>
              </div>
            </div>

            {error && <div className="alert alert-danger"><span>⚠️</span><span>{error}</span></div>}
            {success && <div className="alert alert-success"><span>✅</span><span>{success}</span></div>}

            <button id="bank-transfer-submit" type="submit" className="btn btn-primary btn-lg">
              🏦 Add Funds to Bank
            </button>
          </form>
        </div>

        <div className="card" style={{ flex: 1, minWidth: '300px' }}>
          <h3 className="section-title" style={{ marginBottom: '1rem' }}>Working Funds Control</h3>
          {[
            { label: 'Working Funds Limit', value: yd.workingFunds, color: 'var(--clr-primary-light)' },
            { label: 'Bank Maximum Limit', value: BANK_BALANCE_LIMIT, color: 'var(--clr-primary)' },
            { label: 'Bank Capacity Available', value: bankLimitRemaining, color: bankLimitRemaining < 0 ? 'var(--clr-danger)' : 'var(--clr-success)' },
            { label: 'Already Requested', value: totalRequested, color: 'var(--clr-accent)' },
            { label: 'Available With CDA', value: cdaWorkingBalance, color: cdaWorkingBalance < 0 ? 'var(--clr-danger)' : 'var(--clr-success)' },
            { label: 'CDA Retention Balance', value: cdaBalance, color: 'var(--clr-warning)' },
          ].map(item => (
            <div key={item.label} className="flex justify-between items-center"
              style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--clr-border)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)' }}>{item.label}</span>
              <span style={{ fontWeight: 700, color: item.color }}>₹{formatAmount(item.value)}</span>
            </div>
          ))}
          {form.items.some(item => item.codeHeadId) && (
            <div style={{ marginTop: '1rem' }}>
              <h4 className="form-label" style={{ marginBottom: '0.5rem' }}>Active Code Head Details</h4>
              {form.items.map((item, idx) => {
                const ch = codeHeads.find(c => c.id === item.codeHeadId);
                if (!ch) return null;
                const stats = getCodeHeadStats(yd, ch.id);
                return (
                  <details key={ch.id} open style={{ marginBottom: '0.75rem', border: '1px solid var(--clr-border)', borderRadius: '4px', padding: '0.5rem' }}>
                    <summary style={{ fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--clr-text)' }}>
                      {ch.icon} {ch.code} ({ch.name.substring(0, 20)}...)
                    </summary>
                    <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {[
                        { label: 'Working Share', value: stats.workingAllocated, color: 'var(--clr-primary-light)' },
                        { label: 'Requested to Bank', value: stats.bankTransferred, color: 'var(--clr-accent)' },
                        { label: 'Available With CDA', value: stats.cdaWorkingBalance, color: stats.cdaWorkingBalance < 0 ? 'var(--clr-danger)' : 'var(--clr-success)' },
                        { label: 'Bank Balance', value: stats.bankBalance, color: stats.bankBalance < 0 ? 'var(--clr-danger)' : 'var(--clr-success)' },
                        { label: 'Working Funds Paid', value: stats.spent, color: 'var(--clr-danger)' },
                        { label: 'CFL', value: stats.cfl, color: stats.cfl < 0 ? 'var(--clr-danger)' : 'var(--clr-success)' },
                      ].map(sub => (
                        <div key={sub.label} className="flex justify-between items-center" style={{ fontSize: '0.75rem' }}>
                          <span style={{ color: 'var(--clr-text-muted)' }}>{sub.label}</span>
                          <span style={{ fontWeight: 700, color: sub.color }}>₹{formatAmount(sub.value)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card mt-lg no-print">
        <div className="section-header">
          <div>
            <h3 className="section-title">Code Head Bank Status</h3>
            <p className="section-sub">Requested funds, bank balance, and remaining CDA availability by code head</p>
          </div>
          <span className="badge badge-info">{requestableCodeHeads.length} funded heads</span>
        </div>
        {requestableCodeHeads.length === 0 ? (
          <div className="empty-state" style={{ padding: '1.25rem' }}>
            <div className="empty-state-icon">📂</div>
            <p>No code heads with Working Funds allotment yet</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code Head</th>
                  <th>Working Share (₹)</th>
                  <th>Requested to Bank (₹)</th>
                  <th>Bank Balance (₹)</th>
                  <th>Available With CDA (₹)</th>
                  <th>CFL (₹)</th>
                </tr>
              </thead>
              <tbody>
                {requestableCodeHeads.map(ch => {
                  const stats = getCodeHeadStats(yd, ch.id);
                  return (
                    <tr key={ch.id}>
                      <td className="bold">{ch.icon} {ch.name} <span className="muted">({ch.code})</span></td>
                      <td>₹{formatAmount(stats.workingAllocated)}</td>
                      <td className={stats.bankTransferred > 0 ? 'accent' : 'muted'}>
                        {stats.bankTransferred > 0 ? `₹${formatAmount(stats.bankTransferred)}` : '—'}
                      </td>
                      <td className={stats.bankBalance <= 0 && stats.cfl > 0 ? 'warning' : 'green'}>
                        ₹{formatAmount(stats.bankBalance)}
                      </td>
                      <td className={stats.cdaWorkingBalance <= 0 ? 'muted' : 'green'}>
                        ₹{formatAmount(stats.cdaWorkingBalance)}
                      </td>
                      <td className={stats.cfl <= 0 ? 'danger' : 'green'}>₹{formatAmount(stats.cfl)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cash Requisitions Workflow (CDA) */}
      <div className="card mt-lg no-print">
        <div className="section-header">
          <div>
            <h3 className="section-title">Cash Requisitions Workflow (CDA)</h3>
            <p className="section-sub">Approve pending requisitions to credit them to the Army Bank Account</p>
          </div>
          <div className="flex gap-sm">
            <span className="badge badge-warning">{pendingTransfers.length} Pending</span>
            <span className="badge badge-success">{approvedTransfers.length} Approved</span>
          </div>
        </div>

        {pendingTransfers.length === 0 ? (
          <div className="empty-state" style={{ padding: '1.5rem' }}>
            <div className="empty-state-icon">📋</div>
            <h3>No Pending Requisitions</h3>
            <p>All requested bank transfers have been processed.</p>
          </div>
        ) : (
          <div className="table-wrap" style={{ marginBottom: '1.5rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Request No</th>
                  <th>Code Head</th>
                  <th>Requested By</th>
                  <th>Purpose</th>
                  <th>Amount (₹)</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingTransfers.map(t => {
                  const ch = codeHeads.find(item => item.id === t.codeHeadId);
                  return (
                    <tr key={t.id}>
                      <td className="bold">{t.date}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{t.requestNo}</td>
                      <td className="bold">{ch ? `${ch.icon} ${ch.name}` : '—'}</td>
                      <td>{t.requestedBy}</td>
                      <td className="muted">{t.purpose}</td>
                      <td className="bold" style={{ color: 'var(--clr-accent)' }}>₹{formatAmount(t.amount)}</td>
                      <td className="text-right">
                        <div className="flex gap-sm" style={{ justifyContent: 'flex-end' }}>
                          <button
                            id={`approve-btn-${t.id}`}
                            className="btn btn-success btn-sm"
                            onClick={() => handleApprove(t.id, t.amount)}
                          >
                            ✓ Approve
                          </button>
                          <button
                            id={`reject-btn-${t.id}`}
                            className="btn btn-danger btn-sm"
                            onClick={() => handleReject(t.id, t.amount)}
                          >
                            ✕ Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* List of Approved Transfers */}
        {approvedTransfers.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <h4 className="form-label" style={{ marginBottom: '0.75rem' }}>Approved Credits Ledger</h4>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Request No</th>
                    <th>Code Head</th>
                    <th>Requested By</th>
                    <th>Purpose</th>
                    <th>Amount (₹)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedTransfers.map(t => {
                    const ch = codeHeads.find(item => item.id === t.codeHeadId);
                    return (
                      <tr key={t.id}>
                        <td>{t.date}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{t.requestNo}</td>
                        <td className="bold">{ch ? `${ch.icon} ${ch.name}` : '—'}</td>
                        <td>{t.requestedBy}</td>
                        <td className="muted">{t.purpose}</td>
                        <td className="green bold">₹{formatAmount(t.amount)}</td>
                        <td><span className="badge badge-success">Approved</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div id="bank-ledger-report" className="card mt-lg print-report">
        <div style={{ textAlign: 'center', borderBottom: '1px solid var(--clr-border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--clr-text)' }}>ARMY BANK LEDGER REPORT</h3>
          <p style={{ color: 'var(--clr-text-muted)', fontSize: '0.88rem' }}>
            {yd.sanction.depotName} · FY {yd.sanction.financialYear} · Generated {new Date().toLocaleDateString('en-IN')}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: '1rem', marginBottom: '1rem' }}>
          {[
            { label: 'Working Funds Limit', value: `₹${formatAmount(yd.workingFunds)}` },
            { label: 'Bank Maximum Limit', value: `₹${formatAmount(BANK_BALANCE_LIMIT)}` },
            { label: 'Limit Status', value: bankStatus.label },
            { label: 'CDA Transfers', value: `₹${formatAmount(totalRequested)}` },
            { label: 'Bank Debits', value: `₹${formatAmount(workingPaid)}` },
            { label: 'Closing Bank Balance', value: `₹${formatAmount(bankBalance)}` },
          ].map(item => (
            <div key={item.label}>
              <p style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--clr-text-subtle)', fontWeight: 600, marginBottom: '4px' }}>{item.label}</p>
              <p style={{ fontWeight: 700, color: 'var(--clr-text)' }}>{item.value}</p>
            </div>
          ))}
        </div>

        {requestableCodeHeads.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <h4 className="section-title" style={{ marginBottom: '0.75rem' }}>Code Head Bank Summary</h4>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code Head</th>
                    <th>Working Share (₹)</th>
                    <th>Requested (₹)</th>
                    <th>Bank Balance (₹)</th>
                    <th>CDA Available (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {requestableCodeHeads.map(ch => {
                    const stats = getCodeHeadStats(yd, ch.id);
                    return (
                      <tr key={ch.id}>
                        <td className="bold">{ch.icon} {ch.name} ({ch.code})</td>
                        <td>₹{formatAmount(stats.workingAllocated)}</td>
                        <td>₹{formatAmount(stats.bankTransferred)}</td>
                        <td>₹{formatAmount(stats.bankBalance)}</td>
                        <td>₹{formatAmount(stats.cdaWorkingBalance)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {ledgerRows.length === 0 ? (
          <div className="empty-state" style={{ padding: '1.5rem' }}>
            <div className="empty-state-icon">🏦</div>
            <p>No bank ledger entries yet</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Particulars</th>
                  <th>Code Head</th>
                  <th>Requested By</th>
                  <th>Credit (₹)</th>
                  <th>Debit (₹)</th>
                  <th>Balance (₹)</th>
                </tr>
              </thead>
              <tbody>
                {ledgerRows.map(row => (
                  (() => {
                    const ch = codeHeads.find(item => item.id === row.codeHeadId);
                    return (
                  <tr key={row.id}>
                    <td className="bold">{row.date}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{row.ref}</td>
                    <td className="bold">{row.particulars}</td>
                    <td>{ch ? `${ch.icon} ${ch.code}` : '—'}</td>
                    <td className="muted">{row.requestedBy || '—'}</td>
                    <td className={row.credit > 0 ? 'green' : 'muted'}>{row.credit > 0 ? `₹${formatAmount(row.credit)}` : '—'}</td>
                    <td className={row.debit > 0 ? 'danger' : 'muted'}>{row.debit > 0 ? `₹${formatAmount(row.debit)}` : '—'}</td>
                    <td className={row.balance < 0 ? 'danger' : 'bold'}>₹{formatAmount(row.balance)}</td>
                  </tr>
                    );
                  })()
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
