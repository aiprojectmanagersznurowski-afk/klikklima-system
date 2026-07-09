import Link from 'next/link'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-slate-100">
      <aside className="w-64 bg-blue-900 text-white p-4">
        <h1 className="text-2xl font-bold mb-8">Klik Klima B2B</h1>
        <nav className="space-y-2">
          <Link href="/" className="block p-2 hover:bg-blue-800 rounded">Dashboard</Link>
          <Link href="/kanban" className="block p-2 hover:bg-blue-800 rounded">Kanban Dyspozytora</Link>
          <Link href="/logistics" className="block p-2 hover:bg-blue-800 rounded">Logistyka</Link>
          <Link href="/clients" className="block p-2 hover:bg-blue-800 rounded">Klienci</Link>
          <Link href="/installations" className="block p-2 hover:bg-blue-800 rounded">Instalacje</Link>
          <Link href="/services" className="block p-2 hover:bg-blue-800 rounded">Serwisy</Link>
        </nav>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
