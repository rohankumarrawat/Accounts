import { Router } from 'express';
import { getDb, buildFullState } from '../db.js';

const router = Router();

// POST /api/years — create a new financial year
router.post('/', (req, res) => {
  try {
    const { year } = req.body;
    if (!year?.trim()) return res.status(400).json({ error: 'Financial year is required.' });
    const db = getDb();
    const existing = db.prepare('SELECT year FROM financial_years WHERE year = ?').get(year.trim());
    if (existing) return res.status(400).json({ error: `Financial year ${year.trim()} already exists.` });

    // Deactivate all years then insert new one as active
    db.prepare('UPDATE financial_years SET is_active = 0').run();
    db.prepare(`
      INSERT INTO financial_years (year, is_active, initialized)
      VALUES (?, 1, 0)
    `).run(year.trim());

    res.json(buildFullState(db));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/years/:year/activate
router.patch('/:year/activate', (req, res) => {
  try {
    const db = getDb();
    const fy = db.prepare('SELECT year FROM financial_years WHERE year = ?').get(req.params.year);
    if (!fy) return res.status(404).json({ error: 'Year not found.' });

    db.prepare('UPDATE financial_years SET is_active = 0').run();
    db.prepare('UPDATE financial_years SET is_active = 1 WHERE year = ?').run(req.params.year);
    res.json(buildFullState(db));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/years/:year
router.delete('/:year', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM financial_years WHERE year = ?').run(req.params.year);
    // If we just deleted the active year, activate the latest remaining
    const remaining = db.prepare('SELECT year FROM financial_years ORDER BY year DESC').all();
    if (remaining.length > 0) {
      db.prepare('UPDATE financial_years SET is_active = 1 WHERE year = ?').run(remaining[0].year);
    }
    res.json(buildFullState(db));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/years/:year/sanction
router.post('/:year/sanction', (req, res) => {
  try {
    const db = getDb();
    const { sanctionNo, sanctionDate, issuingAuthority, depotName, financialYear } = req.body;
    const sanction = { sanctionNo, sanctionDate, issuingAuthority, depotName, financialYear: financialYear || req.params.year, totalAmount: 0 };
    db.prepare(`
      UPDATE financial_years
      SET initialized = 1, sanction_json = ?
      WHERE year = ?
    `).run(JSON.stringify(sanction), req.params.year);
    res.json(buildFullState(db));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
