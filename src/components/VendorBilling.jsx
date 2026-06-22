import { useState } from 'react';
import {
  formatAmount,
  getCodeHeadCFL, getCodeHeadStats,
  recordVendorBill, getProgressColor, CODE_HEAD_SPLIT_MODES,
  getCodeHeadSplitMode, getCdaBalance, getTotalSpent, getBankBalance, getCodeHeadBankBalance,
} from '../store/budgetStore';

const emptyForm = (date) => ({
  vendorName: '', billNo: '',
  date: date || new Date().toISOString().split('T')[0],
  codeHeadId: '', amount: '', workingAmount: '', cdaAmount: '', description: '', remarks: '',
});

export default function VendorBilling({ state: yd, root, year, onRootChange }) {
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const codeHeads = yd.codeHeads || [];
  const selectedCH = codeHeads.find(ch => ch.id === form.codeHeadId);
  const availableCFL = form.codeHeadId ? getCodeHeadCFL(yd, form.codeHeadId) : 0;
  const chStats = form.codeHeadId ? getCodeHeadStats(yd, form.codeHeadId) : null;
  const selectedSplitMode = getCodeHeadSplitMode(selectedCH);
  const isSplitCodeHead = selectedSplitMode === CODE_HEAD_SPLIT_MODES.SPLIT_95_5;
  const workingAmt = isSplitCodeHead ? (parseFloat(form.workingAmount) || 0) : (parseFloat(form.amount) || 0);
  const cdaAmt = isSplitCodeHead ? (parseFloat(form.cdaAmount) || 0) : 0;
  const billAmt = workingAmt + cdaAmt;
  const balanceAfter = availableCFL - workingAmt;
  const bankBalance = getBankBalance(yd);
  const codeHeadBankBalance = form.codeHeadId ? getCodeHeadBankBalance(yd, form.codeHeadId) : 0;
  const bankBalanceAfter = bankBalance - workingAmt;
  const codeHeadBankBalanceAfter = codeHeadBankBalance - workingAmt;
  const availableCda = getCdaBalance(yd);
  const cdaBalanceAfter = availableCda - cdaAmt;
  const codeHeadCdaBalance = chStats?.cdaBalance || 0;
  const codeHeadCdaBalanceAfter = codeHeadCdaBalance - cdaAmt;
  const splitRows = selectedCH && billAmt > 0
    ? [
        { label: isSplitCodeHead ? 'Working Funds (95%)' : 'Code Head Amount (100%)', field: isSplitCodeHead ? 'workingAmount' : 'amount', amount: workingAmt, pct: isSplitCodeHead ? 95 : 100 },
        ...(isSplitCodeHead ? [{ label: 'CDA Retention (5%)', field: 'cdaAmount', amount: cdaAmt, pct: 5 }] : []),
      ]
    : [];

  const allocatedCHs = codeHeads.filter(ch => (yd.codeHeadAllocations?.[ch.id] || 0) > 0);

  const handleChange = (field, val) => {
    setError(''); setSuccess('');
    setForm(prev => (
      field === 'codeHeadId'
        ? { ...prev, codeHeadId: val, amount: '', workingAmount: '', cdaAmount: '' }
        : { ...prev, [field]: val }
    ));
  };

  const validate = () => {
    if (!form.vendorName.trim()) return 'Vendor name is required.';
    if (!form.billNo.trim()) return 'PV No is required.';
    if ((yd.transactions || []).some(t => (t.billNo || '').trim().toLowerCase() === form.billNo.trim().toLowerCase()))
      return `PV No "${form.billNo.trim()}" already exists.`;
    if (!form.date) return 'Date is required.';
    if (!form.codeHeadId) return 'Please select a Code Head.';
    if (isSplitCodeHead) {
      if (!form.workingAmount || workingAmt <= 0) return 'Enter a valid Working Funds amount.';
      if (!form.cdaAmount || cdaAmt <= 0) return 'Enter a valid CDA Retention amount.';
      if (workingAmt > availableCFL)
        return `Working Funds amount exceeds available CFL (₹${formatAmount(availableCFL)}).`;
      if (workingAmt > codeHeadBankBalance)
        return `Selected code head bank balance is insufficient (₹${formatAmount(codeHeadBankBalance)}). Request funds from CDA in My Bank for this code head.`;
      if (cdaAmt > codeHeadCdaBalance)
        return `CDA amount exceeds this code head's CDA balance (₹${formatAmount(codeHeadCdaBalance)}).`;
      if (cdaAmt > availableCda)
        return `CDA amount exceeds available CDA Retention (₹${formatAmount(availableCda)}).`;
    } else {
      if (!form.amount || workingAmt <= 0) return 'Enter a valid bill amount.';
      if (workingAmt > availableCFL)
        return `Amount exceeds available CFL (₹${formatAmount(availableCFL)}).`;
      if (workingAmt > codeHeadBankBalance)
        return `Selected code head bank balance is insufficient (₹${formatAmount(codeHeadBankBalance)}). Request funds from CDA in My Bank for this code head.`;
    }
    return null;
  };

  const handleSubmitClick = (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setShowConfirm(true);
  };

  const confirmPayment = async () => {
    try {
      const newRoot = await recordVendorBill(year, form);
      onRootChange(newRoot);
      setSuccess(`✅ Payment of ₹${formatAmount(billAmt)} to ${form.vendorName} recorded.`);
      setForm(emptyForm(form.date));
      setShowConfirm(false);
      setError('');
    } catch (e) {
      setError(e.message);
      setShowConfirm(false);
    }
  };

  const totalSpent = getTotalSpent(yd);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Vendor Billing — FY {year}</h2>
        <p className="page-subtitle">Record vendor bills and process payments from Working Funds</p>
      </div>

      <div className="flex gap-lg" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Bill Entry Form */}
        <div className="card" style={{ flex: 2, minWidth: '340px' }}>
          <div className="section-header">
            <div>
              <h3 className="section-title">New Vendor Bill</h3>
              <p className="section-sub">Validate against Code Head CFL before processing</p>
            </div>
          </div>

          {codeHeads.length === 0 && (
            <div className="alert alert-warning mb-md">
              <span>⚠️</span>
              <div><strong>No code heads created yet.</strong><br />Go to <em>Code Heads</em> to add categories first.</div>
            </div>
          )}
          {codeHeads.length > 0 && allocatedCHs.length === 0 && (
            <div className="alert alert-warning mb-md">
              <span>⚠️</span>
              <div><strong>No code heads allotted.</strong><br />Go to <em>Code Heads</em> and enter allotments.</div>
            </div>
          )}
          {bankBalance <= 0 && (
            <div className="alert alert-warning mb-md">
              <span>🏦</span>
              <div><strong>Army bank has no Working Funds.</strong><br />Use <em>My Bank</em> to request funds from CDA before processing payments.</div>
            </div>
          )}

          <form onSubmit={handleSubmitClick} className="form-section">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="bill-vendor">Vendor Name *</label>
                <input id="bill-vendor" className="form-input" placeholder="e.g. Sharma Dairy Pvt Ltd"
                  value={form.vendorName} onChange={e => handleChange('vendorName', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="bill-no">PV No *</label>
                <input id="bill-no" className="form-input" placeholder="e.g. PV-2025-001"
                  value={form.billNo} onChange={e => handleChange('billNo', e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="bill-date">Bill Date *</label>
                <input id="bill-date" type="date" className="form-input"
                  value={form.date} onChange={e => handleChange('date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="bill-codehead">Code Head *</label>
                <select id="bill-codehead" className="form-select"
                  value={form.codeHeadId} onChange={e => handleChange('codeHeadId', e.target.value)}>
                  <option value="">— Select Code Head —</option>
                  {allocatedCHs.map(ch => {
                    const cfl = getCodeHeadCFL(yd, ch.id);
                    return (
                      <option key={ch.id} value={ch.id} disabled={cfl <= 0}>
                        {ch.icon} {ch.name} (CFL: ₹{formatAmount(cfl)})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {selectedCH && !isSplitCodeHead && (
              <div className="form-group">
                <label className="form-label" htmlFor="bill-amount">Bill Amount (₹) *</label>
                <input id="bill-amount" type="number" className="form-input"
                  placeholder="Enter exact bill amount" min="0.01" step="any"
                  value={form.amount} onChange={e => handleChange('amount', e.target.value)} />
                {form.amount && (
                  <span className="form-hint" style={{ color: balanceAfter < 0 ? 'var(--clr-danger)' : 'var(--clr-success)' }}>
                    Working Funds balance after payment: ₹{formatAmount(balanceAfter)} {balanceAfter < 0 ? '⚠️ Exceeds CFL!' : '✓ Valid'}
                  </span>
                )}
                {form.amount && (
                  <span className="form-hint" style={{ color: codeHeadBankBalanceAfter < 0 ? 'var(--clr-danger)' : 'var(--clr-success)' }}>
                    Code head bank balance after payment: ₹{formatAmount(codeHeadBankBalanceAfter)} {codeHeadBankBalanceAfter < 0 ? '⚠️ Request funds for this code head' : '✓ Available'}
                  </span>
                )}
              </div>
            )}

            {selectedCH && (
              <div className="card" style={{ padding: '1rem' }}>
                <div className="flex justify-between items-center" style={{ marginBottom: '0.75rem' }}>
                  <p className="form-label" style={{ marginBottom: 0 }}>Code Head Amount Entry</p>
                  <span className={`badge ${selectedSplitMode === CODE_HEAD_SPLIT_MODES.SPLIT_95_5 ? 'badge-warning' : 'badge-success'}`}>
                    {selectedSplitMode === CODE_HEAD_SPLIT_MODES.SPLIT_95_5 ? '95% + 5%' : '100%'}
                  </span>
                </div>
                {isSplitCodeHead ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="bill-working-amount">Working Funds Amount (95%) *</label>
                      <input id="bill-working-amount" type="number" className="form-input"
                        placeholder="Enter amount to deduct from Working Funds" min="0.01" step="any"
                        value={form.workingAmount} onChange={e => handleChange('workingAmount', e.target.value)} />
                      {form.workingAmount && (
                        <span className="form-hint" style={{ color: balanceAfter < 0 ? 'var(--clr-danger)' : 'var(--clr-success)' }}>
                          CFL after payment: ₹{formatAmount(balanceAfter)} {balanceAfter < 0 ? '⚠️ Exceeds CFL!' : '✓ Valid'}
                        </span>
                      )}
                      {form.workingAmount && (
                        <span className="form-hint" style={{ color: codeHeadBankBalanceAfter < 0 ? 'var(--clr-danger)' : 'var(--clr-success)' }}>
                          Code head bank balance after payment: ₹{formatAmount(codeHeadBankBalanceAfter)} {codeHeadBankBalanceAfter < 0 ? '⚠️ Request funds for this code head' : '✓ Available'}
                        </span>
                      )}
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="bill-cda-amount">CDA Retention Amount (5%) *</label>
                      <input id="bill-cda-amount" type="number" className="form-input"
                        placeholder="Enter amount to deduct from CDA Retention" min="0.01" step="any"
                        value={form.cdaAmount} onChange={e => handleChange('cdaAmount', e.target.value)} />
                      {form.cdaAmount && (
                        <span className="form-hint" style={{ color: codeHeadCdaBalanceAfter < 0 ? 'var(--clr-danger)' : 'var(--clr-success)' }}>
                          Code head CDA balance after payment: ₹{formatAmount(codeHeadCdaBalanceAfter)} {codeHeadCdaBalanceAfter < 0 ? '⚠️ Exceeds code head CDA!' : '✓ Valid'}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center"
                      style={{ borderTop: '1px solid var(--clr-border)', paddingTop: '0.75rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)' }}>Total Bill Amount</span>
                      <span style={{ fontWeight: 800, color: 'var(--clr-text)' }}>₹{formatAmount(billAmt)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <span style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)' }}>Deducted from Working Funds (100%)</span>
                    <span style={{ fontWeight: 800, color: 'var(--clr-text)' }}>₹{formatAmount(workingAmt)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="bill-desc">Description</label>
              <input id="bill-desc" className="form-input" placeholder="Brief description of goods/services"
                value={form.description} onChange={e => handleChange('description', e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="bill-remarks">Remarks</label>
              <textarea id="bill-remarks" className="form-textarea" rows={2}
                placeholder="Any additional notes" value={form.remarks}
                onChange={e => handleChange('remarks', e.target.value)} />
            </div>

            {error && <div className="alert alert-danger"><span>⚠️</span><span>{error}</span></div>}
            {success && <div className="alert alert-success"><span>✅</span><span>{success}</span></div>}

            <button id="bill-submit" type="submit" className="btn btn-primary btn-lg"
              disabled={allocatedCHs.length === 0} style={{ width: '100%' }}>
              🧾 Review & Process Payment
            </button>
          </form>
        </div>

        {/* Right Panel */}
        <div style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {chStats && selectedCH && (
            <div className="card">
              <h3 className="section-title" style={{ marginBottom: '1rem' }}>
                {selectedCH.icon} Code Head Status
              </h3>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--clr-text)', marginBottom: '4px' }}>{selectedCH.name}</p>
              <code style={{ fontSize: '0.7rem', color: 'var(--clr-text-subtle)' }}>{selectedCH.code}</code>
              <div className="divider" />
              {[
                { label: 'Gross Allotment', value: chStats.allocated, color: 'var(--clr-primary-light)' },
                { label: 'Working Share', value: chStats.workingAllocated, color: 'var(--clr-success)' },
                { label: 'Bank Balance', value: chStats.bankBalance, color: chStats.bankBalance < 0 ? 'var(--clr-danger)' : 'var(--clr-accent)' },
                ...(chStats.cdaAllocated > 0 ? [{ label: 'CDA Share', value: chStats.cdaAllocated, color: 'var(--clr-warning)' }] : []),
                { label: 'Total Spent', value: chStats.spent, color: 'var(--clr-danger)' },
                ...(chStats.cdaSpent > 0 ? [{ label: 'CDA Spent', value: chStats.cdaSpent, color: 'var(--clr-danger)' }] : []),
                { label: 'CFL (Available)', value: chStats.cfl, color: chStats.cfl < 0 ? 'var(--clr-danger)' : 'var(--clr-success)' },
                ...(chStats.cdaAllocated > 0 ? [{ label: 'CDA Balance', value: chStats.cdaBalance, color: chStats.cdaBalance < 0 ? 'var(--clr-danger)' : 'var(--clr-success)' }] : []),
              ].map(r => (
                <div key={r.label} className="flex justify-between items-center" style={{ padding: '0.4rem 0' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)' }}>{r.label}</span>
                  <span style={{ fontWeight: 700, color: r.color }}>₹{formatAmount(r.value)}</span>
                </div>
              ))}
              <div className="progress-bar-track" style={{ marginTop: '0.75rem' }}>
                <div className={`progress-bar-fill ${getProgressColor(chStats.pct)}`} style={{ width: `${Math.min(chStats.pct, 100)}%` }} />
              </div>
              <div className="progress-labels"><span>Utilization</span><span>{chStats.pct.toFixed(1)}%</span></div>
            </div>
          )}

          <div className="card">
            <h3 className="section-title" style={{ marginBottom: '1rem' }}>Imprest Account</h3>
            {[
                { label: 'Working Funds', val: yd.workingFunds, color: 'var(--clr-primary-light)' },
                { label: 'Army Bank Balance', val: bankBalance, color: bankBalance < 0 ? 'var(--clr-danger)' : 'var(--clr-accent)' },
                ...(selectedCH ? [{ label: 'Selected Head Bank', val: codeHeadBankBalance, color: codeHeadBankBalance < 0 ? 'var(--clr-danger)' : 'var(--clr-accent)' }] : []),
              { label: 'Working Funds Paid', val: totalSpent, color: 'var(--clr-danger)' },
              { label: 'Balance', val: yd.workingFunds - totalSpent, color: 'var(--clr-success)' },
              { label: 'CDA Retention', val: yd.cdaRetention, color: 'var(--clr-warning)' },
              { label: 'CDA Balance', val: availableCda, color: 'var(--clr-success)' },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-center"
                style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--clr-border)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)' }}>{r.label}</span>
                <span style={{ fontWeight: 700, color: r.color }}>₹{formatAmount(r.val)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Confirm Payment</h3>
              <button className="modal-close" onClick={() => setShowConfirm(false)}>✕</button>
            </div>
            <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
              <span>💡</span><span>Please verify before confirming. This will be recorded in the ledger.</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Vendor', value: form.vendorName },
                { label: 'PV No', value: form.billNo },
                { label: 'Date', value: form.date },
                { label: 'Code Head', value: selectedCH ? `${selectedCH.icon} ${selectedCH.name}` : '' },
                { label: 'Total Bill Amount', value: `₹${formatAmount(billAmt)}`, big: true },
                ...splitRows.map(row => ({
                  label: row.label,
                  value: `₹${formatAmount(row.amount)}`,
                  color: row.pct === 5 ? 'var(--clr-warning)' : 'var(--clr-text)',
                })),
                { label: 'Bank Balance After', value: `₹${formatAmount(bankBalanceAfter)}`, color: bankBalanceAfter < 0 ? 'var(--clr-danger)' : 'var(--clr-success)' },
                { label: 'Code Head Bank After', value: `₹${formatAmount(codeHeadBankBalanceAfter)}`, color: codeHeadBankBalanceAfter < 0 ? 'var(--clr-danger)' : 'var(--clr-success)' },
                { label: 'CFL After', value: `₹${formatAmount(balanceAfter)}`, color: balanceAfter < 100000 ? 'var(--clr-warning)' : 'var(--clr-success)' },
                ...(isSplitCodeHead ? [{ label: 'CDA Balance After', value: `₹${formatAmount(cdaBalanceAfter)}`, color: cdaBalanceAfter < 0 ? 'var(--clr-danger)' : 'var(--clr-success)' }] : []),
                ...(isSplitCodeHead ? [{ label: 'Code Head CDA After', value: `₹${formatAmount(codeHeadCdaBalanceAfter)}`, color: codeHeadCdaBalanceAfter < 0 ? 'var(--clr-danger)' : 'var(--clr-success)' }] : []),
              ].map(r => (
                <div key={r.label} className="flex justify-between items-center"
                  style={{ borderBottom: '1px solid var(--clr-border)', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--clr-text-subtle)' }}>{r.label}</span>
                  <span style={{ fontWeight: r.big ? 800 : 600, fontSize: r.big ? '1.1rem' : '0.88rem', color: r.color || 'var(--clr-text)' }}>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-md">
              <button id="confirm-payment-btn" className="btn btn-success" style={{ flex: 1 }} onClick={confirmPayment}>
                ✅ Confirm Payment
              </button>
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
