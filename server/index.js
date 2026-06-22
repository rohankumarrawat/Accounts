import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';

import yearsRouter from './routes/years.js';
import codeHeadsRouter from './routes/codeHeads.js';
import bankTransfersRouter from './routes/bankTransfers.js';
import transactionsRouter from './routes/transactions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

// ── Middleware ──────────────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

import { getDb, buildFullState } from './db.js';

// ── Routes ─────────────────────────────────────────────────────
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

app.use('/api/years', yearsRouter);
app.use('/api/years/:year/code-heads', codeHeadsRouter);
app.use('/api/years/:year/bank-transfers', bankTransfersRouter);
app.use('/api/years/:year/transactions', transactionsRouter);

// ── Health check ───────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, timestamp: Date.now() }));

// ── Start ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ CDA Budget API running at http://localhost:${PORT}`);
  console.log(`   Database: ${path.join(__dirname, 'database.sqlite')}\n`);
});
