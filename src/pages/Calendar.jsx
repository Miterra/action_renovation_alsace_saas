import { useMemo, useState } from 'react'
import { Calendar as RBCalendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, parseISO, subDays, formatISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Plus, MapPin, Phone, X, Trash2, Pencil, Bell } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'

const locales = { 'fr-FR': fr }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
})

const messages = {
  date: 'Date',
  time: 'Heure',
  event: 'Événement',
  allDay: 'Toute la journée',
  week: 'Semaine',
  work_week: 'Semaine ouvrée',
  day: 'Jour',
  month: 'Mois',
  previous: 'Précédent',
  next: 'Suivant',
  yesterday: 'Hier',
  tomorrow: 'Demain',
  today: "Aujourd'hui",
  agenda: 'Agenda',
  noEventsInRange: 'Aucun RDV sur cette période.',
  showMore: (n) => `+ ${n} autres`,
}

/** Calcule le rappel par défaut : la veille à 20h, dans le fuseau local du navigateur. */
function defaultReminderAt(startISO) {
  const start = parseISO(startISO)
  const prevDay = subDays(start, 1)
  prevDay.setHours(20, 0, 0, 0)
  return prevDay.toISOString()
}

/** Convertit un ISO UTC vers les valeurs date+heure locales pour des inputs HTML. */
function isoToLocalParts(iso) {
  if (!iso) return { day: '', time: '' }
  const d = parseISO(iso)
  return {
    day: format(d, 'yyyy-MM-dd'),
    time: format(d, 'HH:mm'),
  }
}

