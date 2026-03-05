'use client'

import { useState, useEffect, useCallback } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? ''

type Tab = 'auth' | 'snipes' | 'health'

interface Snipe {
  id: string
  allegro_offer_url: string
  offer_title?: string
  offer_image_url?: string
  current_price?: number
  max_bid_amount: number
  status: string
  result_message?: string
  executed_at?: string
  offer_end_time?: string
  created_at: string
}

interface HealthData {
  status: string
  environment: string
  ntp_synced: boolean
  ntp_offset_ms?: number
  active_snipes: number
  scheduler_running: boolean
}

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    waiting: 'bg-yellow-800 text-yellow-200',
    active: 'bg-blue-800 text-blue-200',
    executing: 'bg-purple-800 text-purple-200',
    won: 'bg-green-800 text-green-200',
    lost: 'bg-red-800 text-red-200',
    error: 'bg-red-900 text-red-300',
    cancelled: 'bg-gray-700 text-gray-300',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${colors[status] ?? 'bg-gray-700 text-gray-300'}`}>
      {status}
    </span>
  )
}

// ─── Auth Tab ────────────────────────────────────────────────────────────────

function AuthTab() {
  const loginUrl = `${API}/auth/login`

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-bold">Logowanie przez Allegro OAuth2</h2>
        <p className="text-gray-400 text-sm">
          Kliknij przycisk, aby zalogować się przez Allegro. Po zalogowaniu zostaniesz
          przekierowany na <code className="text-green-400">/callback</code>, gdzie zobaczysz
          swoje <code className="text-green-400">allegro_user_id</code>.
        </p>
        <a
          href={loginUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block bg-orange-600 hover:bg-orange-500 text-white px-5 py-2.5 rounded-lg font-bold transition-colors"
        >
          Zaloguj przez Allegro
        </a>
        <p className="text-gray-500 text-xs">URL: {loginUrl}</p>
      </div>

      <div className="bg-gray-900 rounded-lg p-6 space-y-3">
        <h3 className="font-bold text-sm text-gray-300">Jak testować?</h3>
        <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
          <li>Kliknij &quot;Zaloguj przez Allegro&quot; — otworzy się w nowej karcie</li>
          <li>Zaloguj się i autoryzuj aplikację</li>
          <li>Skopiuj <code className="text-green-400">allegro_user_id</code> z odpowiedzi callbacku</li>
          <li>Wklej go w zakładce <strong>Snipes</strong> do pola User ID</li>
        </ol>
      </div>
    </div>
  )
}

// ─── Snipes Tab ───────────────────────────────────────────────────────────────

function SnipesTab() {
  const [userId, setUserId] = useState('')
  const [url, setUrl] = useState('')
  const [maxBid, setMaxBid] = useState('')
  const [snipes, setSnipes] = useState<Snipe[]>([])
  const [loading, setLoading] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchSnipes = useCallback(async () => {
    if (!userId.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/snipes?user_id=${encodeURIComponent(userId.trim())}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSnipes(await res.json())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [userId])

  const addSnipe = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch(`${API}/snipes?user_id=${encodeURIComponent(userId.trim())}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allegro_offer_url: url.trim(),
          max_bid_amount: parseFloat(maxBid),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? `HTTP ${res.status}`)
      setSuccess(`Snipe dodany! ID: ${data.id}`)
      setUrl('')
      setMaxBid('')
      fetchSnipes()
    } catch (e) {
      setError(String(e))
    } finally {
      setAddLoading(false)
    }
  }

  const cancelSnipe = async (snipeId: string) => {
    setError('')
    try {
      const res = await fetch(
        `${API}/snipes/${snipeId}/cancel?user_id=${encodeURIComponent(userId.trim())}`,
        { method: 'POST' }
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail ?? `HTTP ${res.status}`)
      }
      fetchSnipes()
    } catch (e) {
      setError(String(e))
    }
  }

  const deleteSnipe = async (snipeId: string) => {
    setError('')
    try {
      const res = await fetch(
        `${API}/snipes/${snipeId}?user_id=${encodeURIComponent(userId.trim())}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail ?? `HTTP ${res.status}`)
      }
      fetchSnipes()
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div className="space-y-6">
      {/* User ID input */}
      <div className="bg-gray-900 rounded-lg p-5 flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">Allegro User ID</label>
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
            placeholder="np. 12345678"
            value={userId}
            onChange={e => setUserId(e.target.value)}
          />
        </div>
        <button
          onClick={fetchSnipes}
          disabled={!userId.trim() || loading}
          className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 px-4 py-2 rounded text-sm transition-colors"
        >
          {loading ? 'Ładowanie...' : 'Pobierz snipe\'y'}
        </button>
      </div>

      {/* Add snipe form */}
      <form onSubmit={addSnipe} className="bg-gray-900 rounded-lg p-5 space-y-4">
        <h2 className="font-bold">Dodaj snipe</h2>
        <div>
          <label className="block text-xs text-gray-400 mb-1">URL aukcji Allegro</label>
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
            placeholder="https://allegro.pl/oferta/nazwa-produktu-12345678"
            value={url}
            onChange={e => setUrl(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Maks. kwota (PLN)</label>
          <input
            className="w-48 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="100.00"
            value={maxBid}
            onChange={e => setMaxBid(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">{success}</p>}
        <button
          type="submit"
          disabled={!userId.trim() || addLoading}
          className="bg-orange-600 hover:bg-orange-500 disabled:opacity-40 px-5 py-2 rounded font-bold transition-colors"
        >
          {addLoading ? 'Dodawanie...' : 'Dodaj snipe'}
        </button>
      </form>

      {/* Snipe list */}
      {snipes.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-bold text-sm text-gray-300">Snipe&apos;y ({snipes.length})</h2>
          {snipes.map(s => (
            <div key={s.id} className="bg-gray-900 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-3">
                {s.offer_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.offer_image_url} alt="" className="w-14 h-14 object-cover rounded shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={s.status} />
                    <span className="text-sm font-semibold truncate">
                      {s.offer_title ?? s.allegro_offer_url}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 space-x-3">
                    <span>Maks: <strong className="text-white">{s.max_bid_amount} zł</strong></span>
                    {s.current_price != null && (
                      <span>Cena: <strong className="text-white">{s.current_price} zł</strong></span>
                    )}
                    {s.offer_end_time && (
                      <span>Koniec: {new Date(s.offer_end_time).toLocaleString('pl-PL')}</span>
                    )}
                  </div>
                  {s.result_message && (
                    <p className="text-xs text-gray-500 mt-1 truncate">{s.result_message}</p>
                  )}
                  {s.executed_at && (
                    <p className="text-xs text-gray-500">
                      Wykonano: {new Date(s.executed_at).toLocaleString('pl-PL')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {(s.status === 'waiting' || s.status === 'active') && (
                    <button
                      onClick={() => cancelSnipe(s.id)}
                      className="text-xs bg-yellow-800 hover:bg-yellow-700 px-2 py-1 rounded transition-colors"
                    >
                      Anuluj
                    </button>
                  )}
                  {(s.status === 'cancelled' || s.status === 'error' || s.status === 'won' || s.status === 'lost') && (
                    <button
                      onClick={() => deleteSnipe(s.id)}
                      className="text-xs bg-red-900 hover:bg-red-800 px-2 py-1 rounded transition-colors"
                    >
                      Usuń
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-600">{s.id}</p>
            </div>
          ))}
        </div>
      )}

      {snipes.length === 0 && userId && !loading && (
        <p className="text-gray-500 text-sm text-center py-8">Brak snipe&apos;ów dla tego użytkownika.</p>
      )}
    </div>
  )
}

// ─── Health Tab ───────────────────────────────────────────────────────────────

function HealthTab() {
  const [data, setData] = useState<HealthData | null>(null)
  const [raw, setRaw] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchHealth = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/health`)
      const json = await res.json()
      setData(json)
      setRaw(JSON.stringify(json, null, 2))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchHealth() }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Status backendu</h2>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-40 px-3 py-1.5 rounded transition-colors"
        >
          {loading ? 'Ładowanie...' : 'Odśwież'}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: 'Status', value: data.status, ok: data.status === 'ok' },
            { label: 'Środowisko', value: data.environment },
            { label: 'NTP sync', value: data.ntp_synced ? 'tak' : 'nie', ok: data.ntp_synced },
            { label: 'NTP offset', value: data.ntp_offset_ms != null ? `${data.ntp_offset_ms.toFixed(1)} ms` : 'N/A' },
            { label: 'Scheduler', value: data.scheduler_running ? 'działa' : 'zatrzymany', ok: data.scheduler_running },
            { label: 'Aktywne snipe\'y', value: String(data.active_snipes) },
          ].map(({ label, value, ok }) => (
            <div key={label} className="bg-gray-900 rounded-lg p-4">
              <p className="text-xs text-gray-400">{label}</p>
              <p className={`font-bold mt-1 ${ok === true ? 'text-green-400' : ok === false ? 'text-red-400' : 'text-white'}`}>
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {raw && (
        <div className="bg-gray-900 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-2">Raw JSON</p>
          <pre className="text-xs text-gray-300 overflow-auto">{raw}</pre>
        </div>
      )}
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [tab, setTab] = useState<Tab>('health')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'health', label: 'Health' },
    { id: 'auth', label: 'Auth' },
    { id: 'snipes', label: 'Snipes' },
  ]

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">
          <span className="text-orange-500">Last</span>Bid
          <span className="text-gray-500 text-sm ml-2 font-normal">test frontend</span>
        </h1>
        <p className="text-gray-500 text-xs mt-1">API: {API || '(ustaw NEXT_PUBLIC_API_URL)'}</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 p-1 rounded-lg">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'health' && <HealthTab />}
      {tab === 'auth' && <AuthTab />}
      {tab === 'snipes' && <SnipesTab />}
    </div>
  )
}
