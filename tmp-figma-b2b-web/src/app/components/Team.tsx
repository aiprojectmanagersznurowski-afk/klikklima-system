import { useState } from 'react';
import { Clock, Calendar, MoreHorizontal, X, Plus, CheckCircle } from 'lucide-react';
import { auditors, type Auditor } from './mockData';

export function Team() {
  const teamAuditors = auditors.filter(a => a.role === 'Audytor');
  const teamMonters = auditors.filter(a => a.role === 'Monter');
  const [scheduleModal, setScheduleModal] = useState<Auditor | null>(null);

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: '#111827', margin: 0 }}>Audytorzy i Ekipy Montażowe</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Zarządzanie zasobami ludzkimi</p>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          <Plus style={{ width: 15, height: 15 }} />
          Dodaj pracownika
        </button>
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <SummaryCard label="Łącznie pracowników" value={auditors.length.toString()} color="#2563EB" bg="#EFF6FF" />
        <SummaryCard label="Audytorzy" value={teamAuditors.length.toString()} color="#7C3AED" bg="#F5F3FF" />
        <SummaryCard label="Monterzy" value={teamMonters.length.toString()} color="#059669" bg="#ECFDF5" />
        <SummaryCard label="Aktywnych przypisań" value={auditors.reduce((s, a) => s + a.activeAssignments, 0).toString()} color="#D97706" bg="#FFFBEB" />
      </div>

      {/* Auditors section */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h2 style={{ color: '#374151', margin: 0 }}>Audytorzy</h2>
          <span style={{ padding: '2px 10px', background: '#EFF6FF', color: '#2563EB', borderRadius: 20, fontSize: 12, fontWeight: 500 }}>
            {teamAuditors.length}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {teamAuditors.map(p => (
            <PersonCard key={p.id} person={p} onSchedule={() => setScheduleModal(p)} />
          ))}
        </div>
      </section>

      {/* Installers section */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h2 style={{ color: '#374151', margin: 0 }}>Ekipy Montażowe</h2>
          <span style={{ padding: '2px 10px', background: '#ECFDF5', color: '#059669', borderRadius: 20, fontSize: 12, fontWeight: 500 }}>
            {teamMonters.length}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {teamMonters.map(p => (
            <PersonCard key={p.id} person={p} onSchedule={() => setScheduleModal(p)} />
          ))}
        </div>
      </section>

      {/* Schedule modal */}
      {scheduleModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => setScheduleModal(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, padding: 28, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: scheduleModal.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 600 }}>
                  {scheduleModal.initials}
                </div>
                <div>
                  <h3 style={{ margin: 0, color: '#111827' }}>{scheduleModal.name}</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>{scheduleModal.role}</p>
                </div>
              </div>
              <button onClick={() => setScheduleModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, marginBottom: 6, display: 'block' }}>
                  Aktywne przypisania ({scheduleModal.activeAssignments})
                </label>
                <div style={{ padding: '12px 14px', background: '#F9FAFB', borderRadius: 10, border: '1px solid #E5E7EB' }}>
                  <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>
                    {scheduleModal.activeAssignments} aktywnych leadów / zleceń
                  </p>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, marginBottom: 6, display: 'block' }}>
                  Dostępność w tym tygodniu
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                  {['Pon', 'Wt', 'Śr', 'Czw', 'Pt'].map((day, i) => (
                    <div key={day} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: i < 3 ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${i < 3 ? '#A7F3D0' : '#FEE2E2'}` }}>
                      <p style={{ margin: 0, fontSize: 10, color: i < 3 ? '#065F46' : '#B91C1C', fontWeight: 500 }}>{day}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 10, color: i < 3 ? '#059669' : '#EF4444' }}>{i < 3 ? 'Dostępny' : 'Zajęty'}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setScheduleModal(null)} style={{ flex: 1, padding: '10px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                  Zamknij
                </button>
                <button onClick={() => setScheduleModal(null)} style={{ flex: 1, padding: '10px', background: '#2563EB', border: 'none', borderRadius: 10, fontSize: 13, color: '#fff', fontWeight: 500, cursor: 'pointer' }}>
                  Edytuj harmonogram
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PersonCard({ person, onSchedule }: { person: Auditor; onSchedule: () => void }) {
  const [hovered, setHovered] = useState(false);

  const isAvailable = person.activeAssignments < 10;

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid #F0F0F0',
        padding: 20,
        transition: 'box-shadow 0.2s, transform 0.2s',
        boxShadow: hovered ? '0 4px 20px rgba(0,0,0,0.08)' : 'none',
        transform: hovered ? 'translateY(-2px)' : 'none',
        cursor: 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div
          style={{ width: 48, height: 48, borderRadius: '50%', background: person.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 600 }}
        >
          {person.initials}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: isAvailable ? '#10B981' : '#F59E0B' }} />
          <span style={{ fontSize: 11, color: isAvailable ? '#059669' : '#D97706' }}>{isAvailable ? 'Dostępny' : 'Zajęty'}</span>
        </div>
      </div>

      <h4 style={{ margin: '0 0 2px', color: '#111827' }}>{person.name}</h4>
      <span style={{
        display: 'inline-flex',
        padding: '2px 8px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 500,
        background: person.role === 'Audytor' ? '#EFF6FF' : '#ECFDF5',
        color: person.role === 'Audytor' ? '#2563EB' : '#059669',
      }}>
        {person.role}
      </span>

      {/* Stats */}
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #F9FAFB', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle style={{ width: 12, height: 12, color: '#9CA3AF' }} />
            Aktywnych przypisań
          </span>
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: person.activeAssignments > 8 ? '#EF4444' : person.activeAssignments > 5 ? '#D97706' : '#059669',
          }}>
            {person.activeAssignments}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#9CA3AF' }}>
          <Clock style={{ width: 11, height: 11 }} />
          <span>Ostatnie logowanie: {person.lastLogin}</span>
        </div>
      </div>

      {/* Action */}
      <button
        onClick={onSchedule}
        style={{
          marginTop: 14,
          width: '100%',
          padding: '8px',
          background: hovered ? '#EFF6FF' : '#F9FAFB',
          border: `1px solid ${hovered ? '#BFDBFE' : '#E5E7EB'}`,
          borderRadius: 10,
          fontSize: 12,
          color: hovered ? '#2563EB' : '#6B7280',
          cursor: 'pointer',
          transition: 'all 0.15s',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <Calendar style={{ width: 13, height: 13 }} />
        Edytuj harmonogram
      </button>
    </div>
  );
}

function SummaryCard({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F0F0F0', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 20, fontWeight: 700, color }}>{value}</span>
      </div>
      <p style={{ fontSize: 13, color: '#6B7280', margin: 0, lineHeight: 1.4 }}>{label}</p>
    </div>
  );
}
