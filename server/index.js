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

// ── Routes ─────────────────────────────────────────────────────
app.use('/api/data', yearsRouter);
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
