import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'database.sqlite');

let _db = null;

export function getDb() {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS financial_years (
      year                  TEXT PRIMARY KEY,
      is_active             INTEGER NOT NULL DEFAULT 0,
      initialized           INTEGER NOT NULL DEFAULT 0,
      sanction_json         TEXT    NOT NULL DEFAULT '{}',
      next_ch_id            INTEGER NOT NULL DEFAULT 1,
      next_allotment_id     INTEGER NOT NULL DEFAULT 1,
      next_bank_transfer_id INTEGER NOT NULL DEFAULT 1,
      next_txn_id           INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS code_heads (
      id         TEXT NOT NULL,
      year       TEXT NOT NULL,
      code       TEXT NOT NULL DEFAULT '',
      name       TEXT NOT NULL,
      icon       TEXT NOT NULL DEFAULT '📦',
      category   TEXT NOT NULL DEFAULT 'General',
      split_mode TEXT NOT NULL DEFAULT 'full',
      allocation REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (id, year),
      FOREIGN KEY (year) REFERENCES financial_years(year) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS allotment_history (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      year            TEXT    NOT NULL,
      code_head_id    TEXT    NOT NULL,
      date            TEXT    NOT NULL,
      previous_amount REAL    NOT NULL DEFAULT 0,
      new_amount      REAL    NOT NULL DEFAULT 0,
      delta           REAL    NOT NULL DEFAULT 0,
      remarks         TEXT    NOT NULL DEFAULT '',
      timestamp_ms    INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (year) REFERENCES financial_years(year) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bank_transfers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      year          TEXT    NOT NULL,
      date          TEXT    NOT NULL,
      request_no    TEXT    NOT NULL DEFAULT '',
      code_head_id  TEXT    NOT NULL DEFAULT '',
      requested_by  TEXT    NOT NULL DEFAULT '',
      purpose       TEXT    NOT NULL DEFAULT '',
      amount        REAL    NOT NULL DEFAULT 0,
      remarks       TEXT    NOT NULL DEFAULT '',
      status        TEXT    NOT NULL DEFAULT 'pending',
      timestamp_ms  INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (year) REFERENCES financial_years(year) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      year           TEXT    NOT NULL,
      date           TEXT    NOT NULL,
      vendor_name    TEXT    NOT NULL,
      bill_no        TEXT    NOT NULL,
      description    TEXT    NOT NULL DEFAULT '',
      code_head_id   TEXT    NOT NULL DEFAULT '',
      amount         REAL    NOT NULL DEFAULT 0,
      working_amount REAL    NOT NULL DEFAULT 0,
      cda_amount     REAL    NOT NULL DEFAULT 0,
      split_mode     TEXT    NOT NULL DEFAULT 'full',
      remarks        TEXT    NOT NULL DEFAULT '',
      iafs_no        TEXT    NOT NULL DEFAULT '',
      bill_no_dt     TEXT    NOT NULL DEFAULT '',
      timestamp_ms   INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (year) REFERENCES financial_years(year) ON DELETE CASCADE
    );
  `);

  // Migration for new columns
  try {
    db.exec("ALTER TABLE transactions ADD COLUMN iafs_no TEXT NOT NULL DEFAULT ''");
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec("ALTER TABLE transactions ADD COLUMN bill_no_dt TEXT NOT NULL DEFAULT ''");
  } catch (e) {
    // Column already exists, ignore
  }
}

// ─── Helper: build the full root object from DB ──────────────────────────────

export function buildFullState(db) {
  const years = db.prepare('SELECT * FROM financial_years').all();
  const codeHeads = db.prepare('SELECT * FROM code_heads').all();
  const allotments = db.prepare('SELECT * FROM allotment_history ORDER BY id ASC').all();
  const transfers = db.prepare('SELECT * FROM bank_transfers ORDER BY id ASC').all();
  const txns = db.prepare('SELECT * FROM transactions ORDER BY id ASC').all();

  let activeYear = null;
  const financialYears = {};

  for (const fy of years) {
    if (fy.is_active) activeYear = fy.year;

    const sanction = JSON.parse(fy.sanction_json || '{}');
    const yearCodeHeads = codeHeads
      .filter(ch => ch.year === fy.year)
      .map(ch => ({
        id: ch.id,
        code: ch.code,
        name: ch.name,
        icon: ch.icon,
        category: ch.category,
        splitMode: ch.split_mode,
      }));

    const codeHeadAllocations = {};
    for (const ch of codeHeads.filter(ch => ch.year === fy.year)) {
      codeHeadAllocations[ch.id] = ch.allocation;
    }

    const allotmentHistory = allotments
      .filter(a => a.year === fy.year)
      .map(a => ({
        id: a.id,
        codeHeadId: a.code_head_id,
        date: a.date,
        previousAmount: a.previous_amount,
        newAmount: a.new_amount,
        delta: a.delta,
        remarks: a.remarks,
        timestamp: a.timestamp_ms,
      }));

    const bankTransfers = transfers
      .filter(t => t.year === fy.year)
      .map(t => ({
        id: t.id,
        date: t.date,
        requestNo: t.request_no,
        codeHeadId: t.code_head_id,
        requestedBy: t.requested_by,
        purpose: t.purpose,
        amount: t.amount,
        remarks: t.remarks,
        status: t.status,
        timestamp: t.timestamp_ms,
      }));

    const transactions = txns
      .filter(t => t.year === fy.year)
      .map(t => ({
        id: t.id,
        date: t.date,
        vendorName: t.vendor_name,
        billNo: t.bill_no,
        description: t.description,
        codeHeadId: t.code_head_id,
        amount: t.amount,
        workingAmount: t.working_amount,
        cdaAmount: t.cda_amount,
        splitMode: t.split_mode,
        remarks: t.remarks,
        iafsNo: t.iafs_no || '',
        billNoDt: t.bill_no_dt || '',
        timestamp: t.timestamp_ms,
      }));

    financialYears[fy.year] = {
      initialized: fy.initialized === 1,
      sanction,
      workingFunds: 0,   // recalculated client-side
      cdaRetention: 0,   // recalculated client-side
      codeHeads: yearCodeHeads,
      nextCHId: fy.next_ch_id,
      codeHeadAllocations,
      allotmentHistory,
      nextAllotmentId: fy.next_allotment_id,
      bankTransfers,
      nextBankTransferId: fy.next_bank_transfer_id,
      transactions,
      nextTxnId: fy.next_txn_id,
    };
  }

  return { financialYears, activeYear };
}
