import { useMemo, useState } from 'react'
import { Calendar as RBCalendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Plus, MapPin, Phone, X, Trash2 } from 'lucide-react'
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
  today: 'Aujourd\'hui',
  agenda: 'Agenda',
  noEventsInRange: 'Aucun RDV sur cette période.',
  showMore: (n) => `+ ${n} autres`,
}

export default function Calendar() {
  const { appointments, addAppointment, deleteAppointment } = useApp()
  const [creating, setCreating] = useState(false)
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

      {creating && (
        <NewAppointmentModal
          onClose={() => setCreating(false)}
          onSave={(payload) => {
            addAppointment(payload)
            setCreating(false)
          }}
        />
      )}

      {selected && (
        <AppointmentDetailModal
          appointment={selected}
          onClose={() => setSelected(null)}
          onDelete={(id) => {
            deleteAppointment(id)
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}

function NewAppointmentModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    clientName: '',
    address: '',
    phone: '',
    day: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    duration: '60',
    notes: '',
  })

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function submit(e) {
    e.preventDefault()
    if (!form.clientName) return
    const start = new Date(`${form.day}T${form.time}:00`)
    const end = new Date(start.getTime() + Number(form.duration) * 60_000)
    onSave({
      clientName: form.clientName,
      address: form.address,
      phone: form.phone,
      date: start.toISOString(),
      endDate: end.toISOString(),
      notes: form.notes,
    })
  }

  return (
    <Modal onClose={onClose} title="Nouveau rendez-vous client">
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
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  )
}

function AppointmentDetailModal({ appointment, onClose, onDelete }) {
  return (
    <Modal onClose={onClose} title={appointment.clientName}>
      <div className="space-y-3 text-sm">
        <div className="bg-navy-50 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold uppercase text-navy-500 tracking-wider">Quand</p>
          <p className="font-medium text-navy-900 mt-0.5">
            {format(parseISO(appointment.date), 'EEEE d MMMM yyyy · HH\'h\'mm', { locale: fr })}
          </p>
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
        <button
          onClick={() => onDelete(appointment.id)}
          className="btn w-full mt-2 bg-red-50 text-red-600 hover:bg-red-100"
        >
          <Trash2 className="w-4 h-4" /> Supprimer le RDV
        </button>
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
