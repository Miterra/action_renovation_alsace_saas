import { Link } from 'react-router-dom'
import {
  CalendarCheck,
  ListTodo,
  Mail,
  TrendingUp,
  Clock,
  MapPin,
  Phone,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function Dashboard() {
  const { appointments, tasks } = useApp()

  const todayAppointments = appointments
    .filter((a) => isToday(parseISO(a.date)))
    .sort((a, b) => a.date.localeCompare(b.date))

  const nextAppointment = appointments
    .filter((a) => new Date(a.date) >= new Date())
    .sort((a, b) => a.date.localeCompare(b.date))[0]

  const todoToday = tasks.filter((t) => !t.done)
  const overdueTasks = tasks.filter((t) => !t.done && isPast(parseISO(t.dueDate)))

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero card */}
      <section className="card card-pad bg-gradient-to-br from-navy-900 to-navy-700 text-white border-navy-900 overflow-hidden relative">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-accent-500/20 rounded-full blur-3xl" />
        <div className="absolute -right-4 -bottom-8 w-32 h-32 bg-accent-500/10 rounded-full blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-accent-300 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Vue du jour
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">
            {todayAppointments.length} RDV ·{' '}
            <span className="text-accent-300">{todoToday.length} tâches</span>
          </h1>
          <p className="text-navy-200 text-sm">
            {todayAppointments.length === 0
              ? 'Aucun RDV prévu aujourd\'hui — bonne journée de chantier !'
              : `Premier RDV à ${format(parseISO(todayAppointments[0].date), 'HH\'h\'mm', { locale: fr })}.`}
          </p>
        </div>
      </section>

      {/* Stat cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={CalendarCheck}
          label="RDV aujourd'hui"
          value={todayAppointments.length}
          tone="navy"
          to="/calendar"
        />
        <StatCard
          icon={ListTodo}
          label="Tâches en cours"
          value={todoToday.length}
          tone="accent"
          to="/tasks"
        />
        <StatCard
          icon={Clock}
          label="En retard"
          value={overdueTasks.length}
          tone={overdueTasks.length > 0 ? 'danger' : 'navy'}
          to="/tasks"
        />
        <StatCard
          icon={TrendingUp}
          label="Cette semaine"
          value={appointments.length}
          tone="navy"
          to="/calendar"
        />
      </section>

      {/* Prochain RDV */}
      <section>
        <SectionHeader title="Prochain rendez-vous" linkTo="/calendar" linkLabel="Voir le calendrier" />
        {nextAppointment ? (
          <div className="card card-pad">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-accent-600 font-semibold uppercase tracking-wider mb-1">
                  {formatRelative(nextAppointment.date)}
                </p>
                <h3 className="font-semibold text-navy-900 text-lg">
                  {nextAppointment.clientName}
                </h3>
                {nextAppointment.notes && (
                  <p className="text-sm text-navy-600 mt-1">{nextAppointment.notes}</p>
                )}
              </div>
              <span className="chip bg-navy-50 text-navy-700">
                {format(parseISO(nextAppointment.date), 'HH\'h\'mm', { locale: fr })}
              </span>
            </div>
            <div className="mt-4 grid sm:grid-cols-2 gap-2 text-sm">
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(nextAppointment.address)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-navy-700 hover:text-accent-600"
              >
                <MapPin className="w-4 h-4 shrink-0" />
                <span className="truncate">{nextAppointment.address}</span>
              </a>
              <a
                href={`tel:${nextAppointment.phone.replace(/\s/g, '')}`}
                className="flex items-center gap-2 text-navy-700 hover:text-accent-600"
              >
                <Phone className="w-4 h-4 shrink-0" />
                <span>{nextAppointment.phone}</span>
              </a>
            </div>
          </div>
        ) : (
          <EmptyCard label="Aucun rendez-vous à venir." />
        )}
      </section>

      {/* Tâches à venir */}
      <section>
        <SectionHeader title="Tâches en attente" linkTo="/tasks" linkLabel="Toutes les tâches" />
        {todoToday.length === 0 ? (
          <EmptyCard label="Tout est à jour, bravo !" />
        ) : (
          <div className="card divide-y divide-navy-100">
            {todoToday.slice(0, 4).map((t) => (
              <Link
                key={t.id}
                to="/tasks"
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-navy-50/50 transition first:rounded-t-2xl last:rounded-b-2xl"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    t.priority === 'high'
                      ? 'bg-accent-500'
                      : t.priority === 'medium'
                        ? 'bg-navy-400'
                        : 'bg-navy-200'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy-900 truncate">{t.title}</p>
                  <p className="text-xs text-navy-500">
                    {formatRelative(t.dueDate)}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-navy-300" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Boîte mail teaser */}
      <section>
        <SectionHeader title="Boîte de réception" linkTo="/inbox" linkLabel="Ouvrir Gmail" />
        <Link to="/inbox" className="card card-pad flex items-center gap-4 hover:shadow-card transition">
          <div className="w-12 h-12 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-navy-900">action.renovation67@gmail.com</p>
            <p className="text-sm text-navy-500">Synchronisé via Gmail API · 2 mails non lus</p>
          </div>
          <ChevronRight className="w-5 h-5 text-navy-300" />
        </Link>
      </section>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, tone, to }) {
  const tones = {
    navy: 'bg-navy-50 text-navy-700',
    accent: 'bg-accent-50 text-accent-700',
    danger: 'bg-red-50 text-red-600',
  }
  return (
    <Link
      to={to}
      className="card card-pad hover:shadow-card transition group"
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${tones[tone]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-navy-900 leading-none">{value}</p>
      <p className="text-xs text-navy-500 mt-1.5">{label}</p>
    </Link>
  )
}

function SectionHeader({ title, linkTo, linkLabel }) {
  return (
    <div className="flex items-baseline justify-between mb-3 px-1">
      <h2 className="text-sm font-semibold text-navy-900 uppercase tracking-wider">{title}</h2>
      {linkTo && (
        <Link to={linkTo} className="text-xs text-accent-600 hover:text-accent-700 font-medium">
          {linkLabel} →
        </Link>
      )}
    </div>
  )
}

function EmptyCard({ label }) {
  return (
    <div className="card card-pad text-center text-sm text-navy-500">
      {label}
    </div>
  )
}

function formatRelative(iso) {
  const d = parseISO(iso)
  const time = format(d, 'HH\'h\'mm', { locale: fr })
  if (isToday(d)) return `Aujourd'hui · ${time}`
  if (isTomorrow(d)) return `Demain · ${time}`
  return format(d, 'EEE d MMM · HH\'h\'mm', { locale: fr })
}
