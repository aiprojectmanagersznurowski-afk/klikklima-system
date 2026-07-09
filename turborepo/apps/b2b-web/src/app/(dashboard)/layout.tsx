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
          <a href="/" className="block p-2 hover:bg-blue-800 rounded">Dashboard</a>
          <a href="/kanban" className="block p-2 hover:bg-blue-800 rounded">Kanban Dyspozytora</a>
          <a href="/logistics" className="block p-2 hover:bg-blue-800 rounded">Logistyka</a>
        </nav>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
