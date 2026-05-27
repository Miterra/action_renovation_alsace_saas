import { useMemo, useState, useCallback } from 'react'
import { Calendar as RBCalendar, dateFnsLocalizer } from 'react-big-calendar'
import {
  format,
  parse,
  startOfWeek,
  getDay,
  parseISO,
  subDays,
  startOfDay,
  endOfDay,
  differenceInCalendarDays,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Plus, MapPin, Phone, X, Trash2, Pencil, Bell, CalendarRange } from 'lucide-react'
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
  noEventsInRange: 'Aucune période sur cette plage.',
  showMore: (n) => `+ ${n} autres`,
}

/* ============================================================
 *  Palette de couleurs pour distinguer les périodes du mois
 *  Couleurs choisies pour bon contraste sur fond clair, accessibles,
 *  et complémentaires (pas trop saturées pour rester pro).
 * ============================================================ */
const PALETTE = [
  { bg: '#1f3856', border: '#0f2742', text: '#ffffff', name: 'Navy' },
  { bg: '#f97316', border: '#c2410c', text: '#ffffff', name: 'Orange' },
  { bg: '#0d9488', border: '#0f766e', text: '#ffffff', name: 'Teal' },
  { bg: '#7c3aed', border: '#6d28d9', text: '#ffffff', name: 'Purple' },
  { bg: '#db2777', border: '#be185d', text: '#ffffff', name: 'Pink' },
  { bg: '#0891b2', border: '#0e7490', text: '#ffffff', name: 'Cyan' },
  { bg: '#d97706', border: '#b45309', text: '#ffffff', name: 'Amber' },
  { bg: '#dc2626', border: '#b91c1c', text: '#ffffff', name: 'Red' },
  { bg: '#4f46e5', border: '#4338ca', text: '#ffffff', name: 'Indigo' },
  { bg: '#65a30d', border: '#4d7c0f', text: '#ffffff', name: 'Lime' },
]

/** Construit un index "couleur par RDV" pour le mois affiché.
 *  Chaque RDV reçoit une couleur distincte basée sur son ordre dans le mois. */
function buildColorIndex(appointments) {
  const byMonth = new Map() // 'YYYY-MM' → array of sorted ids
  for (const a of appointments) {
    const key = format(parseISO(a.date), 'yyyy-MM')
    if (!byMonth.has(key)) byMonth.set(key, [])
    byMonth.get(key).push(a)
  }
  const colorById = new Map()
  for (const [, list] of byMonth) {
    list
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((appt, idx) => {
        colorById.set(appt.id, PALETTE[idx % PALETTE.length])
      })
  }
  return colorById
}

function defaultReminderAtFromDay(startDay) {
  // Veille à 20h, dans le fuseau local du navigateur
  const start = new Date(`${startDay}T20:00:00`)
  const prevDay = subDays(start, 1)
  return prevDay.toISOString()
}

function isoToDay(iso) {
  if (!iso) return ''
  return format(parseISO(iso), 'yyyy-MM-dd')
}

function isoToTime(iso) {
  if (!iso) return ''
  return format(parseISO(iso), 'HH:mm')
}

