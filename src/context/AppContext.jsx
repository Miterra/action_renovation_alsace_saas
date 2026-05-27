import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { repository, repoMode } from '../lib/repository'
import { loadJSON, saveJSON } from '../lib/storage'

const AppContext = createContext(null)

// Données de démonstration injectées la 1ʳᵉ fois en mode local.
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
]

function addDaysISO(offsetDays, hours, minutes) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  d.setHours(hours, minutes, 0, 0)
  return d.toISOString()
}

export function AppProvider({ children }) {
  const [appointments, setAppointments] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [notifEnabled, setNotifEnabled] = useState(() => loadJSON('notifEnabled', false))

  useEffect(() => saveJSON('notifEnabled', notifEnabled), [notifEnabled])

  // Seed local au premier lancement (mode démo uniquement)
  useEffect(() => {
    if (repoMode === 'local' && loadJSON('appointments', null) === null) {
      saveJSON('appointments', SEED_APPOINTMENTS)
      saveJSON('tasks', SEED_TASKS)
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const [a, t] = await Promise.all([
        repository.listAppointments(),
        repository.listTasks(),
      ])
      setAppointments(a)
      setTasks(t)
    } catch (e) {
      console.error('[App] refresh échoué :', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    if (repoMode === 'supabase') {
      const sub = repository.subscribeRealtime(() => refresh())
      return () => sub.unsubscribe()
    }
  }, [refresh])

  const api = useMemo(
    () => ({
      appointments,
      tasks,
      loading,
      mode: repoMode,
      notifEnabled,
      setNotifEnabled,

      addAppointment: async (payload) => {
        const created = await repository.createAppointment(payload)
        setAppointments((prev) => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)))
      },
      updateAppointment: async (id, patch) => {
        const next = await repository.updateAppointment(id, patch)
        setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...next } : a)))
      },
      deleteAppointment: async (id) => {
        await repository.deleteAppointment(id)
        setAppointments((prev) => prev.filter((a) => a.id !== id))
      },

      addTask: async (payload) => {
        const created = await repository.createTask(payload)
        setTasks((prev) => [created, ...prev])
      },
      toggleTask: async (id) => {
        const current = tasks.find((t) => t.id === id)
        if (!current) return
        const next = await repository.updateTask(id, { done: !current.done })
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...next } : t)))
      },
      updateTask: async (id, patch) => {
        const next = await repository.updateTask(id, patch)
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...next } : t)))
      },
      deleteTask: async (id) => {
        await repository.deleteTask(id)
        setTasks((prev) => prev.filter((t) => t.id !== id))
      },

      refresh,
    }),
    [appointments, tasks, loading, notifEnabled, refresh],
  )

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp doit être utilisé dans <AppProvider>')
  return ctx
}
