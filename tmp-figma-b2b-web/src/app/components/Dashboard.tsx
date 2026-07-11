import { TrendingUp, Clock, DollarSign, Calendar, ArrowRight, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { leads } from './mockData';
import type { Page } from '../App';

interface DashboardProps {
  onNavigate: (page: Page) => void;
}

const funnelData = [
  { name: 'Nowe leady', value: 18, color: '#93C5FD' },
  { name: 'Oczekuje audyt', value: 12, color: '#60A5FA' },
  { name: 'Wycena', value: 8, color: '#3B82F6' },
  { name: 'Do instalacji', value: 5, color: '#2563EB' },
  { name: 'Zakończone', value: 3, color: '#1D4ED8' },
];

export function Dashboard({ onNavigate }: DashboardProps) {
  const actionItems = leads.filter(l => (l.daysInStage >= 2 && l.stage !== 5) || !l.auditor);

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: '#111827', margin: 0 }}>Pulpit</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Piątek, 11 lipca 2026 · Dzień dobry, Adam!</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard
          label="Nowe zapytania dzisiaj"
          value="4"
          icon={TrendingUp}
          iconBg="#EFF6FF"
          iconColor="#2563EB"
          change="+2 vs wczoraj"
          changeColor="#6B7280"
        />
        <StatCard
          label="Leady bez audytora"
          value="3"
          icon={AlertCircle}
          iconBg="#FEF2F2"
          iconColor="#EF4444"
          change="Wymaga pilnej akcji!"
          changeColor="#EF4444"
          urgent
        />
        <StatCard
          label="Suma wycen oczekujących"
          value="128 500 zł"
          icon={DollarSign}
          iconBg="#ECFDF5"
          iconColor="#059669"
          change="5 wycen do akceptacji"
          changeColor="#6B7280"
        />
        <StatCard
          label="Instalacje w tym tygodniu"
          value="7"
          icon={Calendar}
          iconBg="#F5F3FF"
          iconColor="#7C3AED"
          change="3 ukończone · 4 zaplanowane"
          changeColor="#6B7280"
        />
      </div>

      {/* Charts + actions row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Funnel chart */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F0F0F0', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ color: '#111827', margin: 0 }}>Lejek sprzedażowy</h2>
              <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Liczba leadów w każdym etapie</p>
            </div>
            <button
              onClick={() => onNavigate('leads')}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Zobacz leady <ArrowRight style={{ width: 12, height: 12 }} />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={funnelData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
                width={118}
              />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                cursor={{ fill: '#F9FAFB' }}
                formatter={(v) => [`${v} leadów`, 'Liczba']}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={28}>
                {funnelData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Action required */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F0F0F0', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ color: '#111827', margin: 0 }}>Wymaga Twojej akcji</h2>
              <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Leady wymagające interwencji</p>
            </div>
            <button
              onClick={() => onNavigate('leads')}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Wszystkie <ArrowRight style={{ width: 12, height: 12 }} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {actionItems.slice(0, 5).map(lead => (
              <div
                key={lead.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 14px',
                  background: !lead.auditor ? '#FEF2F2' : '#FFFBEB',
                  borderRadius: 10,
                  border: `1px solid ${!lead.auditor ? '#FEE2E2' : '#FDE68A'}`,
                  cursor: 'pointer',
                }}
              >
                <AlertCircle style={{ width: 15, height: 15, color: !lead.auditor ? '#EF4444' : '#D97706', flexShrink: 0, marginTop: 1 }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', margin: 0 }}>
                    #{lead.id} – {lead.client.firstName} {lead.client.lastName}
                  </p>
                  <p style={{ fontSize: 12, color: !lead.auditor ? '#EF4444' : '#B45309', marginTop: 3 }}>
                    {!lead.auditor ? 'Brak przypisanego audytora' : `${lead.daysInStage} dni bez zmiany statusu`}
                    {' · '}{lead.city}
                  </p>
                </div>
              </div>
            ))}
            {actionItems.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF', fontSize: 13 }}>
                Wszystko w porządku! Brak zaległości.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16 }}>
        <MiniStatCard label="Łączna wartość lejka" value="245 800 zł" sub="Wszystkie aktywne leady" />
        <MiniStatCard label="Średni czas do instalacji" value="12 dni" sub="Ostatnie 30 dni" />
        <MiniStatCard label="Konwersja lead → instalacja" value="38%" sub="Ostatnie 30 dni" />
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  change: string;
  changeColor: string;
  urgent?: boolean;
}

function StatCard({ label, value, icon: Icon, iconBg, iconColor, change, changeColor, urgent }: StatCardProps) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      border: `1px solid ${urgent ? '#FEE2E2' : '#F0F0F0'}`,
      padding: '20px 22px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: '#6B7280', margin: 0, lineHeight: 1.4, maxWidth: 120 }}>{label}</p>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon style={{ width: 16, height: 16, color: iconColor }} />
        </div>
      </div>
      <p style={{ fontSize: 26, fontWeight: 600, color: urgent ? '#EF4444' : '#111827', margin: 0, letterSpacing: '-0.02em' }}>{value}</p>
      <p style={{ fontSize: 12, color: changeColor, marginTop: 6 }}>{change}</p>
    </div>
  );
}

function MiniStatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F0F0F0', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>{label}</p>
        <p style={{ fontSize: 22, fontWeight: 600, color: '#111827', margin: '4px 0 2px', letterSpacing: '-0.02em' }}>{value}</p>
        <p style={{ fontSize: 11, color: '#9CA3AF' }}>{sub}</p>
      </div>
      <Clock style={{ width: 28, height: 28, color: '#E5E7EB' }} />
    </div>
  );
}
