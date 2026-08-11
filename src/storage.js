import { supabase } from './utils/supabase'

let _userEmail = null
export const setUserEmail = (email) => { _userEmail = email }

function check(error) {
  if (error) throw new Error(error.message)
}

export const api = {
  // ── Transactions ─────────────────────────────────────────────────────
  async getTransactions() {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_email', _userEmail)
      .order('date', { ascending: false })
    check(error)
    return data
  },

  async addTransaction(body) {
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...body, user_email: _userEmail })
      .select()
      .single()
    check(error)
    return data
  },

  async deleteTransaction(id) {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_email', _userEmail)
    check(error)
    return { ok: true }
  },

  // ── Goals ─────────────────────────────────────────────────────────────
  async getGoals() {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_email', _userEmail)
      .order('created_at', { ascending: false })
    check(error)
    return data
  },

  async addGoal(body) {
    const { data, error } = await supabase
      .from('goals')
      .insert({ current_amount: 0, color: '#6366f1', ...body, user_email: _userEmail })
      .select()
      .single()
    check(error)
    return data
  },

  async updateGoal(id, body) {
    const { error } = await supabase
      .from('goals')
      .update(body)
      .eq('id', id)
      .eq('user_email', _userEmail)
    check(error)
    return { ok: true }
  },

  async deleteGoal(id) {
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id)
      .eq('user_email', _userEmail)
    check(error)
    return { ok: true }
  },

  // ── Subscriptions ─────────────────────────────────────────────────────
  async getSubscriptions() {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_email', _userEmail)
      .order('next_billing_date', { ascending: true })
    check(error)
    return data
  },

  async addSubscription(body) {
    const { data, error } = await supabase
      .from('subscriptions')
      .insert({ color: '#6366f1', ...body, user_email: _userEmail })
      .select()
      .single()
    check(error)
    return data
  },

  async deleteSubscription(id) {
    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', id)
      .eq('user_email', _userEmail)
    check(error)
    return { ok: true }
  },

  // ── Summary ───────────────────────────────────────────────────────────
  async getSummary() {
    const [txns, subs] = await Promise.all([
      api.getTransactions(),
      api.getSubscriptions(),
    ])

    const now = new Date()
    const month = now.getMonth()
    const year = now.getFullYear()

    const thisMonth = txns.filter(t => {
      const d = new Date(t.date)
      return d.getMonth() === month && d.getFullYear() === year
    })

    const income = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0)
    const expenses = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0)
    const monthlySubsCost = subs.reduce((s, sub) => {
      if (sub.billing_cycle === 'monthly') return s + parseFloat(sub.amount)
      if (sub.billing_cycle === 'yearly') return s + parseFloat(sub.amount) / 12
      if (sub.billing_cycle === 'weekly') return s + parseFloat(sub.amount) * 4.33
      return s
    }, 0)

    const spendingByCategory = {}
    thisMonth.filter(t => t.type === 'expense').forEach(t => {
      spendingByCategory[t.category] = (spendingByCategory[t.category] || 0) + parseFloat(t.amount)
    })

    return { income, expenses, balance: income - expenses, monthlySubsCost, spendingByCategory }
  },
}
