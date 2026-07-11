import { ReactNode, useState } from 'react';
import {
  LayoutDashboard, Users, UserCheck, Wrench, Bell, Search,
  LogOut, ChevronLeft, ChevronRight, Thermometer, X,
} from 'lucide-react';
import type { Page } from '../App';

interface LayoutProps {
  children: ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems = [
  { id: 'dashboard' as Page, label: 'Pulpit', icon: LayoutDashboard },
  { id: 'leads' as Page, label: 'Leady', icon: Users },
  { id: 'customers' as Page, label: 'Klienci', icon: UserCheck },
  { id: 'team' as Page, label: 'Audytorzy i Ekipy', icon: Wrench },
  { id: 'notifications' as Page, label: 'Centrum Powiadomień', icon: Bell },
];

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const isActive = (id: Page) =>
    currentPage === id || (currentPage === 'lead-card' && id === 'leads');

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F9FAFB' }}>
      {/* Sidebar */}
      <aside
        style={{ width: collapsed ? 64 : 232, transition: 'width 0.25s ease', background: '#fff', borderRight: '1px solid #F0F0F0' }}
        className="flex flex-col shrink-0"
      >
        {/* Logo */}
        <div
          style={{ padding: collapsed ? '20px 0' : '20px 16px', borderBottom: '1px solid #F0F0F0' }}
          className="flex items-center gap-2.5"
        >
          <div
            className="flex items-center justify-center shrink-0 rounded-xl"
            style={{ width: 32, height: 32, background: '#2563EB' }}
          >
            <Thermometer style={{ width: 16, height: 16, color: '#fff' }} />
          </div>
          {!collapsed && (
            <div>
              <span style={{ color: '#1D4ED8', fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em' }}>
                KlikKlima
              </span>
              <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>Panel administracyjny</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.id);
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: collapsed ? '10px 0' : '10px 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  background: active ? '#EFF6FF' : 'transparent',
                  color: active ? '#2563EB' : '#6B7280',
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  width: '100%',
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = '#F9FAFB'; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <Icon style={{ width: 16, height: 16, color: active ? '#2563EB' : '#9CA3AF', flexShrink: 0 }} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="px-2 pb-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: collapsed ? '8px 0' : '8px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: '#9CA3AF',
              fontSize: 12,
              width: '100%',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F9FAFB'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            {collapsed
              ? <ChevronRight style={{ width: 14, height: 14 }} />
              : <><ChevronLeft style={{ width: 14, height: 14 }} /><span>Zwiń panel</span></>
            }
          </button>
        </div>

        {/* User */}
        <div style={{ borderTop: '1px solid #F0F0F0', padding: 12 }}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 500 }}>
                AK
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 2 }}>
                <LogOut style={{ width: 14, height: 14 }} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 500, flexShrink: 0 }}>
                AK
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Adam Kaczmarek</p>
                <p style={{ fontSize: 11, color: '#9CA3AF' }}>Manager Sprzedaży</p>
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4, flexShrink: 0, borderRadius: 6 }}>
                <LogOut style={{ width: 14, height: 14 }} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Right panel */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header style={{ background: '#fff', borderBottom: '1px solid #F0F0F0', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <div style={{ flex: 1, maxWidth: 420, position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#9CA3AF' }} />
            <input
              type="text"
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              placeholder="Szukaj klientów, leadów, numerów..."
              style={{
                width: '100%',
                paddingLeft: 36,
                paddingRight: searchValue ? 36 : 12,
                paddingTop: 8,
                paddingBottom: 8,
                background: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: 10,
                fontSize: 13,
                color: '#374151',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchValue && (
              <button
                onClick={() => setSearchValue('')}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 2 }}
              >
                <X style={{ width: 13, height: 13 }} />
              </button>
            )}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              style={{ position: 'relative', padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', borderRadius: 8 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F9FAFB'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
            >
              <Bell style={{ width: 18, height: 18 }} />
              <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, background: '#EF4444', borderRadius: '50%', border: '1.5px solid #fff' }} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
