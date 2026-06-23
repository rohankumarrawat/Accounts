import { useState, useMemo } from 'react';
import {
  formatAmount, formatAmountNoDecimals, deleteTransaction, editTransaction,
  getTransactionTotalAmount, getTransactionWorkingAmount, getTransactionCdaAmount,
  getTotalBillAmount, getTotalSpent, CODE_HEAD_SPLIT_MODES, getCodeHeadSplitMode,
} from '../store/budgetStore';

function SortIcon({ field, sortField, sortDir }) {
  return (
    <span style={{ fontSize: '0.6rem', marginLeft: '4px', opacity: sortField === field ? 1 : 0.3 }}>
      {sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );
}

export default function TransactionLedger({ state: yd, root, year, onRootChange }) {
  const [search, setSearch] = useState('');
  const [filterCH, setFilterCH] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [deleteId, setDeleteId] = useState(null);
  const [editingTxn, setEditingTxn] = useState(null);
  const [editError, setEditError] = useState('');

  const codeHeads = yd.codeHeads || [];
  const allTxns = useMemo(() => yd.transactions || [], [yd.transactions]);

  const transactions = useMemo(() => {
    let txns = [...allTxns];
    if (search.trim()) {
      const q = search.toLowerCase();
      txns = txns.filter(t =>
        t.vendorName.toLowerCase().includes(q) ||
        t.billNo.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }
    if (filterCH) txns = txns.filter(t => t.codeHeadId === filterCH);
    txns.sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (sortField === 'amount') { va = parseFloat(va); vb = parseFloat(vb); }
      if (sortField === 'date') {
        const getSortDate = (d) => {
          if (!d) return 0;
          const firstPart = d.split(' to ')[0] || d;
          return new Date(firstPart).getTime() || 0;
        };
        va = getSortDate(va);
        vb = getSortDate(vb);
      }
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
    return txns;
  }, [allTxns, search, filterCH, sortField, sortDir]);

  const totalFiltered = transactions.reduce((s, t) => s + getTransactionTotalAmount(t), 0);
  const totalAll = getTotalBillAmount(yd);
  const workingSpent = getTotalSpent(yd);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const confirmDelete = async (id) => {
    try {
      const newRoot = await deleteTransaction(year, id);
      onRootChange(newRoot);
      setDeleteId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const startEdit = (txn) => {
    setEditError('');
    const isRange = (txn.date || '').includes(' to ');
    const parts = isRange ? txn.date.split(' to ') : [txn.date, txn.date];
    setEditingTxn({
      ...txn,
      dateMode: isRange ? 'range' : 'single',
      startDate: parts[0] || txn.date,
      endDate: parts[1] || parts[0] || txn.date,
      amount: String(getTransactionWorkingAmount(txn)),
      workingAmount: String(getTransactionWorkingAmount(txn)),
      cdaAmount: String(getTransactionCdaAmount(txn)),
      iafsNo: txn.iafsNo || '',
      billNoDt: txn.billNoDt || '',
    });
  };

  const saveEdit = async () => {
    try {
      if (!editingTxn.vendorName.trim()) { setEditError('Vendor name is required.'); return; }
      if (!editingTxn.billNo.trim()) { setEditError('PV No is required.'); return; }
      if (editingTxn.dateMode === 'range') {
        if (!editingTxn.startDate) { setEditError('Start date is required.'); return; }
        if (!editingTxn.endDate) { setEditError('End date is required.'); return; }
        if (editingTxn.startDate > editingTxn.endDate) { setEditError('Start date cannot be after end date.'); return; }
      } else {
        if (!editingTxn.date) { setEditError('Date is required.'); return; }
      }
      const payload = {
        ...editingTxn,
        date: editingTxn.dateMode === 'range' ? `${editingTxn.startDate} to ${editingTxn.endDate}` : editingTxn.date,
      };
      const newRoot = await editTransaction(year, editingTxn.id, payload);
      onRootChange(newRoot);
      setEditingTxn(null);
      setEditError('');
    } catch (e) {
      setEditError(e.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="page-title">Ledger — FY {year}</h2>
            <p className="page-subtitle">Full history of all vendor payments for the current financial year</p>
          </div>
          <button id="print-ledger-btn" className="btn btn-ghost no-print" onClick={() => window.print()}>
            🖨️ Print Ledger (PDF)
          </button>
        </div>
      </div>

      {/* Print-only active filters banner */}
      {(search || filterCH) && (
        <div className="print-only" style={{ border: '1px solid var(--clr-border)', padding: '10px 14px', marginBottom: '1.5rem', borderRadius: 'var(--r-sm)', background: '#fff', fontSize: '0.78rem' }}>
          <strong style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--clr-primary)', display: 'block', marginBottom: '4px' }}>
            Active Filter Parameters:
          </strong>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {search && <span><strong>Search Keyword:</strong> "{search}"</span>}
            {filterCH && <span><strong>Code Head:</strong> {codeHeads.find(c => c.id === filterCH)?.name}</span>}
            <span><strong>Total Filtered Transactions:</strong> {transactions.length}</span>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-label">Total Transactions</div>
          <div className="stat-value blue">{allTxns.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Paid Out</div>
          <div className="stat-value danger">₹{formatAmountNoDecimals(totalAll)}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Imprest Balance</div>
          <div className="stat-value green">₹{formatAmountNoDecimals(yd.workingFunds - workingSpent)}</div>
        </div>
        {(filterCH || search) && (
          <div className="stat-card warning">
            <div className="stat-label">Filtered Total</div>
            <div className="stat-value warning">₹{formatAmountNoDecimals(totalFiltered)}</div>
            <div className="stat-sub">{transactions.length} records</div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-lg no-print">
        <div className="flex gap-md items-center" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px', maxWidth: '300px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--clr-text-subtle)' }}>🔍</span>
            <input
              id="ledger-search" className="form-input"
            placeholder="Search vendor, PV no..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '2.2rem' }}
            />
          </div>
          <div style={{ minWidth: '200px' }}>
            <select id="ledger-filter-ch" className="form-select"
              value={filterCH} onChange={e => setFilterCH(e.target.value)}>
              <option value="">All Code Heads</option>
              {codeHeads.map(ch => (
                <option key={ch.id} value={ch.id}>{ch.icon} {ch.name}</option>
              ))}
            </select>
          </div>
          {(search || filterCH) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterCH(''); }}>
              ✕ Clear Filters
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--clr-text-muted)' }}>
            {transactions.length} of {allTxns.length} records
          </span>
        </div>
      </div>

      {/* Table */}
      {allTxns.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🧾</div>
            <h3>No Transactions Yet</h3>
            <p>Go to <em>Vendor Billing</em> to record the first payment.</p>
          </div>
        </div>
      ) : transactions.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <h3>No Results</h3>
            <p>Try adjusting your search or filters.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('id')}>#<SortIcon field="id" sortField={sortField} sortDir={sortDir} /></th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('date')}>Date<SortIcon field="date" sortField={sortField} sortDir={sortDir} /></th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('vendorName')}>Vendor<SortIcon field="vendorName" sortField={sortField} sortDir={sortDir} /></th>
                  <th>PV No</th>
                  <th>IAFS-1520 / IAFZ-2135</th>
                  <th>Bill No & Dt</th>
                  <th>Code Head</th>
                  <th>Description</th>
                  <th>Working (₹)</th>
                  <th>CDA (₹)</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('amount')}>Amount (₹)<SortIcon field="amount" sortField={sortField} sortDir={sortDir} /></th>
                  <th className="no-print"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(txn => {
                  const ch = codeHeads.find(c => c.id === txn.codeHeadId);
                  return (
                    <tr key={txn.id}>
                      <td className="muted">{txn.id}</td>
                      <td className="bold">{txn.date}</td>
                      <td className="bold">{txn.vendorName}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{txn.billNo}</td>
                      <td style={{ fontSize: '0.78rem' }}>{txn.iafsNo || '—'}</td>
                      <td style={{ fontSize: '0.78rem' }}>{txn.billNoDt || '—'}</td>
                      <td>
                        <span className="badge badge-primary" style={{ fontSize: '0.68rem' }}>
                          {ch ? `${ch.icon} ${ch.name}` : txn.codeHeadId}
                        </span>
                      </td>
                      <td className="muted" style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {txn.description || '—'}
                      </td>
                      <td className="danger">₹{formatAmount(getTransactionWorkingAmount(txn))}</td>
                      <td className={getTransactionCdaAmount(txn) > 0 ? 'warning' : 'muted'}>
                        {getTransactionCdaAmount(txn) > 0 ? `₹${formatAmount(getTransactionCdaAmount(txn))}` : '—'}
                      </td>
                      <td className="danger">₹{formatAmount(getTransactionTotalAmount(txn))}</td>
                      <td className="no-print">
                        <button
                          id={`edit-txn-${txn.id}`}
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--clr-primary-light)', padding: '2px 6px', marginRight: '4px' }}
                          onClick={() => startEdit(txn)}
                          title="Edit"
                        >✏️</button>
                        <button
                          id={`delete-txn-${txn.id}`}
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--clr-danger)', padding: '2px 6px' }}
                          onClick={() => setDeleteId(txn.id)}
                          title="Delete"
                        >🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center" style={{
            padding: '0.75rem var(--sp-md)',
            background: 'var(--clr-surface-2)',
            borderRadius: '0 0 var(--r-md) var(--r-md)',
            borderTop: '1px solid var(--clr-border)'
          }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--clr-text-muted)' }}>
              Total ({transactions.length} records)
            </span>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--clr-danger)' }}>
              ₹{formatAmount(totalFiltered)}
            </span>
          </div>
        </>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Transaction?</h3>
              <button className="modal-close" onClick={() => setDeleteId(null)}>✕</button>
            </div>
            <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
              <span>⚠️</span>
              <span>This will permanently delete the transaction and restore funds to the Code Head.</span>
            </div>
            <div className="flex gap-md">
              <button id="confirm-delete-btn" className="btn btn-danger" onClick={() => confirmDelete(deleteId)}>
                🗑️ Delete
              </button>
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editingTxn && (
        <div className="modal-overlay" onClick={() => setEditingTxn(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Payment Record</h3>
              <button className="modal-close" onClick={() => setEditingTxn(null)}>✕</button>
            </div>

            <div className="form-section">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Vendor Name *</label>
                  <input className="form-input" value={editingTxn.vendorName}
                    onChange={e => setEditingTxn(v => ({ ...v, vendorName: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">PV No *</label>
                  <input className="form-input" value={editingTxn.billNo}
                    onChange={e => setEditingTxn(v => ({ ...v, billNo: e.target.value }))} />
                  <span className="form-hint">PV No cannot be blank</span>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Date Type *</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${editingTxn.dateMode === 'single' ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1, padding: '0.5rem', textTransform: 'none' }}
                      onClick={() => setEditingTxn(v => ({ ...v, dateMode: 'single' }))}
                    >
                      Particular Date
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${editingTxn.dateMode === 'range' ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1, padding: '0.5rem', textTransform: 'none' }}
                      onClick={() => setEditingTxn(v => ({ ...v, dateMode: 'range' }))}
                    >
                      Date Range
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Code Head *</label>
                  <select className="form-select" value={editingTxn.codeHeadId}
                    onChange={e => setEditingTxn(v => ({
                      ...v,
                      codeHeadId: e.target.value,
                      amount: '',
                      workingAmount: '',
                      cdaAmount: '',
                    }))}>
                    <option value="">— Select Code Head —</option>
                    {codeHeads.map(ch => (
                      <option key={ch.id} value={ch.id}>{ch.icon} {ch.name} ({ch.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {editingTxn.dateMode === 'single' ? (
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-input" value={editingTxn.date}
                    onChange={e => setEditingTxn(v => ({ ...v, date: e.target.value }))} />
                </div>
              ) : (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Start Date *</label>
                    <input type="date" className="form-input" value={editingTxn.startDate}
                      onChange={e => setEditingTxn(v => ({ ...v, startDate: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date *</label>
                    <input type="date" className="form-input" value={editingTxn.endDate}
                      onChange={e => setEditingTxn(v => ({ ...v, endDate: e.target.value }))} />
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">IAFS-1520 / IAFZ-2135</label>
                  <input className="form-input" value={editingTxn.iafsNo || ''}
                    onChange={e => setEditingTxn(v => ({ ...v, iafsNo: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Bill No & Dt</label>
                  <input className="form-input" value={editingTxn.billNoDt || ''}
                    onChange={e => setEditingTxn(v => ({ ...v, billNoDt: e.target.value }))} />
                </div>
              </div>

              {getCodeHeadSplitMode(codeHeads.find(ch => ch.id === editingTxn.codeHeadId)) === CODE_HEAD_SPLIT_MODES.SPLIT_95_5 ? (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Working Funds Amount *</label>
                    <input type="number" className="form-input" min="0.01" step="any" value={editingTxn.workingAmount}
                      onChange={e => setEditingTxn(v => ({ ...v, workingAmount: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CDA Retention Amount *</label>
                    <input type="number" className="form-input" min="0.01" step="any" value={editingTxn.cdaAmount}
                      onChange={e => setEditingTxn(v => ({ ...v, cdaAmount: e.target.value }))} />
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Amount *</label>
                  <input type="number" className="form-input" min="0.01" step="any" value={editingTxn.amount}
                    onChange={e => setEditingTxn(v => ({ ...v, amount: e.target.value }))} />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" value={editingTxn.description || ''}
                  onChange={e => setEditingTxn(v => ({ ...v, description: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Remarks</label>
                <textarea className="form-textarea" rows={2} value={editingTxn.remarks || ''}
                  onChange={e => setEditingTxn(v => ({ ...v, remarks: e.target.value }))} />
              </div>

              {editError && <div className="alert alert-danger"><span>⚠️</span><span>{editError}</span></div>}

              <div className="flex gap-md">
                <button id="save-edit-txn-btn" className="btn btn-primary" style={{ flex: 1 }} onClick={saveEdit}>
                  ✓ Save Record
                </button>
                <button className="btn btn-ghost" onClick={() => setEditingTxn(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
