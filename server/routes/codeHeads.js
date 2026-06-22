import { Router } from 'express';
import { getDb, buildFullState } from '../db.js';

const router = Router({ mergeParams: true });

// POST /api/years/:year/code-heads
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { year } = req.params;
    const { name, code, icon, category, splitMode } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Code head name is required.' });

    const fy = db.prepare('SELECT * FROM financial_years WHERE year = ?').get(year);
    if (!fy) return res.status(404).json({ error: 'Year not found.' });

    const nextId = fy.next_ch_id;
    const id = `CH${String(nextId).padStart(3, '0')}`;
    const validSplitModes = ['full', 'split_95_5'];
    const resolvedSplitMode = validSplitModes.includes(splitMode) ? splitMode : 'full';

    db.prepare(`
      INSERT INTO code_heads (id, year, code, name, icon, category, split_mode, allocation)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).run(id, year, (code || id).trim(), name.trim(), icon || '📦', (category || 'General').trim(), resolvedSplitMode);

    db.prepare('UPDATE financial_years SET next_ch_id = ? WHERE year = ?').run(nextId + 1, year);

    res.json(buildFullState(db));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/years/:year/code-heads/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { year, id } = req.params;
    const { name, code, icon, category, splitMode } = req.body;
    const validSplitModes = ['full', 'split_95_5'];
    const resolvedSplitMode = validSplitModes.includes(splitMode) ? splitMode : 'full';

    const existing = db.prepare('SELECT * FROM code_heads WHERE id = ? AND year = ?').get(id, year);
    if (!existing) return res.status(404).json({ error: 'Code head not found.' });

    db.prepare(`
      UPDATE code_heads
      SET name = ?, code = ?, icon = ?, category = ?, split_mode = ?
      WHERE id = ? AND year = ?
    `).run(
      (name || existing.name).trim(),
      (code || existing.code).trim(),
      icon || existing.icon,
      (category || existing.category).trim(),
      resolvedSplitMode,
      id, year
    );

    res.json(buildFullState(db));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/years/:year/code-heads/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const { year, id } = req.params;
    db.prepare('DELETE FROM code_heads WHERE id = ? AND year = ?').run(id, year);
    db.prepare('DELETE FROM bank_transfers WHERE code_head_id = ? AND year = ?').run(id, year);
    db.prepare('DELETE FROM transactions WHERE code_head_id = ? AND year = ?').run(id, year);
    res.json(buildFullState(db));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/years/:year/allocations/:id — set allotment for a code head
router.post('/:id/allocation', (req, res) => {
  try {
    const db = getDb();
    const { year, id } = req.params;
    const amount = parseFloat(req.body.amount);

    if (isNaN(amount) || amount < 0) return res.status(400).json({ error: 'Amount must be a non-negative number.' });

    const existing = db.prepare('SELECT * FROM code_heads WHERE id = ? AND year = ?').get(id, year);
    if (!existing) return res.status(404).json({ error: 'Code head not found.' });

    const prevAmount = existing.allocation;

    db.prepare('UPDATE code_heads SET allocation = ? WHERE id = ? AND year = ?').run(amount, id, year);

    // Record in allotment history
    const fy = db.prepare('SELECT * FROM financial_years WHERE year = ?').get(year);
    db.prepare(`
      INSERT INTO allotment_history (year, code_head_id, date, previous_amount, new_amount, delta, remarks, timestamp_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      year, id,
      new Date().toISOString().split('T')[0],
      prevAmount, amount, amount - prevAmount,
      amount > prevAmount ? 'Allotment increased' : 'Allotment decreased',
      Date.now()
    );
    db.prepare('UPDATE financial_years SET next_allotment_id = ? WHERE year = ?').run(fy.next_allotment_id + 1, year);

    res.json(buildFullState(db));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
