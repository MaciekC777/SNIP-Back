'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'

function CallbackContent() {
  const params = useSearchParams()
  const userId = params.get('user_id') ?? params.get('allegro_user_id')
  const login = params.get('user_login') ?? params.get('allegro_login')
  const message = params.get('message')
  const error = params.get('error') ?? params.get('detail')

  if (error) {
    return (
      <div className="bg-red-950 border border-red-800 rounded-lg p-6 space-y-3">
        <h2 className="font-bold text-red-400">Błąd logowania</h2>
        <p className="text-sm text-red-300">{error}</p>
        <Link href="/" className="inline-block text-sm text-gray-400 hover:text-white underline">
          Wróć
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-green-950 border border-green-800 rounded-lg p-6 space-y-4">
      <h2 className="font-bold text-green-400">Zalogowano pomyslnie!</h2>
      {message && <p className="text-sm text-gray-300">{message}</p>}
      {login && (
        <p className="text-sm">
          Login: <strong className="text-white">{login}</strong>
        </p>
      )}
      {userId && (
        <div className="bg-gray-900 rounded p-3 space-y-1">
          <p className="text-xs text-gray-400">Twoje Allegro User ID (skopiuj do zakładki Snipes):</p>
          <code className="text-orange-400 font-bold break-all">{userId}</code>
        </div>
      )}
      <p className="text-xs text-gray-500">Wszystkie parametry z callbacku:</p>
      <pre className="text-xs text-gray-400 bg-gray-900 rounded p-3 overflow-auto">
        {JSON.stringify(Object.fromEntries(params.entries()), null, 2)}
      </pre>
      <Link href="/" className="inline-block text-sm text-gray-400 hover:text-white underline">
        Wróć do testu
      </Link>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <div className="max-w-xl mx-auto p-6 sm:p-10">
      <h1 className="text-xl font-bold mb-6">
        <span className="text-orange-500">Last</span>Bid — Callback
      </h1>
      <Suspense fallback={<p className="text-gray-400">Ładowanie...</p>}>
        <CallbackContent />
      </Suspense>
    </div>
  )
}
