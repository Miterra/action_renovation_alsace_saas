import { useState, useMemo } from 'react'
import {
  Plus,
  Check,
  Trash2,
  X,
  Flame,
  Circle,
  Bell,
  Pencil,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { format, isPast, parseISO, isToday, isTomorrow } from 'date-fns'
import { fr } from 'date-fns/locale'
// NB : les rappels (15 min avant) sont envoyés côté serveur par l'Edge
// Function Supabase `send-reminders` qui s'exécute toutes les minutes.

const FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'open', label: 'À faire' },
  { key: 'overdue', label: 'En retard' },
  { key: 'done', label: 'Terminées' },
]

export default function Tasks() {
  const { tasks, addTask, updateTask, toggleTask, deleteTask } = useApp()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null) // tâche en cours d'édition
  const [filter, setFilter] = useState('open')

  const filtered = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    switch (filter) {
      case 'open':
        return sorted.filter((t) => !t.done)
      case 'overdue':
        return sorted.filter((t) => !t.done && isPast(parseISO(t.dueDate)))
      case 'done':
        return sorted.filter((t) => t.done)
      default:
        return sorted
    }
  }, [tasks, filter])

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-900">Tâches</h1>
          <p className="text-sm text-navy-500">Suivi des actions à mener.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-accent">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouvelle tâche</span>
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`chip whitespace-nowrap px-3.5 py-2 transition ${
              filter === f.key
                ? 'bg-navy-900 text-white'
                : 'bg-white text-navy-700 border border-navy-100 hover:bg-navy-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card card-pad text-center text-sm text-navy-500">
          Aucune tâche dans cette catégorie.
        </div>
      ) : (
        <div className="card divide-y divide-navy-100">
          {filtered.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onToggle={toggleTask}
              onEdit={() => setEditing(t)}
              onDelete={deleteTask}
            />
          ))}
        </div>
      )}

      {(creating || editing) && (
        <TaskFormModal
          task={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSave={async (payload) => {
            if (editing) {
              await updateTask(editing.id, payload)
            } else {
              await addTask(payload)
            }
            setCreating(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function TaskRow({ task, onToggle, onEdit, onDelete }) {
  const due = parseISO(task.dueDate)
  const overdue = !task.done && isPast(due)
  return (
    <div className="flex items-start gap-3 px-5 py-4 group">
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggle(task.id)
        }}
        className={`w-6 h-6 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition
          ${task.done
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'border-navy-200 hover:border-accent-500'}`}
        aria-label={task.done ? 'Marquer non fait' : 'Marquer fait'}
      >
        {task.done && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
      </button>
      <button
        onClick={onEdit}
        className="flex-1 min-w-0 text-left hover:bg-navy-50/40 -mx-2 px-2 py-0.5 rounded-lg transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <p
            className={`font-medium text-sm ${
              task.done ? 'text-navy-400 line-through' : 'text-navy-900'
            }`}
          >
            {task.title}
          </p>
          <PriorityBadge priority={task.priority} />
        </div>
        {task.description && (
          <p className={`text-xs mt-0.5 ${task.done ? 'text-navy-300' : 'text-navy-500'}`}>
            {task.description}
          </p>
        )}
        <p
          className={`text-[11px] mt-1 font-medium ${
            overdue ? 'text-red-600' : 'text-navy-400'
          }`}
        >
          {formatDue(task.dueDate)}
        </p>
      </button>
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg hover:bg-navy-100 text-navy-500"
          aria-label="Modifier"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
          aria-label="Supprimer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function PriorityBadge({ priority }) {
  if (priority === 'high')
    return (
      <span className="chip bg-accent-50 text-accent-700">
        <Flame className="w-3 h-3" /> Prioritaire
      </span>
    )
  if (priority === 'medium')
    return (
      <span className="chip bg-navy-50 text-navy-700">
        <Circle className="w-2.5 h-2.5 fill-current" /> Normal
      </span>
    )
  return null
}

/* ============================================================
 *  Modal Création / Édition de tâche
 * ============================================================ */
function TaskFormModal({ task, onClose, onSave }) {
  const isEdit = Boolean(task)
  const initial = useMemo(() => {
    if (!task) {
      return {
        title: '',
        description: '',
        day: format(new Date(), 'yyyy-MM-dd'),
        time: '17:00',
        priority: 'medium',
      }
    }
    const due = parseISO(task.dueDate)
    return {
      title: task.title,
      description: task.description || '',
      day: format(due, 'yyyy-MM-dd'),
      time: format(due, 'HH:mm'),
      priority: task.priority || 'medium',
    }
  }, [task])

  const [form, setForm] = useState(initial)

  function submit(e) {
    e.preventDefault()
    if (!form.title) return
    const dueDate = new Date(`${form.day}T${form.time}:00`).toISOString()
    onSave({
      title: form.title,
      description: form.description,
      dueDate,
      priority: form.priority,
    })
  }

  return (
    <Modal title={isEdit ? 'Modifier la tâche' : 'Nouvelle tâche'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3.5">
        <div>
          <label className="label">Titre *</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Envoyer le devis à…"
            required
          />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            className="input min-h-[70px]"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Détails utiles…"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date *</label>
            <input
              className="input"
              type="date"
              value={form.day}
              onChange={(e) => setForm({ ...form, day: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Heure</label>
            <input
              className="input"
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="label">Priorité</label>
          <div className="grid grid-cols-3 gap-2">
            {['low', 'medium', 'high'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setForm({ ...form, priority: p })}
                className={`btn ${form.priority === p ? 'btn-primary' : 'btn-ghost'}`}
              >
                {p === 'low' ? 'Basse' : p === 'medium' ? 'Normale' : 'Haute'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-xl border border-navy-100 bg-navy-50/40">
          <Bell className="w-4 h-4 mt-0.5 text-accent-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-navy-900">Rappel automatique</p>
            <p className="text-xs text-navy-500">
              Notification 15 min avant l'échéance (push envoyé par le serveur, même app fermée).
            </p>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            Annuler
          </button>
          <button type="submit" className="btn-accent flex-1">
            {isEdit ? 'Enregistrer' : 'Créer la tâche'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-navy-950/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-card max-h-[92vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-navy-100 flex items-center justify-between">
          <h3 className="font-semibold text-navy-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-navy-50">
            <X className="w-4 h-4 text-navy-600" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function formatDue(iso) {
  const d = parseISO(iso)
  const t = format(d, "HH'h'mm", { locale: fr })
  if (isToday(d)) return `Aujourd'hui · ${t}`
  if (isTomorrow(d)) return `Demain · ${t}`
  return format(d, "EEE d MMM · HH'h'mm", { locale: fr })
}
