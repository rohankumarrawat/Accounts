import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';

import yearsRouter from './routes/years.js';
import codeHeadsRouter from './routes/codeHeads.js';
import bankTransfersRouter from './routes/bankTransfers.js';
import transactionsRouter from './routes/transactions.js';
import { getDb, buildFullState } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

// ── Middleware ──────────────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '50mb' }));

// ── Core Data Routes ───────────────────────────────────────────
app.get('/api/data', (req, res) => {
  try {
    const db = getDb();
    res.json(buildFullState(db));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/data', (req, res) => {
  try {
    const db = getDb();
    db.exec(`
      DELETE FROM transactions;
      DELETE FROM bank_transfers;
      DELETE FROM allotment_history;
      DELETE FROM code_heads;
      DELETE FROM financial_years;
    `);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Backup ─────────────────────────────────────────────────────
// GET /api/backup — download entire DB as JSON
app.get('/api/backup', (req, res) => {
  try {
    const db = getDb();
    const state = buildFullState(db);
    const payload = JSON.stringify({ __version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2);
    const filename = `cda-budget-backup-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Restore ────────────────────────────────────────────────────
// POST /api/restore — accept JSON backup and repopulate DB
app.post('/api/restore', (req, res) => {
  const db = getDb();
  const data = req.body;

  if (!data?.financialYears) {
    return res.status(400).json({ error: 'Invalid backup file. Missing financialYears.' });
  }

  const restoreAll = db.transaction(() => {
    // Wipe existing data
    db.exec(`
      DELETE FROM transactions;
      DELETE FROM bank_transfers;
      DELETE FROM allotment_history;
      DELETE FROM code_heads;
      DELETE FROM financial_years;
    `);

    const activeYear = data.activeYear || null;
    const years = data.financialYears || {};

    const insertYear = db.prepare(`
      INSERT INTO financial_years (year, is_active, initialized, sanction_json, next_ch_id, next_allotment_id, next_bank_transfer_id, next_txn_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertCH = db.prepare(`
      INSERT INTO code_heads (id, year, code, name, icon, category, split_mode, allocation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertAllotment = db.prepare(`
      INSERT INTO allotment_history (id, year, code_head_id, date, previous_amount, new_amount, delta, remarks, timestamp_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTransfer = db.prepare(`
      INSERT INTO bank_transfers (id, year, date, request_no, code_head_id, requested_by, purpose, amount, remarks, status, timestamp_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTxn = db.prepare(`
      INSERT INTO transactions (id, year, date, vendor_name, bill_no, description, code_head_id, amount, working_amount, cda_amount, split_mode, remarks, timestamp_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const [year, yd] of Object.entries(years)) {
      insertYear.run(
        year,
        year === activeYear ? 1 : 0,
        yd.initialized ? 1 : 0,
        JSON.stringify(yd.sanction || {}),
        yd.nextCHId || 1,
        yd.nextAllotmentId || 1,
        yd.nextBankTransferId || 1,
        yd.nextTxnId || 1,
      );

      for (const ch of (yd.codeHeads || [])) {
        insertCH.run(
          ch.id, year,
          ch.code || ch.id,
          ch.name,
          ch.icon || '📦',
          ch.category || 'General',
          ch.splitMode || 'full',
          (yd.codeHeadAllocations || {})[ch.id] || 0,
        );
      }

      for (const a of (yd.allotmentHistory || [])) {
        insertAllotment.run(
          a.id, year, a.codeHeadId, a.date,
          a.previousAmount || 0, a.newAmount || 0, a.delta || 0,
          a.remarks || '', a.timestamp || 0,
        );
      }

      for (const t of (yd.bankTransfers || [])) {
        insertTransfer.run(
          t.id, year, t.date, t.requestNo || '',
          t.codeHeadId || '', t.requestedBy || '', t.purpose || '',
          t.amount || 0, t.remarks || '',
          t.status || 'pending', t.timestamp || 0,
        );
      }

      for (const t of (yd.transactions || [])) {
        insertTxn.run(
          t.id, year, t.date, t.vendorName, t.billNo,
          t.description || '', t.codeHeadId || '',
          t.amount || 0, t.workingAmount || 0, t.cdaAmount || 0,
          t.splitMode || 'full', t.remarks || '', t.timestamp || 0,
        );
      }
    }
  });

  try {
    restoreAll();
    res.json(buildFullState(db));
  } catch (err) {
    res.status(500).json({ error: `Restore failed: ${err.message}` });
  }
});

// ── Sub-resource Routes ────────────────────────────────────────
app.use('/api/years', yearsRouter);
app.use('/api/years/:year/code-heads', codeHeadsRouter);
app.use('/api/years/:year/bank-transfers', bankTransfersRouter);
app.use('/api/years/:year/transactions', transactionsRouter);

// ── Health check ───────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, timestamp: Date.now() }));

// Serve static files from React frontend build in production
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// For all non-API routes, serve React index.html
app.get(/^(?!\/api).*$/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ── Start ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ CDA Budget API running at http://localhost:${PORT}`);
  console.log(`   Database: ${path.join(__dirname, 'database.sqlite')}\n`);
});
