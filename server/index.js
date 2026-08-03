const express = require('express');
const cors = require('cors');
const { newDb } = require('pg-mem');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// ── In-memory Postgres ────────────────────────────────────────────────────────
const db = newDb();
const pool = db.adapters.createPg().Pool;
const client = new pool();

async function initDb() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      category TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('income','expense')),
      date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS savings_goals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      target_amount NUMERIC NOT NULL,
      current_amount NUMERIC NOT NULL DEFAULT 0,
      color TEXT NOT NULL DEFAULT '#6366f1',
      deadline TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly','yearly','weekly')),
      category TEXT NOT NULL,
      next_billing_date TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TEXT NOT NULL
    );
  `);
}

// ── Transactions ──────────────────────────────────────────────────────────────
app.get('/api/transactions', async (req, res) => {
  const { rows } = await client.query(
    'SELECT * FROM transactions ORDER BY date DESC, created_at DESC'
  );
  res.json(rows);
});

app.post('/api/transactions', async (req, res) => {
  const { description, amount, category, type, date } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();
  await client.query(
    'INSERT INTO transactions (id, description, amount, category, type, date, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [id, description, amount, category, type, date, now]
  );
  res.json({ id, description, amount, category, type, date, created_at: now });
});

app.delete('/api/transactions/:id', async (req, res) => {
  await client.query('DELETE FROM transactions WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ── Savings Goals ─────────────────────────────────────────────────────────────
app.get('/api/goals', async (req, res) => {
  const { rows } = await client.query('SELECT * FROM savings_goals ORDER BY created_at DESC');
  res.json(rows);
});

app.post('/api/goals', async (req, res) => {
  const { name, target_amount, current_amount = 0, color = '#6366f1', deadline } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();
  await client.query(
    'INSERT INTO savings_goals (id, name, target_amount, current_amount, color, deadline, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [id, name, target_amount, current_amount, color, deadline || null, now]
  );
  res.json({ id, name, target_amount, current_amount, color, deadline, created_at: now });
});

app.patch('/api/goals/:id', async (req, res) => {
  const { current_amount } = req.body;
  await client.query('UPDATE savings_goals SET current_amount=$1 WHERE id=$2', [current_amount, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/goals/:id', async (req, res) => {
  await client.query('DELETE FROM savings_goals WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ── Subscriptions ─────────────────────────────────────────────────────────────
app.get('/api/subscriptions', async (req, res) => {
  const { rows } = await client.query('SELECT * FROM subscriptions ORDER BY next_billing_date ASC');
  res.json(rows);
});

app.post('/api/subscriptions', async (req, res) => {
  const { name, amount, billing_cycle, category, next_billing_date, color = '#6366f1' } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();
  await client.query(
    'INSERT INTO subscriptions (id, name, amount, billing_cycle, category, next_billing_date, color, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, name, amount, billing_cycle, category, next_billing_date, color, now]
  );
  res.json({ id, name, amount, billing_cycle, category, next_billing_date, color, created_at: now });
});

app.delete('/api/subscriptions/:id', async (req, res) => {
  await client.query('DELETE FROM subscriptions WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ── Summary ───────────────────────────────────────────────────────────────────
app.get('/api/summary', async (req, res) => {
  const { rows: txns } = await client.query('SELECT * FROM transactions');
  const { rows: subs } = await client.query('SELECT * FROM subscriptions');

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const thisMonth = txns.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const income = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
  const expenses = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
  const monthlySubsCost = subs.reduce((s, sub) => {
    if (sub.billing_cycle === 'monthly') return s + parseFloat(sub.amount);
    if (sub.billing_cycle === 'yearly') return s + parseFloat(sub.amount) / 12;
    if (sub.billing_cycle === 'weekly') return s + parseFloat(sub.amount) * 4.33;
    return s;
  }, 0);

  const spendingByCategory = {};
  thisMonth.filter(t => t.type === 'expense').forEach(t => {
    spendingByCategory[t.category] = (spendingByCategory[t.category] || 0) + parseFloat(t.amount);
  });

  res.json({
    income,
    expenses,
    balance: income - expenses,
    monthlySubsCost,
    spendingByCategory,
  });
});

initDb().then(() => {
  app.listen(3001, () => console.log('Server running on http://localhost:3001'));
});
