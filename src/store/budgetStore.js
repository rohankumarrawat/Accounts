// ============================================================
// CDA BUDGET WORKFLOW SYSTEM - Central State & Logic Store
// API-backed version — all data persisted in SQLite via Express
// ============================================================

const API_BASE = 'http://localhost:3001/api';

// ── API Client ────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

// ── Root Data Operations ──────────────────────────────────────

export async function loadRoot() {
  const raw = await apiFetch('/data');
  return normalizeRoot(raw);
}

export async function clearAllData() {
  await apiFetch('/data', { method: 'DELETE' });
  return { financialYears: {}, activeYear: null };
}

// ── Backup / Restore ──────────────────────────────────────────

export function downloadBackup() {
  // Trigger a direct browser download from the backend
  const a = document.createElement('a');
  a.href = `${API_BASE}/backup`;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function restoreBackup(jsonData) {
  const raw = await apiFetch('/restore', {
    method: 'POST',
    body: JSON.stringify(jsonData),
  });
  return normalizeRoot(raw);
}

// ── Year Operations ───────────────────────────────────────────

export async function createFinancialYear(year) {
  const raw = await apiFetch('/years', {
    method: 'POST',
    body: JSON.stringify({ year }),
  });
  return normalizeRoot(raw);
}

export async function switchYear(year) {
  const raw = await apiFetch(`/years/${encodeURIComponent(year)}/activate`, { method: 'PATCH' });
  return normalizeRoot(raw);
}

export async function deleteFinancialYear(year) {
  const raw = await apiFetch(`/years/${encodeURIComponent(year)}`, { method: 'DELETE' });
  return normalizeRoot(raw);
}

// ── Sanction Setup ────────────────────────────────────────────

export async function initializeSanction(year, sanctionData) {
  const raw = await apiFetch(`/years/${encodeURIComponent(year)}/sanction`, {
    method: 'POST',
    body: JSON.stringify(sanctionData),
  });
  return normalizeRoot(raw);
}

// ── Code Head CRUD ────────────────────────────────────────────

export async function addCodeHead(year, { name, code, icon, category, splitMode }) {
  if (!name?.trim()) throw new Error('Code head name is required.');
  const raw = await apiFetch(`/years/${encodeURIComponent(year)}/code-heads`, {
    method: 'POST',
    body: JSON.stringify({ name, code, icon, category, splitMode }),
  });
  return normalizeRoot(raw);
}

export async function editCodeHead(year, id, updates) {
  const raw = await apiFetch(`/years/${encodeURIComponent(year)}/code-heads/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return normalizeRoot(raw);
}

export async function deleteCodeHead(year, id) {
  const raw = await apiFetch(`/years/${encodeURIComponent(year)}/code-heads/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return normalizeRoot(raw);
}

// ── Allotments ────────────────────────────────────────────────

export async function allocateCodeHead(year, codeHeadId, amount) {
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt < 0) throw new Error('Amount must be a non-negative number.');
  const raw = await apiFetch(`/years/${encodeURIComponent(year)}/code-heads/${encodeURIComponent(codeHeadId)}/allocation`, {
    method: 'POST',
    body: JSON.stringify({ amount: amt }),
  });
  return normalizeRoot(raw);
}

// ── CDA to Army Bank Transfers ────────────────────────────────

export async function recordBankTransfer(year, transferData) {
  const raw = await apiFetch(`/years/${encodeURIComponent(year)}/bank-transfers`, {
    method: 'POST',
    body: JSON.stringify(transferData),
  });
  return normalizeRoot(raw);
}

export async function approveBankTransfer(year, transferId) {
  const raw = await apiFetch(`/years/${encodeURIComponent(year)}/bank-transfers/${transferId}/approve`, {
    method: 'PATCH',
  });
  return normalizeRoot(raw);
}

export async function rejectBankTransfer(year, transferId) {
  const raw = await apiFetch(`/years/${encodeURIComponent(year)}/bank-transfers/${transferId}/reject`, {
    method: 'PATCH',
  });
  return normalizeRoot(raw);
}

export async function updateBankTransferRequest(year, requestNo, requestData) {
  const raw = await apiFetch(`/years/${encodeURIComponent(year)}/bank-transfers/request/${encodeURIComponent(requestNo)}`, {
    method: 'PUT',
    body: JSON.stringify(requestData),
  });
  return normalizeRoot(raw);
}

// ── Vendor Bills ──────────────────────────────────────────────

export async function recordVendorBill(year, billData) {
  const raw = await apiFetch(`/years/${encodeURIComponent(year)}/transactions`, {
    method: 'POST',
    body: JSON.stringify(billData),
  });
  return normalizeRoot(raw);
}

export async function editTransaction(year, txnId, billData) {
  const raw = await apiFetch(`/years/${encodeURIComponent(year)}/transactions/${txnId}`, {
    method: 'PUT',
    body: JSON.stringify(billData),
  });
  return normalizeRoot(raw);
}

export async function deleteTransaction(year, txnId) {
  const raw = await apiFetch(`/years/${encodeURIComponent(year)}/transactions/${txnId}`, {
    method: 'DELETE',
  });
  return normalizeRoot(raw);
}

// ── Normalize (client-side recalculation) ────────────────────

function normalizeYearData(yearData) {
  const base = {
    initialized: false,
    sanction: { totalAmount: 0, financialYear: '', sanctionNo: '', sanctionDate: '', issuingAuthority: '', depotName: 'Supply Depot ASC' },
    workingFunds: 0,
    cdaRetention: 0,
    codeHeads: [],
    nextCHId: 1,
    codeHeadAllocations: {},
    allotmentHistory: [],
    nextAllotmentId: 1,
    bankTransfers: [],
    nextBankTransferId: 1,
    transactions: [],
    nextTxnId: 1,
  };

  // Build codeHeadAllocations map from codeHeads array
  const codeHeadAllocations = {};
  for (const ch of (yearData?.codeHeads || [])) {
    codeHeadAllocations[ch.id] = yearData?.codeHeadAllocations?.[ch.id] ?? 0;
  }

  const merged = {
    ...base,
    ...yearData,
    sanction: { ...base.sanction, ...(yearData?.sanction || {}) },
    codeHeads: yearData?.codeHeads || [],
    codeHeadAllocations,
    allotmentHistory: yearData?.allotmentHistory || [],
    nextAllotmentId: yearData?.nextAllotmentId || 1,
    bankTransfers: (yearData?.bankTransfers || []).map(t => ({ status: 'pending', ...t })),
    nextBankTransferId: yearData?.nextBankTransferId || 1,
    transactions: yearData?.transactions || [],
    nextTxnId: yearData?.nextTxnId || 1,
  };
  return recalculateYearFunds(merged);
}

function normalizeRoot(root) {
  const years = root?.financialYears || {};
  return {
    financialYears: Object.fromEntries(
      Object.entries(years).map(([year, yearData]) => [year, normalizeYearData(yearData)])
    ),
    activeYear: root?.activeYear || null,
  };
}

// ── Active Year Selector ──────────────────────────────────────

export function getActiveYearData(root) {
  if (!root.activeYear || !root.financialYears[root.activeYear]) return null;
  return root.financialYears[root.activeYear];
}

// ── Computed Selectors (pure functions, operate on yearData) ──

export const CODE_HEAD_SPLIT_MODES = {
  FULL: 'full',
  SPLIT_95_5: 'split_95_5',
};

export const BANK_BALANCE_LIMIT = 75000000; // ₹7 crore 50 lakh

export function getTotalAllocated(yd) {
  return Object.values(yd.codeHeadAllocations || {}).reduce((s, v) => s + (v || 0), 0);
}

export function getUnallocatedFunds(yd) {
  return getImprestBalance(yd);
}

export function getCodeHeadSpent(yd, codeHeadId) {
  return (yd.transactions || [])
    .filter(t => t.codeHeadId === codeHeadId)
    .reduce((s, t) => s + getTransactionWorkingAmount(t), 0);
}

export function getCodeHeadCFL(yd, codeHeadId) {
  return getCodeHeadWorkingAllocation(yd, codeHeadId) - getCodeHeadSpent(yd, codeHeadId);
}

export function getTotalSpent(yd) {
  return (yd.transactions || []).reduce((s, t) => s + getTransactionWorkingAmount(t), 0);
}

export function getImprestBalance(yd) {
  return yd.workingFunds - getTotalSpent(yd);
}

export function getTotalBankTransfers(yd) {
  return (yd.bankTransfers || []).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
}

export function getApprovedBankTransfers(yd) {
  return (yd.bankTransfers || [])
    .filter(t => t.status === 'approved')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
}

export function getPendingBankTransfers(yd) {
  return (yd.bankTransfers || [])
    .filter(t => t.status === 'pending')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
}

export function getCdaWorkingBalance(yd) {
  return yd.workingFunds - getTotalBankTransfers(yd);
}

export function getBankBalance(yd) {
  return getApprovedBankTransfers(yd) - getTotalSpent(yd);
}

export function getCodeHeadBankTransfers(yd, codeHeadId) {
  return (yd.bankTransfers || [])
    .filter(t => t.codeHeadId === codeHeadId)
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
}

export function getCodeHeadApprovedTransfers(yd, codeHeadId) {
  return (yd.bankTransfers || [])
    .filter(t => t.codeHeadId === codeHeadId && t.status === 'approved')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
}

export function getCodeHeadPendingTransfers(yd, codeHeadId) {
  return (yd.bankTransfers || [])
    .filter(t => t.codeHeadId === codeHeadId && t.status === 'pending')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
}

export function getCodeHeadTotalRequested(yd, codeHeadId) {
  return (yd.bankTransfers || [])
    .filter(t => t.codeHeadId === codeHeadId)
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
}

export function getCodeHeadCdaWorkingBalance(yd, codeHeadId) {
  return getCodeHeadWorkingAllocation(yd, codeHeadId) - getCodeHeadBankTransfers(yd, codeHeadId);
}

export function getCodeHeadBankBalance(yd, codeHeadId) {
  return getCodeHeadApprovedTransfers(yd, codeHeadId) - getCodeHeadSpent(yd, codeHeadId);
}

export function getBankLimitRemaining(yd) {
  return BANK_BALANCE_LIMIT - getBankBalance(yd);
}

export function getBankLimitStatus(yd) {
  const balance = getBankBalance(yd);
  const remaining = getBankLimitRemaining(yd);
  const pct = BANK_BALANCE_LIMIT > 0 ? (balance / BANK_BALANCE_LIMIT) * 100 : 0;

  if (balance > BANK_BALANCE_LIMIT) {
    return { label: 'Over Limit', badge: 'badge-danger', limit: BANK_BALANCE_LIMIT, balance, remaining, pct };
  }
  if (remaining <= 0) {
    return { label: 'At Limit', badge: 'badge-warning', limit: BANK_BALANCE_LIMIT, balance, remaining, pct };
  }
  return { label: 'Within Limit', badge: 'badge-success', limit: BANK_BALANCE_LIMIT, balance, remaining, pct };
}

export function getTransactionWorkingAmount(txn) {
  return parseFloat(txn?.workingAmount ?? txn?.amount) || 0;
}

export function getTransactionCdaAmount(txn) {
  return parseFloat(txn?.cdaAmount) || 0;
}

export function getTransactionTotalAmount(txn) {
  const amount = parseFloat(txn?.amount);
  if (!isNaN(amount)) return amount;
  return getTransactionWorkingAmount(txn) + getTransactionCdaAmount(txn);
}

export function getTotalBillAmount(yd) {
  return (yd.transactions || []).reduce((s, t) => s + getTransactionTotalAmount(t), 0);
}

export function getTotalCdaSpent(yd) {
  return (yd.transactions || []).reduce((s, t) => s + getTransactionCdaAmount(t), 0);
}

export function getCdaBalance(yd) {
  return yd.cdaRetention - getTotalCdaSpent(yd);
}

export function getCodeHeadById(yd, codeHeadId) {
  return (yd.codeHeads || []).find(ch => ch.id === codeHeadId);
}

export function getCodeHeadAllotmentParts(codeHead, amount) {
  const total = parseFloat(amount) || 0;
  if (getCodeHeadSplitMode(codeHead) === CODE_HEAD_SPLIT_MODES.SPLIT_95_5) {
    return { total, working: total * 0.95, cda: total * 0.05 };
  }
  return { total, working: total, cda: 0 };
}

export function getCodeHeadWorkingAllocation(yd, codeHeadId) {
  const codeHead = getCodeHeadById(yd, codeHeadId);
  const amount = (yd.codeHeadAllocations || {})[codeHeadId] || 0;
  return getCodeHeadAllotmentParts(codeHead, amount).working;
}

export function getCodeHeadCdaAllocation(yd, codeHeadId) {
  const codeHead = getCodeHeadById(yd, codeHeadId);
  const amount = (yd.codeHeadAllocations || {})[codeHeadId] || 0;
  return getCodeHeadAllotmentParts(codeHead, amount).cda;
}

export function getCodeHeadCdaSpent(yd, codeHeadId) {
  return (yd.transactions || [])
    .filter(t => t.codeHeadId === codeHeadId)
    .reduce((s, t) => s + getTransactionCdaAmount(t), 0);
}

export function getCodeHeadMinimumAllotment(yd, codeHeadId) {
  const codeHead = getCodeHeadById(yd, codeHeadId);
  const splitMode = getCodeHeadSplitMode(codeHead);
  const workingSpent = getCodeHeadSpent(yd, codeHeadId);
  const bankTransfers = getCodeHeadBankTransfers(yd, codeHeadId);
  const cdaSpent = getCodeHeadCdaSpent(yd, codeHeadId);
  if (splitMode === CODE_HEAD_SPLIT_MODES.SPLIT_95_5) {
    return Math.max(workingSpent / 0.95, bankTransfers / 0.95, cdaSpent / 0.05);
  }
  return Math.max(workingSpent, bankTransfers);
}

export function recalculateYearFunds(yd) {
  let totalAmount = 0;
  let workingFunds = 0;
  let cdaRetention = 0;

  (yd.codeHeads || []).forEach(codeHead => {
    const allotment = (yd.codeHeadAllocations || {})[codeHead.id] || 0;
    const parts = getCodeHeadAllotmentParts(codeHead, allotment);
    totalAmount += parts.total;
    workingFunds += parts.working;
    cdaRetention += parts.cda;
  });

  return {
    ...yd,
    sanction: { ...(yd.sanction || {}), totalAmount },
    workingFunds,
    cdaRetention,
  };
}

export function getBankLedgerRows(yd) {
  const transferRows = (yd.bankTransfers || [])
    .filter(t => t.status === 'approved')
    .map(t => ({
      id: `transfer-${t.id}`,
      date: t.date,
      timestamp: t.timestamp || 0,
      ref: t.requestNo,
      codeHeadId: t.codeHeadId || '',
      particulars: `CDA funds received - ${t.purpose || 'Funds request'}`,
      requestedBy: t.requestedBy,
      credit: parseFloat(t.amount) || 0,
      debit: 0,
      remarks: t.remarks || '',
      type: 'credit',
    }));

  const paymentRows = (yd.transactions || [])
    .filter(t => getTransactionWorkingAmount(t) > 0)
    .map(t => ({
      id: `payment-${t.id}`,
      date: t.date,
      timestamp: t.timestamp || 0,
      ref: t.billNo,
      codeHeadId: t.codeHeadId || '',
      particulars: `Vendor payment - ${t.vendorName}`,
      requestedBy: '',
      credit: 0,
      debit: getTransactionWorkingAmount(t),
      remarks: t.description || t.remarks || '',
      type: 'debit',
    }));

  let balance = 0;
  return [...transferRows, ...paymentRows]
    .sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.timestamp - b.timestamp;
    })
    .map(row => {
      balance += row.credit - row.debit;
      return { ...row, balance };
    });
}