export default function Calendar() {
  const { appointments, addAppointment, updateAppointment, deleteAppointment } = useApp()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null) // RDV en cours d'édition
  const [selected, setSelected] = useState(null)
  const [view, setView] = useState('month')
  const [date, setDate] = useState(new Date())

  const events = useMemo(
    () =>
      appointments.map((a) => ({
        id: a.id,
        title: a.clientName,
        start: parseISO(a.date),
        end: parseISO(a.endDate || a.date),
        resource: a,
      })),
    [appointments],
  )

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-900">Calendrier & RDV</h1>
          <p className="text-sm text-navy-500">Planning des visites et chantiers.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-accent">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouveau RDV</span>
        </button>
      </div>

      <div className="card p-3 sm:p-5">
        <div style={{ height: 'min(70vh, 640px)' }}>
          <RBCalendar
            localizer={localizer}
            events={events}
            culture="fr-FR"
            messages={messages}
            view={view}
            date={date}
            onView={setView}
            onNavigate={setDate}
            views={['month', 'week', 'day', 'agenda']}
            startAccessor="start"
            endAccessor="end"
            onSelectEvent={(ev) => setSelected(ev.resource)}
            popup
            longPressThreshold={10}
            formats={{
              monthHeaderFormat: (d) => format(d, 'MMMM yyyy', { locale: fr }),
              weekdayFormat: (d) => format(d, 'EEE', { locale: fr }),
              dayFormat: (d) => format(d, 'EEE d', { locale: fr }),
            }}
          />
        </div>
      </div>

      {(creating || editing) && (
        <AppointmentFormModal
          appointment={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSave={async (payload) => {
            if (editing) {
              await updateAppointment(editing.id, payload)
            } else {
              await addAppointment(payload)
            }
            setCreating(false)
            setEditing(null)
          }}
        />
      )}

      {selected && (
        <AppointmentDetailModal
          appointment={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected)
            setSelected(null)
          }}
          onDelete={async (id) => {
            await deleteAppointment(id)
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}

/* ============================================================
 *  Modal Création/Édition de RDV
 * ============================================================ */
function AppointmentFormModal({ appointment, onClose, onSave }) {
  const isEdit = Boolean(appointment)
  const initial = useMemo(() => {
    if (!appointment) {
      const today = format(new Date(), 'yyyy-MM-dd')
      return {
        clientName: '',
        address: '',
        phone: '',
        day: today,
        time: '09:00',
        duration: '60',
        notes: '',
        reminderDay: format(subDays(new Date(today + 'T09:00'), 1), 'yyyy-MM-dd'),
        reminderTime: '20:00',
      }
    }
    const start = isoToLocalParts(appointment.date)
    const durMin = Math.round(
      (parseISO(appointment.endDate || appointment.date).getTime() -
        parseISO(appointment.date).getTime()) /
        60_000,
    )
    const reminder = isoToLocalParts(
      appointment.reminderAt || defaultReminderAt(appointment.date),
    )
    return {
      clientName: appointment.clientName,
      address: appointment.address || '',
      phone: appointment.phone || '',
      day: start.day,
      time: start.time,
      duration: String(durMin || 60),
      notes: appointment.notes || '',
      reminderDay: reminder.day,
      reminderTime: reminder.time,
    }
  }, [appointment])

  const [form, setForm] = useState(initial)
  // Quand on change la date/heure du RDV (mode création seulement),
  // on recalcule le rappel par défaut automatiquement
  const [reminderTouched, setReminderTouched] = useState(isEdit)

  function update(k, v) {
    setForm((f) => {
      const next = { ...f, [k]: v }
      // Si on change la date/heure du RDV et que le rappel n'a pas été touché,
      // on aligne le rappel à "la veille à 20h"
      if ((k === 'day' || k === 'time') && !reminderTouched) {
        const startISO = `${k === 'day' ? v : f.day}T${k === 'time' ? v : f.time}:00`
        const remParts = isoToLocalParts(defaultReminderAt(startISO))
        next.reminderDay = remParts.day
        next.reminderTime = remParts.time
      }
      return next
    })
  }

  function updateReminder(k, v) {
    setReminderTouched(true)
    setForm((f) => ({ ...f, [k]: v }))
  }

  function submit(e) {
    e.preventDefault()
    if (!form.clientName) return
    const start = new Date(`${form.day}T${form.time}:00`)
    const end = new Date(start.getTime() + Number(form.duration) * 60_000)
    const reminder = new Date(`${form.reminderDay}T${form.reminderTime}:00`)
    onSave({
      clientName: form.clientName,
      address: form.address,
      phone: form.phone,
      date: start.toISOString(),
      endDate: end.toISOString(),
      notes: form.notes,
      reminderAt: reminder.toISOString(),
    })
  }

  return (
    <Modal title={isEdit ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous client'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3.5">
        <div>
          <label className="label">Nom du client *</label>
          <input
            className="input"
            value={form.clientName}
            onChange={(e) => update('clientName', e.target.value)}
            placeholder="Marie Dupont"
            required
          />
        </div>
        <div>
          <label className="label">Adresse</label>
          <input
            className="input"
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
            placeholder="12 rue de la Forêt, Strasbourg"
          />
        </div>
        <div>
          <label className="label">Téléphone</label>
          <input
            className="input"
            type="tel"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="06 12 34 56 78"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date *</label>
            <input
              className="input"
              type="date"
              value={form.day}
              onChange={(e) => update('day', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Heure *</label>
            <input
              className="input"
              type="time"
              value={form.time}
              onChange={(e) => update('time', e.target.value)}
              required
            />
          </div>
        </div>
        <div>
          <label className="label">Durée (min)</label>
          <select
            className="input"
            value={form.duration}
            onChange={(e) => update('duration', e.target.value)}
          >
            <option value="30">30 min</option>
            <option value="60">1 h</option>
            <option value="90">1 h 30</option>
            <option value="120">2 h</option>
            <option value="180">3 h</option>
          </select>
        </div>

        {/* Bloc Rappel */}
        <div className="border border-navy-100 bg-navy-50/30 rounded-xl p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-accent-600" />
            <span className="text-sm font-semibold text-navy-900">Rappel push</span>
            <span className="text-[11px] text-navy-500">par défaut : la veille à 20 h</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date du rappel</label>
              <input
                className="input"
                type="date"
                value={form.reminderDay}
                onChange={(e) => updateReminder('reminderDay', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Heure du rappel</label>
              <input
                className="input"
                type="time"
                value={form.reminderTime}
                onChange={(e) => updateReminder('reminderTime', e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea
            className="input min-h-[80px]"
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Métré, devis, type de travaux…"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" className="btn-ghost flex-1" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn-accent flex-1">
            {isEdit ? 'Enregistrer' : 'Créer le RDV'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ============================================================
 *  Modal Détail RDV
 * ============================================================ */
function AppointmentDetailModal({ appointment, onClose, onEdit, onDelete }) {
  const reminderText = appointment.reminderAt
    ? format(parseISO(appointment.reminderAt), "EEEE d MMM 'à' HH'h'mm", { locale: fr })
    : 'Aucun rappel programmé'

  return (
    <Modal title={appointment.clientName} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="bg-navy-50 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold uppercase text-navy-500 tracking-wider">Quand</p>
          <p className="font-medium text-navy-900 mt-0.5">
            {format(parseISO(appointment.date), "EEEE d MMMM yyyy · HH'h'mm", { locale: fr })}
          </p>
        </div>

        <div className="bg-accent-50 rounded-xl px-4 py-3 flex items-start gap-3">
          <Bell className="w-4 h-4 text-accent-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold uppercase text-accent-700 tracking-wider">Rappel</p>
            <p className="font-medium text-navy-900 mt-0.5 capitalize">{reminderText}</p>
          </div>
        </div>

        {appointment.address && (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(appointment.address)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-3 px-1 hover:text-accent-600"
          >
            <MapPin className="w-4 h-4 mt-0.5 text-navy-400" />
            <span>{appointment.address}</span>
          </a>
        )}
        {appointment.phone && (
          <a
            href={`tel:${appointment.phone.replace(/\s/g, '')}`}
            className="flex items-center gap-3 px-1 hover:text-accent-600"
          >
            <Phone className="w-4 h-4 text-navy-400" />
            <span>{appointment.phone}</span>
          </a>
        )}
        {appointment.notes && (
          <div className="border-t border-navy-100 pt-3">
            <p className="text-xs font-semibold uppercase text-navy-500 tracking-wider mb-1">Notes</p>
            <p className="text-navy-700 whitespace-pre-wrap">{appointment.notes}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button onClick={onEdit} className="btn-primary">
            <Pencil className="w-4 h-4" /> Modifier
          </button>
          <button
            onClick={() => onDelete(appointment.id)}
            className="btn bg-red-50 text-red-600 hover:bg-red-100"
          >
            <Trash2 className="w-4 h-4" /> Supprimer
          </button>
        </div>
      </div>
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
