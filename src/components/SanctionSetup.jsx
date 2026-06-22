import { useState } from 'react';
import { initializeSanction } from '../store/budgetStore';

export default function SanctionSetup({ root, year, onInit, onYearSwitch }) {
  const [form, setForm] = useState({
    financialYear: year,
    sanctionNo: '',
    sanctionDate: new Date().toISOString().split('T')[0],
    issuingAuthority: 'HQ Southern Command',
    depotName: 'Supply Depot ASC',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChange = (field, val) => {
    setError('');
    setForm(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.sanctionNo.trim()) { setError('Sanction Number is required.'); return; }
    setSaving(true);
    try {
      const newRoot = await initializeSanction(year, form);
      onInit(newRoot);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-card-icon">💰</div>
        <h1 className="page-title text-center" style={{ marginBottom: '0.25rem' }}>
          Setup Budget — FY {year}
        </h1>
        <p className="page-subtitle text-center" style={{ marginBottom: '2rem' }}>
          Enter FY details. Budget totals will be built from code-head allotments.
        </p>

        {/* Year switcher */}
        {onYearSwitch && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginBottom: '1rem', width: '100%', color: 'var(--clr-accent)' }}
            onClick={onYearSwitch}
          >
            📅 Switch Financial Year
          </button>
        )}

        <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
          <span>📋</span>
          <div>
            Create code heads first, then enter their allotments. 100% code heads add fully to Working Funds; 95% + 5% code heads add 95% to Working Funds and 5% to CDA Retention.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="form-section">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Sanction Number *</label>
              <input id="setup-sanction-no" className="form-input" placeholder="e.g. CDA/2025/001"
                value={form.sanctionNo} onChange={e => handleChange('sanctionNo', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Sanction Date *</label>
              <input id="setup-sanction-date" type="date" className="form-input"
                value={form.sanctionDate} onChange={e => handleChange('sanctionDate', e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Issuing Authority</label>
              <input id="setup-authority" className="form-input" placeholder="e.g. HQ Southern Command"
                value={form.issuingAuthority} onChange={e => handleChange('issuingAuthority', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Depot Name</label>
              <input id="setup-depot" className="form-input"
                value={form.depotName} onChange={e => handleChange('depotName', e.target.value)} />
            </div>
          </div>

          {error && <div className="alert alert-danger"><span>⚠️</span><span>{error}</span></div>}

          <button id="setup-submit" type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={saving}>
            {saving ? '⏳ Saving...' : `🚀 Start FY ${year}`}
          </button>
        </form>
      </div>
    </div>
  );
}