export function getCodeHeadStats(yd, codeHeadId) {
  const allocated = (yd.codeHeadAllocations || {})[codeHeadId] || 0;
  const workingAllocated = getCodeHeadWorkingAllocation(yd, codeHeadId);
  const cdaAllocated = getCodeHeadCdaAllocation(yd, codeHeadId);
  const spent = getCodeHeadSpent(yd, codeHeadId);
  const cdaSpent = getCodeHeadCdaSpent(yd, codeHeadId);
  const bankTransferred = getCodeHeadBankTransfers(yd, codeHeadId);
  const bankBalance = getCodeHeadBankBalance(yd, codeHeadId);
  const cdaWorkingBalance = getCodeHeadCdaWorkingBalance(yd, codeHeadId);
  const cfl = workingAllocated - spent;
  const cdaBalance = cdaAllocated - cdaSpent;
  const pct = workingAllocated > 0 ? Math.min((spent / workingAllocated) * 100, 100) : 0;
  return {
    allocated,
    workingAllocated,
    cdaAllocated,
    spent,
    cdaSpent,
    bankTransferred,
    bankBalance,
    cdaWorkingBalance,
    cfl,
    cdaBalance,
    pct,
  };
}

export function getCodeHeadSplitMode(codeHead) {
  return codeHead?.splitMode === CODE_HEAD_SPLIT_MODES.SPLIT_95_5
    ? CODE_HEAD_SPLIT_MODES.SPLIT_95_5
    : CODE_HEAD_SPLIT_MODES.FULL;
}

