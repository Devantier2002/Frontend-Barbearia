import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'https://backend-barbearia.vercel.app'

function getLocalISODate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getMonthKey(dateString) {
  return dateString.slice(0, 7)
}

function getDaysInMonth(dateString) {
  const [year, month] = dateString.split('-').map(Number)
  const totalDays = new Date(year, month, 0).getDate()

  return Array.from({ length: totalDays }, (_, index) => {
    const day = String(index + 1).padStart(2, '0')
    return `${dateString.slice(0, 7)}-${day}`
  })
}

async function fetchAppointmentsForMonth(month, signal) {
  const response = await fetch(`${API_URL}/api/appointments?month=${month}`, {
    signal,
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Falha ao carregar a agenda.')
  }

  return response.json()
}

async function loginWithServer(username, password) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.error || 'Usuario ou senha invalidos.')
  }

  return response.json()
}

async function validateSession(token) {
  const response = await fetch(`${API_URL}/api/auth/session`, {
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Sessao invalida.')
  }

  return response.json()
}

async function logoutSession(token) {
  await fetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

function App() {
  const today = getLocalISODate()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [selectedDate, setSelectedDate] = useState(today)
  const [appointments, setAppointments] = useState([])
  const [formData, setFormData] = useState({
    client: '',
    time: '08:00',
    note: '',
  })
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')

  useEffect(() => {
    validateSession('cookie-session')
      .then(() => {
        setIsAuthenticated(true)
      })
      .catch(() => {
        setIsAuthenticated(false)
      })
      .finally(() => {
        setAuthLoading(false)
      })
  }, [])

  const monthKey = getMonthKey(selectedDate)

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined
    }

    const controller = new AbortController()

    async function loadAppointments() {
      setLoading(true)
      setApiError('')

      try {
        const nextAppointments = await fetchAppointmentsForMonth(monthKey, controller.signal)
        setAppointments(nextAppointments)
      } catch (error) {
        if (error.name !== 'AbortError') {
          setApiError('Nao foi possivel carregar a agenda do servidor.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadAppointments()

    return () => controller.abort()
  }, [isAuthenticated, monthKey])

  const dayAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) => appointment.date === selectedDate)
        .slice()
        .sort((first, second) => first.time.localeCompare(second.time)),
    [appointments, selectedDate],
  )

  const monthAppointments = useMemo(
    () => appointments.filter((appointment) => getMonthKey(appointment.date) === monthKey),
    [appointments, monthKey],
  )

  const monthDays = useMemo(() => getDaysInMonth(selectedDate), [selectedDate])

  const monthSummary = useMemo(() => {
    const total = monthAppointments.length
    const done = monthAppointments.filter((appointment) => appointment.done).length
    const pending = total - done

    return { total, done, pending }
  }, [monthAppointments])

  const dayTotals = useMemo(() => {
    return monthAppointments.reduce((accumulator, appointment) => {
      accumulator[appointment.date] = (accumulator[appointment.date] || 0) + 1
      return accumulator
    }, {})
  }, [monthAppointments])

  const handleLoginChange = (event) => {
    const { name, value } = event.target
    setLoginForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleLoginSubmit = (event) => {
    event.preventDefault()

    const username = loginForm.username.trim().toLowerCase()
    const password = loginForm.password

    loginWithServer(username, password)
      .then(() => {
        setIsAuthenticated(true)
        setLoginError('')
        setLoginForm({ username: '', password: '' })
      })
      .catch((error) => {
        setLoginError(error.message)
      })
  }

  const handleLogout = () => {
    logoutSession('cookie-session').catch(() => null)
    setIsAuthenticated(false)
    setApiError('')
    setLoginError('')
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!formData.client.trim()) {
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          date: selectedDate,
          client: formData.client.trim(),
          time: formData.time,
          note: formData.note.trim() || 'Atendimento',
        }),
      })

      if (!response.ok) {
        throw new Error('Falha ao salvar o agendamento.')
      }

      const createdAppointment = await response.json()
      setAppointments((current) => [createdAppointment, ...current])
      setFormData({
        client: '',
        time: '08:00',
        note: '',
      })
      setApiError('')
    } catch {
      setApiError('Nao foi possivel salvar o agendamento.')
    }
  }

  const toggleDone = async (appointment) => {
    try {
      const response = await fetch(`${API_URL}/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ done: !appointment.done }),
      })

      if (!response.ok) {
        throw new Error('Falha ao atualizar o agendamento.')
      }

      const updatedAppointment = await response.json()
      setAppointments((current) =>
        current.map((item) => (item.id === updatedAppointment.id ? updatedAppointment : item)),
      )
      setApiError('')
    } catch {
      setApiError('Nao foi possivel atualizar o agendamento.')
    }
  }

  const removeAppointment = async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/appointments/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok && response.status !== 204) {
        throw new Error('Falha ao excluir o agendamento.')
      }

      setAppointments((current) => current.filter((appointment) => appointment.id !== id))
      setApiError('')
    } catch {
      setApiError('Nao foi possivel excluir o agendamento.')
    }
  }

  if (authLoading) {
    return (
      <main className="app-shell auth-shell">
        <section className="auth-card">
          <p className="auth-note">Verificando sessao...</p>
        </section>
      </main>
    )
  }

  if (!isAuthenticated) {
    return (
      <main className="app-shell auth-shell">
        <section className="auth-card">
          <div>
            <p className="eyebrow">Acesso restrito</p>
            <h1>Entrada do barbeiro</h1>
            <p className="description">
              Use o acesso simples para abrir a agenda do dia e o dashboard do mês.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <label>
              Usuário
              <input
                type="text"
                name="username"
                value={loginForm.username}
                onChange={handleLoginChange}
                autoComplete="username"
                placeholder="barbeiro"
              />
            </label>

            <label>
              Senha
              <input
                type="password"
                name="password"
                value={loginForm.password}
                onChange={handleLoginChange}
                autoComplete="current-password"
                placeholder="1234"
              />
            </label>

            {loginError ? <p className="auth-error">{loginError}</p> : null}

            <button type="submit">Entrar</button>
          </form>

          <p className="auth-note">
            Acessos padrão: <strong>barbeiro</strong> / <strong>1234</strong> e{' '}
            <strong>ismael</strong> / <strong>1234</strong>
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <section className="header-card">
        <div>
          <p className="eyebrow">Agenda do barbeiro</p>
          <h1>Horários do dia com visão do mês</h1>
          <p className="description">
            Agenda organizada por dia e com uma dashboard mensal para acompanhar o
            movimento da barbearia.
          </p>
        </div>

        <div className="header-actions">
          <label className="date-picker">
            Dia
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>

          <button type="button" className="logout-button" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </section>

      {apiError ? <p className="api-error">{apiError}</p> : null}

      <section className="layout-grid">
        <form className="panel form-card" onSubmit={handleSubmit}>
          <h2>Novo horário</h2>
          <p className="form-hint">O atendimento será salvo no dia selecionado.</p>

          <label>
            Cliente
            <input
              type="text"
              name="client"
              value={formData.client}
              onChange={handleChange}
              placeholder="Nome do cliente"
            />
          </label>

          <div className="two-columns">
            <label>
              Horário
              <input type="time" name="time" value={formData.time} onChange={handleChange} />
            </label>

            <label>
              Serviço
              <input
                type="text"
                name="note"
                value={formData.note}
                onChange={handleChange}
                placeholder="Corte, barba, sobrancelha..."
              />
            </label>
          </div>

          <button type="submit">Adicionar horário</button>
        </form>

        <section className="panel agenda-card">
          <div className="agenda-title">
            <div>
              <p className="eyebrow">Dia selecionado</p>
              <h2>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString('pt-BR')}</h2>
            </div>
            <span>{dayAppointments.length} horários</span>
          </div>

          {loading ? (
            <p className="empty-state">Carregando agenda...</p>
          ) : dayAppointments.length === 0 ? (
            <p className="empty-state">Nenhum horário cadastrado para esse dia.</p>
          ) : (
            <ul className="appointment-list">
              {dayAppointments.map((appointment) => (
                <li
                  key={appointment.id}
                  className={`appointment-item${appointment.done ? ' done' : ''}`}
                >
                  <div className="time-block">{appointment.time}</div>

                  <div className="appointment-content">
                    <strong>{appointment.client}</strong>
                    <p>{appointment.note}</p>
                  </div>

                  <div className="appointment-actions">
                    <button type="button" onClick={() => toggleDone(appointment)}>
                      {appointment.done ? 'Desmarcar' : 'Feito'}
                    </button>
                    <button type="button" onClick={() => removeAppointment(appointment.id)}>
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>

      <section className="panel month-card">
        <div className="agenda-title">
          <div>
            <p className="eyebrow">Mês</p>
            <h2>Dashboard mensal</h2>
          </div>
          <span>{monthSummary.total} atendimentos</span>
        </div>

        <div className="month-stats">
          <article>
            <strong>{monthSummary.total}</strong>
            <span>Total no mês</span>
          </article>
          <article>
            <strong>{monthSummary.done}</strong>
            <span>Concluídos</span>
          </article>
          <article>
            <strong>{monthSummary.pending}</strong>
            <span>Pendentes</span>
          </article>
        </div>

        <div className="month-grid">
          {monthDays.map((day) => {
            const count = dayTotals[day] || 0
            const isSelected = day === selectedDate

            return (
              <button
                key={day}
                type="button"
                className={`month-day${isSelected ? ' selected' : ''}${count ? ' has-items' : ''}`}
                onClick={() => setSelectedDate(day)}
              >
                <strong>{String(new Date(`${day}T00:00:00`).getDate()).padStart(2, '0')}</strong>
                <span>{count ? `${count} horário(s)` : 'vazio'}</span>
              </button>
            )
          })}
        </div>
      </section>
    </main>
  )
}

export default App
