/* ============================================================
 *  Repository — accès aux données RDV + tâches
 *  - Si Supabase est configuré → Postgres + Realtime
 *  - Sinon → fallback localStorage (mode démo)
 *
 *  Forme exposée au front (camelCase) :
 *    appointment = { id, clientName, address, phone, date, endDate, notes }
 *    task        = { id, title, description, dueDate, priority, done }
 * ============================================================ */
import { supabase, isSupabaseConfigured } from './supabase'
import { loadJSON, saveJSON } from './storage'

/* ---- Mappers DB ↔ Front ---- */
const apptFromRow = (r) => ({
  id: r.id,
  clientName: r.client_name,
  address: r.address || '',
  phone: r.phone || '',
  date: r.start_at,
  endDate: r.end_at,
  notes: r.notes || '',
})

const apptToRow = (a) => ({
  client_name: a.clientName,
  address: a.address || '',
  phone: a.phone || '',
  start_at: a.date,
  end_at: a.endDate || a.date,
  notes: a.notes || '',
})

const taskFromRow = (r) => ({
  id: r.id,
  title: r.title,
  description: r.description || '',
  dueDate: r.due_at,
  priority: r.priority || 'medium',
  done: r.done,
})

const taskToRow = (t) => ({
  title: t.title,
  description: t.description || '',
  due_at: t.dueDate,
  priority: t.priority || 'medium',
  done: t.done || false,
})

/* =====================================================================
 *  MODE SUPABASE
 * ===================================================================== */
const supabaseRepo = {
  async listAppointments() {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('start_at', { ascending: true })
    if (error) throw error
    return data.map(apptFromRow)
  },

  async createAppointment(payload) {
    const { data, error } = await supabase
      .from('appointments')
      .insert(apptToRow(payload))
      .select()
      .single()
    if (error) throw error
    return apptFromRow(data)
  },

  async updateAppointment(id, patch) {
    const row = apptToRow({ ...patch })
    // Ne mettre à jour que les champs fournis
    const cleaned = Object.fromEntries(
      Object.entries(row).filter(([, v]) => v !== undefined && v !== ''),
    )
    const { data, error } = await supabase
      .from('appointments')
      .update(cleaned)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return apptFromRow(data)
  },

  async deleteAppointment(id) {
    const { error } = await supabase.from('appointments').delete().eq('id', id)
    if (error) throw error
  },

  async listTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('due_at', { ascending: true })
    if (error) throw error
    return data.map(taskFromRow)
  },

  async createTask(payload) {
    const { data, error } = await supabase
      .from('tasks')
      .insert(taskToRow(payload))
      .select()
      .single()
    if (error) throw error
    return taskFromRow(data)
  },

  async updateTask(id, patch) {
    const row = {}
    if (patch.title !== undefined) row.title = patch.title
    if (patch.description !== undefined) row.description = patch.description
    if (patch.dueDate !== undefined) row.due_at = patch.dueDate
    if (patch.priority !== undefined) row.priority = patch.priority
    if (patch.done !== undefined) row.done = patch.done
    const { data, error } = await supabase
      .from('tasks')
      .update(row)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return taskFromRow(data)
  },

  async deleteTask(id) {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) throw error
  },

  /** Realtime : retourne un objet { unsubscribe() }. */
  subscribeRealtime(onChange) {
    const channel = supabase
      .channel('ara-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, onChange)
      .subscribe()
    return {
      unsubscribe: () => supabase.removeChannel(channel),
    }
  },
}

/* =====================================================================
 *  MODE LOCAL (fallback localStorage)
 * ===================================================================== */
function uid() {
  return 'id-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

const localRepo = {
  async listAppointments() {
    return loadJSON('appointments', [])
  },
  async createAppointment(payload) {
    const list = loadJSON('appointments', [])
    const item = { id: uid(), ...payload }
    saveJSON('appointments', [...list, item])
    return item
  },
  async updateAppointment(id, patch) {
    const list = loadJSON('appointments', [])
    const next = list.map((a) => (a.id === id ? { ...a, ...patch } : a))
    saveJSON('appointments', next)
    return next.find((a) => a.id === id)
  },
  async deleteAppointment(id) {
    saveJSON('appointments', loadJSON('appointments', []).filter((a) => a.id !== id))
  },
  async listTasks() {
    return loadJSON('tasks', [])
  },
  async createTask(payload) {
    const list = loadJSON('tasks', [])
    const item = { id: uid(), done: false, priority: 'medium', ...payload }
    saveJSON('tasks', [item, ...list])
    return item
  },
  async updateTask(id, patch) {
    const list = loadJSON('tasks', [])
    const next = list.map((t) => (t.id === id ? { ...t, ...patch } : t))
    saveJSON('tasks', next)
    return next.find((t) => t.id === id)
  },
  async deleteTask(id) {
    saveJSON('tasks', loadJSON('tasks', []).filter((t) => t.id !== id))
  },
  subscribeRealtime() {
    return { unsubscribe() {} }
  },
}

export const repository = isSupabaseConfigured ? supabaseRepo : localRepo
export const repoMode = isSupabaseConfigured ? 'supabase' : 'local'