export function getCodeHeadBillSplitRows(codeHead, amount) {
  const amt = parseFloat(amount) || 0;
  if (getCodeHeadSplitMode(codeHead) === CODE_HEAD_SPLIT_MODES.SPLIT_95_5) {
    return [
      { label: 'Working Funds (95%)', amount: amt * 0.95, pct: 95 },
      { label: 'CDA Retention (5%)', amount: amt * 0.05, pct: 5 },
    ];
  }
  return [{ label: 'Code Head Amount (100%)', amount: amt, pct: 100 }];
}

// ── Formatting ────────────────────────────────────────────────

export function formatAmount(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '0.00';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatAmountNoDecimals(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '0';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatAmountShort(amount) {
  if (!amount || isNaN(amount)) return '₹0';
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)} K`;
  return `₹${amount.toFixed(0)}`;
}

export function getProgressColor(pct) {
  if (pct < 60) return 'green';
  if (pct < 85) return 'warning';
  return 'danger';
}

// ── Emoji Picker Presets ──────────────────────────────────────
export const EMOJI_OPTIONS = [
  '📦', '🥛', '🥩', '🥦', '🌾', '🧂', '⛽', '🍳', '🧹', '📋',
  '💊', '👕', '🏥', '🔧', '🚗', '💡', '🖨️', '📡', '🏗️', '🎖️',
  '🏠', '📚', '⚙️', '🛡️', '🔑', '💰', '🎯', '📊', '🌐', '🚀',
];
