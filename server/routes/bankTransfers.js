import { Router } from 'express';
import { getDb, buildFullState } from '../db.js';

const router = Router({ mergeParams: true });

// POST /api/years/:year/bank-transfers
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { year } = req.params;
    const { date, requestNo, codeHeadId, requestedBy, purpose, amount, remarks, status } = req.body;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero.' });
    }
    if (!requestedBy?.trim()) {
      return res.status(400).json({ error: 'Requested by is required.' });
    }

    const fy = db.prepare('SELECT * FROM financial_years WHERE year = ?').get(year);
    if (!fy) return res.status(404).json({ error: 'Year not found.' });

    const nextId = fy.next_bank_transfer_id;
    const resolvedRequestNo = (requestNo || '').trim() || `REQ-${String(nextId).padStart(3, '0')}`;
    const resolvedStatus = status === 'approved' ? 'approved' : 'pending';

    db.prepare(`
      INSERT INTO bank_transfers (year, date, request_no, code_head_id, requested_by, purpose, amount, remarks, status, timestamp_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      year,
      date || new Date().toISOString().split('T')[0],
      resolvedRequestNo,
      codeHeadId || '',
      requestedBy.trim(),
      (purpose || 'Funds requested from CDA').trim(),
      parsedAmount,
      (remarks || '').trim(),
      resolvedStatus,
      Date.now()
    );

    db.prepare('UPDATE financial_years SET next_bank_transfer_id = ? WHERE year = ?').run(nextId + 1, year);

    res.json(buildFullState(db));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/years/:year/bank-transfers/:id/approve
router.patch('/:id/approve', (req, res) => {
  try {
    const db = getDb();
    const { year, id } = req.params;
    const result = db.prepare(
      "UPDATE bank_transfers SET status = 'approved' WHERE id = ? AND year = ?"
    ).run(parseInt(id), year);

    if (result.changes === 0) return res.status(404).json({ error: 'Transfer not found.' });
    res.json(buildFullState(db));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/years/:year/bank-transfers/:id/reject
router.patch('/:id/reject', (req, res) => {
  try {
    const db = getDb();
    const { year, id } = req.params;
    const result = db.prepare(
      'DELETE FROM bank_transfers WHERE id = ? AND year = ?'
    ).run(parseInt(id), year);

    if (result.changes === 0) return res.status(404).json({ error: 'Transfer not found.' });
    res.json(buildFullState(db));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
