import {
  formatAmount, formatAmountShort,
  getTotalAllocated,
  getTotalSpent, getImprestBalance,
  getCodeHeadStats, getCdaBalance, getTransactionTotalAmount,
  getBankBalance, getCdaWorkingBalance, getTotalBankTransfers,
} from '../store/budgetStore';

export default function Dashboard({ state: yd }) {
  const codeHeads = yd.codeHeads || [];
  const totalAllocated = getTotalAllocated(yd);
  const totalSpent = getTotalSpent(yd);
  const imprestBalance = getImprestBalance(yd);
  const cdaBalance = getCdaBalance(yd);
  const bankBalance = getBankBalance(yd);
  const cdaWorkingBalance = getCdaWorkingBalance(yd);
  const totalBankTransfers = getTotalBankTransfers(yd);
  const workingSharePct = totalAllocated > 0 ? (yd.workingFunds / totalAllocated) * 100 : 0;
  const spendPct = yd.workingFunds > 0 ? (totalSpent / yd.workingFunds) * 100 : 0;
  const bankTransferPct = yd.workingFunds > 0 ? (totalBankTransfers / yd.workingFunds) * 100 : 0;
  const txnCount = (yd.transactions || []).length;

  // Top 5 code heads by spend
  const topSpenders = codeHeads
    .map(ch => ({ ...ch, ...getCodeHeadStats(yd, ch.id) }))
    .filter(ch => ch.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);

  // Recent 5 transactions
  const recentTxns = [...(yd.transactions || [])]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
        <p className="page-subtitle">
          {yd.sanction.depotName} &nbsp;|&nbsp; FY {yd.sanction.financialYear}
          &nbsp;|&nbsp; Sanction: {yd.sanction.sanctionNo}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-label">Total Allotted</div>
          <div className="stat-value">{formatAmountShort(yd.sanction.totalAmount)}</div>
          <div className="stat-sub">₹{formatAmount(yd.sanction.totalAmount)}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon">🏦</div>
          <div className="stat-label">Working Funds</div>
          <div className="stat-value green">{formatAmountShort(yd.workingFunds)}</div>
          <div className="stat-sub">CDA + bank + paid total limit</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🏛️</div>
          <div className="stat-label">CDA Working Held</div>
          <div className={`stat-value ${cdaWorkingBalance < 0 ? 'danger' : 'blue'}`}>{formatAmountShort(cdaWorkingBalance)}</div>
          <div className="stat-sub">Not yet requested to bank</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon">🏦</div>
          <div className="stat-label">My Bank Balance</div>
          <div className={`stat-value ${bankBalance < 0 ? 'danger' : 'green'}`}>{formatAmountShort(bankBalance)}</div>
          <div className="stat-sub">Available in army account</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon">🔒</div>
          <div className="stat-label">CDA Retention</div>
          <div className="stat-value warning">{formatAmountShort(yd.cdaRetention)}</div>
          <div className="stat-sub">Held by CDA — not deployable</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💳</div>
          <div className="stat-label">Imprest Balance</div>
          <div className={`stat-value ${imprestBalance < yd.workingFunds * 0.2 ? 'danger' : 'accent'}`}>
            {formatAmountShort(imprestBalance)}
          </div>
          <div className="stat-sub">Working Funds − Total Paid</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📤</div>
          <div className="stat-label">Working Funds Paid</div>
          <div className="stat-value blue">{formatAmountShort(totalSpent)}</div>
          <div className="stat-sub">{txnCount} payment{txnCount !== 1 ? 's' : ''}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon">🔐</div>
          <div className="stat-label">CDA Balance</div>
          <div className="stat-value warning">{formatAmountShort(cdaBalance)}</div>
          <div className="stat-sub">Retention after CDA debits</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📂</div>
          <div className="stat-label">Code Heads</div>
          <div className="stat-value accent">{codeHeads.length}</div>
          <div className="stat-sub">Gross allotted: {formatAmountShort(totalAllocated)}</div>
        </div>
      </div>

      {/* Budget Utilization */}
      <div className="card mb-lg">
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <div>
            <h3 className="section-title">Budget Utilization</h3>
            <p className="section-sub">Code-head allotments, CDA requests, and spending overview</p>
          </div>
          <span className="badge badge-primary">{spendPct.toFixed(1)}% Spent</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <div className="flex justify-between" style={{ marginBottom: '6px', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--clr-text-muted)' }}>Working Funds Generated from Allotments</span>
              <span style={{ fontWeight: 600, color: 'var(--clr-primary-light)' }}>
                {workingSharePct.toFixed(1)}% · ₹{formatAmount(yd.workingFunds)}
              </span>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill green"
                style={{ width: `${Math.min(workingSharePct, 100)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between" style={{ marginBottom: '6px', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--clr-text-muted)' }}>Requested From CDA to Bank</span>
              <span style={{ fontWeight: 600, color: 'var(--clr-accent)' }}>
                {bankTransferPct.toFixed(1)}% · ₹{formatAmount(totalBankTransfers)}
              </span>
            </div>
            <div className="progress-bar-track">
              <div className={`progress-bar-fill ${bankTransferPct > 95 ? 'danger' : bankTransferPct > 75 ? 'warning' : ''}`}
                style={{ width: `${Math.min(bankTransferPct, 100)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between" style={{ marginBottom: '6px', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--clr-text-muted)' }}>Working Funds Paid</span>
              <span style={{ fontWeight: 600, color: spendPct > 85 ? 'var(--clr-danger)' : 'var(--clr-success)' }}>
                {spendPct.toFixed(1)}% · ₹{formatAmount(totalSpent)}
              </span>
            </div>
            <div className="progress-bar-track">
              <div className={`progress-bar-fill ${spendPct > 85 ? 'danger' : spendPct > 60 ? 'warning' : 'green'}`}
                style={{ width: `${Math.min(spendPct, 100)}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-lg" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Top Code Heads */}
        <div className="card" style={{ flex: 1, minWidth: '300px' }}>
          <div className="section-header">
            <div>
              <h3 className="section-title">Code Heads by Spend</h3>
              <p className="section-sub">Top spending categories</p>
            </div>
          </div>
          {topSpenders.length === 0 ? (
            <div className="empty-state" style={{ padding: '1.5rem' }}>
              <div className="empty-state-icon">📊</div>
              <p>No payments recorded yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {topSpenders.map(ch => (
                <div key={ch.id}>
                  <div className="flex justify-between" style={{ marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--clr-text)' }}>{ch.icon} {ch.name}</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: ch.pct > 85 ? 'var(--clr-danger)' : 'var(--clr-text-muted)' }}>
                      {ch.pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="progress-bar-track">
                    <div className={`progress-bar-fill ${ch.pct > 85 ? 'danger' : ch.pct > 60 ? 'warning' : 'green'}`}
                      style={{ width: `${ch.pct}%` }} />
                  </div>
                  <div className="progress-labels">
                    <span>Spent: ₹{formatAmount(ch.spent)}</span>
                    <span>CFL: ₹{formatAmount(ch.cfl)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="card" style={{ flex: 1, minWidth: '300px' }}>
          <div className="section-header">
            <div>
              <h3 className="section-title">Recent Payments</h3>
              <p className="section-sub">Last {Math.min(txnCount, 5)} transactions</p>
            </div>
            {txnCount > 0 && <span className="badge badge-success">{txnCount} Total</span>}
          </div>
          {recentTxns.length === 0 ? (
            <div className="empty-state" style={{ padding: '1.5rem' }}>
              <div className="empty-state-icon">🧾</div>
              <p>No payments made yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentTxns.map(txn => {
                const ch = codeHeads.find(c => c.id === txn.codeHeadId);
                return (
                  <div key={txn.id} className="flex justify-between items-center"
                    style={{ padding: '0.625rem 0', borderBottom: '1px solid var(--clr-border)' }}>
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--clr-text)' }}>{txn.vendorName}</p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--clr-text-subtle)' }}>
                        {ch ? `${ch.icon} ${ch.name}` : 'Unknown'} · {txn.date}
                      </p>
                    </div>
                    <div className="text-right">
                      <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--clr-danger)' }}>−₹{formatAmount(getTransactionTotalAmount(txn))}</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--clr-text-subtle)' }}>PV: {txn.billNo}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sanction Details */}
      <div className="card mt-lg">
        <h3 className="section-title" style={{ marginBottom: '1rem' }}>Sanction Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
          {[
            { label: 'Sanction No.', value: yd.sanction.sanctionNo },
            { label: 'Financial Year', value: yd.sanction.financialYear },
            { label: 'Date', value: yd.sanction.sanctionDate },
            { label: 'Issuing Authority', value: yd.sanction.issuingAuthority },
            { label: 'Depot', value: yd.sanction.depotName },
          ].map(item => (
            <div key={item.label}>
              <p style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--clr-text-subtle)', fontWeight: 600, marginBottom: '4px' }}>
                {item.label}
              </p>
              <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--clr-text)' }}>{item.value || '—'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
