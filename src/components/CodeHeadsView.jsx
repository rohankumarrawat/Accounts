import { useRef, useState } from 'react';
import {
  formatAmount,
  getCodeHeadStats, getCodeHeadMinimumAllotment, getTotalAllocated,
  allocateCodeHead, addCodeHead, editCodeHead, deleteCodeHead,
  getProgressColor, EMOJI_OPTIONS, CODE_HEAD_SPLIT_MODES, getCodeHeadSplitMode,
} from '../store/budgetStore';

const emptyNewCH = () => ({ name: '', code: '', icon: '📦', category: '', splitMode: CODE_HEAD_SPLIT_MODES.FULL });
const CSV_TEMPLATE = 'name,code,category,icon,splitMode,allotment\nMilk,1/23,Rations,📦,95+5,100000\nFuel,2/10,Transport,⛽,100,50000';

const normalizeHeader = (value) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const parseAmount = (value) => {
  const cleaned = String(value || '').replace(/[₹,\s]/g, '');
  if (!cleaned) return 0;
  const amount = parseFloat(cleaned);
  return Number.isFinite(amount) ? amount : NaN;
};

const normalizeSplitMode = (value) => {
  const cleaned = String(value || '').toLowerCase().replace(/\s/g, '');
  if (cleaned.includes('95') || cleaned.includes('split') || cleaned.includes('5%')) {
    return CODE_HEAD_SPLIT_MODES.SPLIT_95_5;
  }
  return CODE_HEAD_SPLIT_MODES.FULL;
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some(item => item.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some(item => item.trim())) rows.push(row);
  return rows;
}

function mapCsvRows(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSV must include a header row and at least one code head.');

  const headers = rows[0].map(normalizeHeader);
  const indexFor = (...names) => headers.findIndex(header => names.includes(header));
  const indexes = {
    name: indexFor('name', 'codehead', 'codeheadname', 'head', 'item', 'itemname'),
    code: indexFor('code', 'codeheadcode', 'headcode'),
    category: indexFor('category', 'group', 'type'),
    icon: indexFor('icon', 'emoji'),
    splitMode: indexFor('splitmode', 'billsplit', 'split', 'mode', 'percentage', 'percent'),
    allocation: indexFor('allotment', 'allocation', 'allocated', 'amount', 'budget', 'funds'),
  };

  if (indexes.name === -1) throw new Error('CSV must include a name column.');

  return rows.slice(1).map((cols, idx) => {
    const allocation = indexes.allocation >= 0 ? parseAmount(cols[indexes.allocation]) : 0;
    if (!Number.isFinite(allocation)) {
      throw new Error(`Row ${idx + 2}: allotment must be a valid number.`);
    }

    return {
      rowNo: idx + 2,
      name: (cols[indexes.name] || '').trim(),
      code: indexes.code >= 0 ? (cols[indexes.code] || '').trim() : '',
      category: indexes.category >= 0 ? (cols[indexes.category] || '').trim() : '',
      icon: indexes.icon >= 0 ? (cols[indexes.icon] || '').trim() : '',
      splitMode: indexes.splitMode >= 0 ? normalizeSplitMode(cols[indexes.splitMode]) : CODE_HEAD_SPLIT_MODES.FULL,
      allocation,
    };
  }).filter(row => row.name || row.code || row.category || row.allocation);
}

