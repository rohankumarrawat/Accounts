import { Router } from 'express';
import { getDb, buildFullState } from '../db.js';

const router = Router({ mergeParams: true });

// POST /api/years/:year/transactions
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { year } = req.params;
    const { date, vendorName, billNo, description, codeHeadId, amount, workingAmount, cdaAmount, splitMode, remarks, iafsNo, billNoDt } = req.body;

    if (!vendorName?.trim()) return res.status(400).json({ error: 'Vendor name is required.' });
    if (!billNo?.trim()) return res.status(400).json({ error: 'PV No is required.' });



    const parsedWorking = parseFloat(workingAmount ?? amount);
    const parsedCda = parseFloat(cdaAmount) || 0;
    if (isNaN(parsedWorking) || parsedWorking <= 0) return res.status(400).json({ error: 'Working Funds amount must be greater than zero.' });

    const fy = db.prepare('SELECT * FROM financial_years WHERE year = ?').get(year);
    if (!fy) return res.status(404).json({ error: 'Year not found.' });

    db.prepare(`
      INSERT INTO transactions (year, date, vendor_name, bill_no, description, code_head_id, amount, working_amount, cda_amount, split_mode, remarks, iafs_no, bill_no_dt, timestamp_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      year,
      date || new Date().toISOString().split('T')[0],
      vendorName.trim(),
      billNo.trim(),
      (description || '').trim(),
      codeHeadId || '',
      parsedWorking + parsedCda,
      parsedWorking,
      parsedCda,
      splitMode || 'full',
      (remarks || '').trim(),
      (iafsNo || '').trim(),
      (billNoDt || '').trim(),
      Date.now()
    );

    db.prepare('UPDATE financial_years SET next_txn_id = ? WHERE year = ?').run(fy.next_txn_id + 1, year);

    res.json(buildFullState(db));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/years/:year/transactions/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { year, id } = req.params;
    const { date, vendorName, billNo, description, codeHeadId, workingAmount, cdaAmount, splitMode, remarks, iafsNo, billNoDt } = req.body;

    const existing = db.prepare('SELECT * FROM transactions WHERE id = ? AND year = ?').get(parseInt(id), year);
    if (!existing) return res.status(404).json({ error: 'Transaction not found.' });

    if (!vendorName?.trim()) return res.status(400).json({ error: 'Vendor name is required.' });
    if (!billNo?.trim()) return res.status(400).json({ error: 'PV No is required.' });



    const parsedWorking = parseFloat(workingAmount);
    const parsedCda = parseFloat(cdaAmount) || 0;
    if (isNaN(parsedWorking) || parsedWorking <= 0) return res.status(400).json({ error: 'Working Funds amount must be greater than zero.' });

    db.prepare(`
      UPDATE transactions
      SET date = ?, vendor_name = ?, bill_no = ?, description = ?, code_head_id = ?,
          amount = ?, working_amount = ?, cda_amount = ?, split_mode = ?, remarks = ?,
          iafs_no = ?, bill_no_dt = ?
      WHERE id = ? AND year = ?
    `).run(
      date || existing.date,
      vendorName.trim(),
      billNo.trim(),
      (description || '').trim(),
      codeHeadId || existing.code_head_id,
      parsedWorking + parsedCda,
      parsedWorking,
      parsedCda,
      splitMode || existing.split_mode,
      (remarks || '').trim(),
      (iafsNo || '').trim(),
      (billNoDt || '').trim(),
      parseInt(id), year
    );

    res.json(buildFullState(db));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/years/:year/transactions/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const { year, id } = req.params;
    const result = db.prepare('DELETE FROM transactions WHERE id = ? AND year = ?').run(parseInt(id), year);
    if (result.changes === 0) return res.status(404).json({ error: 'Transaction not found.' });
    res.json(buildFullState(db));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
