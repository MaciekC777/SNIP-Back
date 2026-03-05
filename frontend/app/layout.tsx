import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LastBid — Test Frontend',
  description: 'Backend testing UI for LastBid sniper',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="bg-gray-950 text-gray-100 min-h-screen font-mono">{children}</body>
    </html>
  )
}