export default function CodeHeadsView({ state: yd, root, year, onRootChange }) {
  const importInputRef = useRef(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCH, setEditingCH] = useState(null);   // { id, name, code, icon, category }
  const [deleteCHConfirm, setDeleteCHConfirm] = useState(null);
  const [newCH, setNewCH] = useState(emptyNewCH());
  const [chError, setChError] = useState('');

  // Inline allotment
  const [editAllocId, setEditAllocId] = useState(null);
  const [allocValue, setAllocValue] = useState('');
  const [allocError, setAllocError] = useState('');
  const [importRows, setImportRows] = useState([]);
  const [importError, setImportError] = useState('');
  const [importFileName, setImportFileName] = useState('');

  const [toast, setToast] = useState(null);

  const codeHeads = yd.codeHeads || [];
  const totalAllotted = getTotalAllocated(yd);
  const historyRows = [...(yd.allotmentHistory || [])]
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .map(row => ({
      ...row,
      codeHead: codeHeads.find(ch => ch.id === row.codeHeadId),
    }));

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const printAllotmentRecords = () => {
    document.body.dataset.printTarget = 'allotment-history';
    const cleanup = () => {
      delete document.body.dataset.printTarget;
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 1000);
  };

  // ── Add Code Head ─────────────────────────────────────────
  const handleAddCH = async () => {
    setChError('');
    if (!newCH.name.trim()) { setChError('Name is required.'); return; }
    try {
      const newRoot = await addCodeHead(year, newCH);
      onRootChange(newRoot);
      setShowAddModal(false);
      setNewCH(emptyNewCH());
      showToast(`Code head "${newCH.name}" added!`);
    } catch (e) { setChError(e.message); }
  };

  // ── Edit Code Head ────────────────────────────────────────
  const handleEditCH = async () => {
    setChError('');
    if (!editingCH.name.trim()) { setChError('Name is required.'); return; }
    try {
      const newRoot = await editCodeHead(year, editingCH.id, editingCH);
      onRootChange(newRoot);
      setEditingCH(null);
      showToast('Code head updated!');
    } catch (e) { setChError(e.message); }
  };

  // ── Delete Code Head ──────────────────────────────────────
  const handleDeleteCH = async (id) => {
    try {
      const newRoot = await deleteCodeHead(year, id);
      onRootChange(newRoot);
      setDeleteCHConfirm(null);
      showToast('Code head deleted.', 'error');
    } catch (e) { setChError(e.message); }
  };

  // ── Allotment ─────────────────────────────────────────────
  const startAlloc = (ch) => {
    const stats = getCodeHeadStats(yd, ch.id);
    setEditAllocId(ch.id);
    setAllocValue(stats.allocated > 0 ? stats.allocated.toString() : '');
    setAllocError('');
  };

  const saveAlloc = async (ch) => {
    try {
      const newRoot = await allocateCodeHead(year, ch.id, allocValue || '0');
      onRootChange(newRoot);
      setEditAllocId(null);
      showToast(`Allotment saved for "${ch.name}"`);
    } catch (e) { setAllocError(e.message); }
  };

  const resetImport = () => {
    setImportRows([]);
    setImportError('');
    setImportFileName('');
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const handleCsvSelected = (e) => {
    const file = e.target.files?.[0];
    setImportError('');
    setImportRows([]);
    setImportFileName(file?.name || '');
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportError('Please select a CSV file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = mapCsvRows(String(reader.result || ''));
        const missingName = rows.find(row => !row.name.trim());
        if (missingName) throw new Error(`Row ${missingName.rowNo}: name is required.`);
        setImportRows(rows);
      } catch (error) {
        setImportError(error.message);
      }
    };
    reader.onerror = () => setImportError('Could not read the selected CSV file.');
    reader.readAsText(file);
  };

  const handleImportRows = async () => {
    setImportError('');
    if (importRows.length === 0) { setImportError('Select a CSV file with code heads first.'); return; }

    const existingCodes = new Set(codeHeads.map(ch => ch.code?.trim().toLowerCase()).filter(Boolean));
    const importCodes = new Set();
    for (const row of importRows) {
      const code = row.code.trim().toLowerCase();
      if (!code) continue;
      if (existingCodes.has(code)) {
        setImportError(`Row ${row.rowNo}: code "${row.code}" already exists.`);
        return;
      }
      if (importCodes.has(code)) {
        setImportError(`Row ${row.rowNo}: duplicate code "${row.code}" in CSV.`);
        return;
      }
      importCodes.add(code);
    }

    try {
      let latestRoot = null;
      for (const row of importRows) {
        latestRoot = await addCodeHead(year, {
          name: row.name,
          code: row.code,
          icon: row.icon || '📦',
          category: row.category || 'General',
          splitMode: row.splitMode,
        });
        const added = latestRoot.financialYears[year].codeHeads.at(-1);
        if (row.allocation > 0) {
          latestRoot = await allocateCodeHead(year, added.id, row.allocation);
        }
      }
      if (latestRoot) onRootChange(latestRoot);
      showToast(`${importRows.length} code head${importRows.length !== 1 ? 's' : ''} imported from CSV.`);
      resetImport();
    } catch (error) {
      setImportError(error.message);
    }
  };

  // Group by category
  const categories = [...new Set(codeHeads.map(ch => ch.category || 'General'))];

  return (
    <div className="codeheads-page">
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="page-title">Code Heads — FY {year}</h2>
            <p className="page-subtitle">Create code heads and manage allotments that build Working Funds and CDA Retention</p>
          </div>
          <div className="flex gap-sm" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button id="print-codeheads-btn" className="btn btn-ghost no-print" onClick={() => window.print()}>
              🖨️ Print / Save PDF
            </button>
            <button id="import-codeheads-trigger" className="btn btn-ghost no-print" onClick={() => importInputRef.current?.click()}>
              📥 Import CSV
            </button>
            <button id="add-codehead-btn" className="btn btn-primary no-print" onClick={() => { setShowAddModal(true); setChError(''); }}>
              + Add Code Head
            </button>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="card mb-lg no-print">
        <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p className="stat-label">Total Allotted</p>
            <p className="stat-value blue">₹{formatAmount(totalAllotted)}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p className="stat-label">Working Funds</p>
            <p className="stat-value green">₹{formatAmount(yd.workingFunds)}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p className="stat-label">CDA Retention</p>
            <p className="stat-value warning">₹{formatAmount(yd.cdaRetention)}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="stat-label">Code Heads</p>
            <p className="stat-value accent">{codeHeads.length}</p>
          </div>
        </div>
      </div>

      {allocError && (
        <div className="alert alert-danger mb-md"><span>⚠️</span><span>{allocError}</span></div>
      )}

      <div className="card mb-lg">
        <div className="section-header">
          <div>
            <h3 className="section-title">Import Code Heads From CSV</h3>
            <p className="section-sub">Columns: name, code, category, icon, splitMode, allotment</p>
          </div>
          <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(CSV_TEMPLATE)}>
              📋 Copy Template
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => importInputRef.current?.click()}>
              📥 Choose CSV
            </button>
          </div>
        </div>
        <input
          ref={importInputRef}
          id="codehead-csv-input"
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={handleCsvSelected}
        />
        <div className="alert alert-info" style={{ marginBottom: importRows.length || importError ? '1rem' : 0 }}>
          <span>ℹ️</span>
          <span>
            Use <strong>splitMode</strong> as <code>100</code> or <code>95+5</code>. Allotment is optional and becomes part of the FY budget.
          </span>
        </div>
        {importError && <div className="alert alert-danger"><span>⚠️</span><span>{importError}</span></div>}
        {importRows.length > 0 && (
          <div>
            <div className="flex justify-between items-center" style={{ marginBottom: '0.75rem', gap: '1rem', flexWrap: 'wrap' }}>
              <span className="badge badge-primary">{importRows.length} rows ready {importFileName ? `from ${importFileName}` : ''}</span>
              <div className="flex gap-sm">
                <button className="btn btn-success btn-sm" onClick={handleImportRows}>✓ Import Code Heads</button>
                <button className="btn btn-ghost btn-sm" onClick={resetImport}>Clear</button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Name</th>
                    <th>Code</th>
                    <th>Category</th>
                    <th>Split</th>
                    <th>Allotment (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.slice(0, 8).map(row => (
                    <tr key={row.rowNo}>
                      <td className="muted">{row.rowNo}</td>
                      <td className="bold">{row.icon || '📦'} {row.name}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{row.code || 'Auto'}</td>
                      <td>{row.category || 'General'}</td>
                      <td>
                        <span className={`badge ${row.splitMode === CODE_HEAD_SPLIT_MODES.SPLIT_95_5 ? 'badge-warning' : 'badge-success'}`}>
                          {row.splitMode === CODE_HEAD_SPLIT_MODES.SPLIT_95_5 ? '95% + 5%' : '100%'}
                        </span>
                      </td>
                      <td>{row.allocation > 0 ? `₹${formatAmount(row.allocation)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {importRows.length > 8 && (
              <p className="form-hint" style={{ marginTop: '0.5rem' }}>
                Showing first 8 rows. All {importRows.length} rows will be imported.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Empty State */}
      {codeHeads.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📂</div>
            <h3>No Code Heads Yet</h3>
            <p>Click <strong>"+ Add Code Head"</strong> to create your first expenditure category.</p>
          </div>
        </div>
      )}

      {/* Code Head Cards grouped by category */}
      {categories.map(cat => {
        const chs = codeHeads.filter(ch => (ch.category || 'General') === cat);
        return (
          <div key={cat} className="mb-lg">
            <div className="section-header">
              <h3 className="section-title">{cat}</h3>
              <span className="badge badge-info">{chs.length} items</span>
            </div>
            <div className="code-heads-grid">
              {chs.map(ch => {
                const stats = getCodeHeadStats(yd, ch.id);
                const minimumAllotment = getCodeHeadMinimumAllotment(yd, ch.id);
                const color = getProgressColor(stats.pct);
                const isAllocEditing = editAllocId === ch.id;

                return (
                  <div key={ch.id} className="code-head-card">
                    <div className="code-head-top">
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{ch.icon}</span>
                        <span className="code-head-name">{ch.name}</span>
                      </div>
                      <div className="flex gap-sm" style={{ flexShrink: 0 }}>
                        <span className="code-head-code">{ch.code}</span>
                        <span className={`badge ${getCodeHeadSplitMode(ch) === CODE_HEAD_SPLIT_MODES.SPLIT_95_5 ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.62rem' }}>
                          {getCodeHeadSplitMode(ch) === CODE_HEAD_SPLIT_MODES.SPLIT_95_5 ? '95% + 5%' : '100%'}
                        </span>
                        <button
                          id={`edit-ch-${ch.id}`}
                          className="btn btn-ghost btn-sm no-print"
                          style={{ padding: '2px 6px', fontSize: '0.75rem', color: 'var(--clr-primary-light)' }}
                          onClick={() => { setEditingCH({ ...ch }); setChError(''); }}
                          title="Edit code head"
                        >✏️</button>
                        <button
                          id={`delete-ch-${ch.id}`}
                          className="btn btn-ghost btn-sm no-print"
                          style={{ padding: '2px 6px', fontSize: '0.75rem', color: 'var(--clr-danger)' }}
                          onClick={() => setDeleteCHConfirm(ch)}
                          title="Delete code head"
                        >🗑️</button>
                      </div>
                    </div>

                    {isAllocEditing ? (
                      <div style={{ marginTop: '0.75rem' }}>
                        <div className="form-group">
                          <label className="form-label">Allotment (₹)</label>
                          <input
                            id={`alloc-input-${ch.id}`}
                            type="number"
                            className="form-input"
                            placeholder="Enter gross allotment"
                            value={allocValue}
                            onChange={e => setAllocValue(e.target.value)}
                            min={minimumAllotment} step="any" autoFocus
                          />
                          <span className="form-hint">
                            Minimum allowed: ₹{formatAmount(minimumAllotment)} based on current expenditure
                          </span>
                        </div>
                        <div className="flex gap-sm" style={{ marginTop: '0.5rem' }}>
                          <button id={`alloc-save-${ch.id}`} className="btn btn-success btn-sm" onClick={() => saveAlloc(ch)}>✓ Save</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditAllocId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="code-head-amounts">
                          <span className="amount-spent">Spent: ₹{formatAmount(stats.spent)}</span>
                          <span className={`amount-bal ${color}`}>CFL: ₹{formatAmount(stats.cfl)}</span>
                        </div>
                        <div className="progress-wrap">
                          <div className="progress-bar-track">
                            <div className={`progress-bar-fill ${color}`} style={{ width: `${stats.pct}%` }} />
                          </div>
                          <div className="progress-labels">
                            <span>Allot: ₹{formatAmount(stats.allocated)}</span>
                            <span>{stats.pct.toFixed(0)}% used</span>
                          </div>
                        </div>
                        <div className="progress-labels" style={{ marginTop: '0.35rem' }}>
                          <span>WF: ₹{formatAmount(stats.workingAllocated)}</span>
                          <span>CDA: ₹{formatAmount(stats.cdaAllocated)}</span>
                        </div>
                        <div className="flex justify-between items-center" style={{ marginTop: '0.75rem' }}>
                          <span className={`badge ${stats.allocated === 0 ? 'badge-warning' : stats.pct >= 100 ? 'badge-danger' : stats.pct >= 85 ? 'badge-warning' : 'badge-success'}`}>
                            {stats.allocated === 0 ? 'No Allotment' : stats.pct >= 100 ? 'Exhausted' : stats.pct >= 85 ? 'Low' : 'Active'}
                          </span>
                          <button id={`alloc-edit-${ch.id}`} className="btn btn-ghost btn-sm no-print" onClick={() => startAlloc(ch)}>
                            💰 Allot
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="card mb-lg print-allotment-record">
        <div className="section-header">
          <div>
            <h3 className="section-title">Allotment Change History</h3>
            <p className="section-sub">Every code-head increase or decrease is recorded here</p>
          </div>
          <div className="flex gap-sm items-center" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button id="print-allotment-history-btn" className="btn btn-ghost btn-sm no-print" onClick={printAllotmentRecords}>
              🖨️ Print Records
            </button>
            <span className="badge badge-info">{historyRows.length} entries</span>
          </div>
        </div>
        {historyRows.length === 0 ? (
          <div className="empty-state" style={{ padding: '1.25rem' }}>
            <div className="empty-state-icon">📋</div>
            <p>No allotment changes recorded yet</p>
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
                {historyRows.slice(0, 12).map(row => (
                  <tr key={row.id}>
                    <td>{row.date}</td>
                    <td className="bold">
                      {row.codeHead ? `${row.codeHead.icon} ${row.codeHead.name}` : row.codeHeadId}
                    </td>
                    <td>₹{formatAmount(row.previousAmount)}</td>
                    <td>₹{formatAmount(row.newAmount)}</td>
                    <td className={row.delta < 0 ? 'danger' : 'green'}>
                      {row.delta < 0 ? '-' : '+'}₹{formatAmount(Math.abs(row.delta))}
                    </td>
                    <td>{row.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {historyRows.length > 12 && (
              <p className="form-hint" style={{ marginTop: '0.5rem' }}>
                Showing latest 12 of {historyRows.length} entries.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Add Code Head Modal ─────────────────────────────── */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">+ Add Code Head</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <CodeHeadForm
              value={newCH}
              onChange={setNewCH}
              error={chError}
              onSubmit={handleAddCH}
              onCancel={() => setShowAddModal(false)}
              submitLabel="✓ Add Code Head"
            />
          </div>
        </div>
      )}

      {/* ── Edit Code Head Modal ────────────────────────────── */}
      {editingCH && (
        <div className="modal-overlay" onClick={() => setEditingCH(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">✏️ Edit Code Head</h3>
              <button className="modal-close" onClick={() => setEditingCH(null)}>✕</button>
            </div>
            <CodeHeadForm
              value={editingCH}
              onChange={setEditingCH}
              error={chError}
              onSubmit={handleEditCH}
              onCancel={() => setEditingCH(null)}
              submitLabel="✓ Save Changes"
            />
          </div>
        </div>
      )}

      {/* ── Delete Code Head Confirm ────────────────────────── */}
      {deleteCHConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteCHConfirm(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Code Head?</h3>
              <button className="modal-close" onClick={() => setDeleteCHConfirm(null)}>✕</button>
            </div>
            <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
              <span>⚠️</span>
              <span>
                Deleting <strong>{deleteCHConfirm.icon} {deleteCHConfirm.name}</strong> will also remove its allotment and all associated transactions. This cannot be undone.
              </span>
            </div>
            <div className="flex gap-md">
              <button id="confirm-delete-ch-btn" className="btn btn-danger" onClick={() => handleDeleteCH(deleteCHConfirm.id)}>
                🗑️ Yes, Delete
              </button>
              <button className="btn btn-ghost" onClick={() => setDeleteCHConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared Code Head Form Component ───────────────────────────
function CodeHeadForm({ value, onChange, error, onSubmit, onCancel, submitLabel }) {
  return (
    <div className="form-section">
      {/* Emoji Picker */}
      <div className="form-group">
        <label className="form-label">Icon</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {EMOJI_OPTIONS.map(em => (
            <button
              key={em}
              type="button"
              onClick={() => onChange(v => ({ ...v, icon: em }))}
              style={{
                width: '36px', height: '36px', fontSize: '1.1rem',
                border: `2px solid ${value.icon === em ? 'var(--clr-primary)' : 'var(--clr-border)'}`,
                borderRadius: 'var(--r-sm)',
                background: value.icon === em ? 'var(--clr-primary-glow)' : 'var(--clr-surface)',
                cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {em}
            </button>
          ))}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input
            id="ch-name-input"
            className="form-input"
            placeholder="e.g. Dairy Products"
            value={value.name}
            onChange={e => onChange(v => ({ ...v, name: e.target.value }))}
            autoFocus
          />
        </div>
        <div className="form-group">
          <label className="form-label">Code</label>
          <input
            id="ch-code-input"
            className="form-input"
            placeholder="e.g. 1/409/01"
            value={value.code}
            onChange={e => onChange(v => ({ ...v, code: e.target.value }))}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Category</label>
        <input
          id="ch-category-input"
          className="form-input"
          placeholder="e.g. Rations, Utilities, Admin..."
          value={value.category}
          onChange={e => onChange(v => ({ ...v, category: e.target.value }))}
        />
        <span className="form-hint">Used to group code heads together in the view</span>
      </div>

      <div className="form-group">
        <label className="form-label">Bill Split</label>
        <select
          id="ch-split-mode"
          className="form-select"
          value={value.splitMode || CODE_HEAD_SPLIT_MODES.FULL}
          onChange={e => onChange(v => ({ ...v, splitMode: e.target.value }))}
        >
          <option value={CODE_HEAD_SPLIT_MODES.FULL}>100% Code Head Amount</option>
          <option value={CODE_HEAD_SPLIT_MODES.SPLIT_95_5}>95% Working Funds + 5% CDA Retention</option>
        </select>
        <span className="form-hint">Controls how the amount is displayed when this code head is selected for vendor billing</span>
      </div>

      {error && <div className="alert alert-danger"><span>⚠️</span><span>{error}</span></div>}

      <div className="flex gap-md">
        <button id="ch-submit-btn" className="btn btn-primary" style={{ flex: 1 }} onClick={onSubmit}>
          {submitLabel}
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
