import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { loadJSON, saveJSON } from '../lib/storage'

const AppContext = createContext(null)

// Données d'exemple pour démarrer l'app la première fois.
const SEED_APPOINTMENTS = [
  {
    id: 'a1',
    clientName: 'Marie Dupont',
    address: '8 rue des Tonneliers, Strasbourg',
    phone: '06 12 34 56 78',
    date: addDaysISO(0, 9, 30),
    endDate: addDaysISO(0, 10, 30),
    notes: 'Visite cuisine — devis rénovation complète.',
  },
  {
    id: 'a2',
    clientName: 'Jean Müller',
    address: '12 rue de la Forêt, Strasbourg',
    phone: '06 98 76 54 32',
    date: addDaysISO(1, 14, 0),
    endDate: addDaysISO(1, 15, 0),
    notes: 'Métré salle de bain.',
  },
  {
    id: 'a3',
    clientName: 'Sophie Klein',
    address: '24 avenue de la Marseillaise, Strasbourg',
    phone: '07 11 22 33 44',
    date: addDaysISO(3, 11, 0),
    endDate: addDaysISO(3, 12, 0),
    notes: 'Présentation du devis final.',
  },
]

const SEED_TASKS = [
  {
    id: 't1',
    title: 'Envoyer devis Marie Dupont',
    description: 'Cuisine 18m² — préparer le PDF et envoyer par mail.',
    dueDate: addDaysISO(0, 17, 0),
    done: false,
    priority: 'high',
  },
  {
    id: 't2',
    title: 'Commander carrelage Klein',
    description: 'Castorama Pro — 12m², référence 4582.',
    dueDate: addDaysISO(1, 12, 0),
    done: false,
    priority: 'medium',
  },
  {
    id: 't3',
    title: 'Relancer fournisseur peinture',
    description: 'Demander délai de livraison pour chantier Müller.',
    dueDate: addDaysISO(-1, 16, 0),
    done: true,
    priority: 'low',
  },
]

function addDaysISO(offsetDays, hours, minutes) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  d.setHours(hours, minutes, 0, 0)
  return d.toISOString()
}

function uid() {
  return 'id-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function AppProvider({ children }) {
  const [appointments, setAppointments] = useState(() =>
    loadJSON('appointments', SEED_APPOINTMENTS),
  )
  const [tasks, setTasks] = useState(() => loadJSON('tasks', SEED_TASKS))
  const [notifEnabled, setNotifEnabled] = useState(() => loadJSON('notifEnabled', false))

  useEffect(() => saveJSON('appointments', appointments), [appointments])
  useEffect(() => saveJSON('tasks', tasks), [tasks])
  useEffect(() => saveJSON('notifEnabled', notifEnabled), [notifEnabled])

  const api = useMemo(
    () => ({
      appointments,
      tasks,
      notifEnabled,
      setNotifEnabled,

      addAppointment: (payload) =>
        setAppointments((prev) => [...prev, { id: uid(), ...payload }]),
      updateAppointment: (id, patch) =>
        setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a))),
      deleteAppointment: (id) =>
        setAppointments((prev) => prev.filter((a) => a.id !== id)),

      addTask: (payload) =>
        setTasks((prev) => [
          { id: uid(), done: false, priority: 'medium', ...payload },
          ...prev,
        ]),
      toggleTask: (id) =>
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))),
      updateTask: (id, patch) =>
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))),
      deleteTask: (id) => setTasks((prev) => prev.filter((t) => t.id !== id)),
    }),
    [appointments, tasks, notifEnabled],
  )

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp doit être utilisé dans <AppProvider>')
  return ctx
}