export default function Calendar() {
  const { appointments, addAppointment, updateAppointment, deleteAppointment } = useApp()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selected, setSelected] = useState(null)
  const [view, setView] = useState('month')
  const [date, setDate] = useState(new Date())

  const colorById = useMemo(() => buildColorIndex(appointments), [appointments])

  const events = useMemo(
    () =>
      appointments.map((a) => {
        const start = parseISO(a.date)
        const end = parseISO(a.endDate || a.date)
        return {
          id: a.id,
          title: a.clientName,
          start,
          end,
          allDay: a.allDay ?? true,
          resource: a,
        }
      }),
    [appointments],
  )

  const eventPropGetter = useCallback(
    (event) => {
      const color = colorById.get(event.id) || PALETTE[0]
      return {
        style: {
          backgroundColor: color.bg,
          borderColor: color.border,
          color: color.text,
          borderRadius: '6px',
          border: `1px solid ${color.border}`,
          fontWeight: 500,
        },
      }
    },
    [colorById],
  )

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-900">Calendrier & Chantiers</h1>
          <p className="text-sm text-navy-500">Périodes de chantier et rendez-vous clients.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-accent">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouvelle période</span>
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
            eventPropGetter={eventPropGetter}
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
          color={colorById.get(selected.id)}
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
 *  Modal Création/Édition de période
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
        allDay: true,
        startDay: today,
        endDay: today,
        startTime: '09:00',
        endTime: '17:00',
        notes: '',
        reminderDay: format(subDays(new Date(`${today}T20:00`), 1), 'yyyy-MM-dd'),
        reminderTime: '20:00',
      }
    }
    const startDay = isoToDay(appointment.date)
    const endDay = isoToDay(appointment.endDate || appointment.date)
    return {
      clientName: appointment.clientName,
      address: appointment.address || '',
      phone: appointment.phone || '',
      allDay: appointment.allDay ?? true,
      startDay,
      endDay,
      startTime: isoToTime(appointment.date) || '09:00',
      endTime: isoToTime(appointment.endDate) || '17:00',
      notes: appointment.notes || '',
      reminderDay: isoToDay(appointment.reminderAt || defaultReminderAtFromDay(startDay)),
      reminderTime: isoToTime(appointment.reminderAt || defaultReminderAtFromDay(startDay)) || '20:00',
    }
  }, [appointment])

  const [form, setForm] = useState(initial)
  const [reminderTouched, setReminderTouched] = useState(isEdit)

  function update(k, v) {
    setForm((f) => {
      const next = { ...f, [k]: v }
      // Si on change startDay : assurer que endDay >= startDay, et recalculer le rappel par défaut
      if (k === 'startDay') {
        if (next.endDay < v) next.endDay = v
        if (!reminderTouched) {
          const rem = defaultReminderAtFromDay(v)
          next.reminderDay = isoToDay(rem)
          next.reminderTime = '20:00'
        }
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

    let startISO, endISO
    if (form.allDay) {
      // Période en mode "toute la journée" : du jour début 00:00 au jour fin 23:59:59 locaux
      startISO = startOfDay(parseISO(form.startDay)).toISOString()
      endISO = endOfDay(parseISO(form.endDay)).toISOString()
    } else {
      startISO = new Date(`${form.startDay}T${form.startTime}:00`).toISOString()
      endISO = new Date(`${form.endDay}T${form.endTime}:00`).toISOString()
    }
    const reminder = new Date(`${form.reminderDay}T${form.reminderTime}:00`).toISOString()

    onSave({
      clientName: form.clientName,
      address: form.address,
      phone: form.phone,
      date: startISO,
      endDate: endISO,
      allDay: form.allDay,
      notes: form.notes,
      reminderAt: reminder,
    })
  }

  const nbDays = (() => {
    if (!form.startDay || !form.endDay) return 1
    return Math.max(1, differenceInCalendarDays(parseISO(form.endDay), parseISO(form.startDay)) + 1)
  })()

  return (
    <Modal title={isEdit ? 'Modifier la période' : 'Nouvelle période / chantier'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3.5">
        <div>
          <label className="label">Client *</label>
          <input
            className="input"
            value={form.clientName}
            onChange={(e) => update('clientName', e.target.value)}
            placeholder="Marie Dupont"
            required
          />
        </div>
        <div>
          <label className="label">Adresse du chantier</label>
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

        {/* Période : Du → Au */}
        <div className="border border-navy-100 bg-navy-50/30 rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-navy-700" />
            <span className="text-sm font-semibold text-navy-900">Période</span>
            <span className="text-[11px] text-navy-500 ml-auto">
              {nbDays} jour{nbDays > 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Du *</label>
              <input
                className="input"
                type="date"
                value={form.startDay}
                onChange={(e) => update('startDay', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Au *</label>
              <input
                className="input"
                type="date"
                value={form.endDay}
                min={form.startDay}
                onChange={(e) => update('endDay', e.target.value)}
                required
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => update('allDay', e.target.checked)}
              className="accent-accent-500"
            />
            <span className="text-sm text-navy-700">
              Toute la journée
              <span className="text-xs text-navy-500 ml-1">
                (décocher pour RDV avec heures précises)
              </span>
            </span>
          </label>
          {!form.allDay && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="label">Heure début</label>
                <input
                  className="input"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => update('startTime', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Heure fin</label>
                <input
                  className="input"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => update('endTime', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Rappel push */}
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
            placeholder="Type de travaux, matériel à prévoir…"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" className="btn-ghost flex-1" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn-accent flex-1">
            {isEdit ? 'Enregistrer' : 'Créer la période'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ============================================================
 *  Modal Détail période
 * ============================================================ */
function AppointmentDetailModal({ appointment, color, onClose, onEdit, onDelete }) {
  const start = parseISO(appointment.date)
  const end = parseISO(appointment.endDate || appointment.date)
  const nbDays = differenceInCalendarDays(end, start) + 1
  const allDay = appointment.allDay ?? true

  const reminderText = appointment.reminderAt
    ? format(parseISO(appointment.reminderAt), "EEEE d MMM 'à' HH'h'mm", { locale: fr })
    : 'Aucun rappel programmé'

  let periodText
  if (nbDays === 1) {
    periodText = format(start, 'EEEE d MMMM yyyy', { locale: fr })
    if (!allDay) {
      periodText += ` · ${format(start, "HH'h'mm")} - ${format(end, "HH'h'mm")}`
    }
  } else {
    periodText = `Du ${format(start, 'EEE d MMM', { locale: fr })} au ${format(end, 'EEE d MMM yyyy', { locale: fr })}`
  }

  return (
    <Modal title={appointment.clientName} onClose={onClose}>
      <div className="space-y-3 text-sm">
        {color && (
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ backgroundColor: color.bg + '15', borderLeft: `4px solid ${color.bg}` }}
          >
            <CalendarRange className="w-4 h-4" style={{ color: color.bg }} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: color.border }}>
                Période · {nbDays} jour{nbDays > 1 ? 's' : ''}
              </p>
              <p className="font-medium text-navy-900 mt-0.5 capitalize">{periodText}</p>
            </div>
          </div>
        )}

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
