import { useState } from 'react';
import { Mail, Phone, Edit2, X, Search, Plus } from 'lucide-react';
import { customers, type Customer } from './mockData';

export function Customers() {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const filtered = customers.filter(c =>
    `${c.firstName} ${c.lastName} ${c.email} ${c.phone}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: '#111827', margin: 0 }}>Baza Klientów</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>{customers.length} kontaktów · CRM</p>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          <Plus style={{ width: 15, height: 15 }} />
          Dodaj klienta
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 360, marginBottom: 16 }}>
        <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#9CA3AF' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Szukaj klienta, emaila, telefonu..."
          style={{
            width: '100%',
            paddingLeft: 36,
            paddingRight: 12,
            paddingTop: 9,
            paddingBottom: 9,
            background: '#fff',
            border: '1px solid #E5E7EB',
            borderRadius: 10,
            fontSize: 13,
            color: '#374151',
            outline: 'none',
            fontFamily: 'Inter, sans-serif',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F0F0F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F0F0F0' }}>
              {['Klient', 'Dane kontaktowe', 'Liczba leadów', 'Całkowita wartość (LTV)', 'Akcje'].map(col => (
                <th key={col} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, idx) => (
              <CustomerRow
                key={c.id}
                customer={c}
                isLast={idx === filtered.length - 1}
                onEdit={() => setEditingId(c.id)}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                  Brak wyników dla "{search}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editingId !== null && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => setEditingId(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, padding: 28, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h3 style={{ margin: 0, color: '#111827' }}>Edytuj dane klienta</h3>
              <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            {(() => {
              const c = customers.find(x => x.id === editingId)!;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <EditField label="Imię" defaultValue={c.firstName} />
                  <EditField label="Nazwisko" defaultValue={c.lastName} />
                  <EditField label="Email" defaultValue={c.email} type="email" />
                  <EditField label="Telefon" defaultValue={c.phone} type="tel" />
                  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: '10px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                      Anuluj
                    </button>
                    <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: '10px', background: '#2563EB', border: 'none', borderRadius: 10, fontSize: 13, color: '#fff', fontWeight: 500, cursor: 'pointer' }}>
                      Zapisz
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerRow({ customer: c, isLast, onEdit }: { customer: Customer; isLast: boolean; onEdit: () => void }) {
  const [hovered, setHovered] = useState(false);
  const initials = `${c.firstName[0]}${c.lastName[0]}`;

  const avatarColors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6', '#F97316', '#6366F1'];
  const color = avatarColors[c.id % avatarColors.length];

  return (
    <tr
      style={{ borderBottom: isLast ? 'none' : '1px solid #F9FAFB', background: hovered ? '#F9FAFB' : '#fff', transition: 'background 0.1s' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#111827' }}>{c.firstName} {c.lastName}</p>
          </div>
        </div>
      </td>
      <td style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280' }}>
            <Mail style={{ width: 12, height: 12, color: '#9CA3AF' }} />{c.email}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280' }}>
            <Phone style={{ width: 12, height: 12, color: '#9CA3AF' }} />{c.phone}
          </span>
        </div>
      </td>
      <td style={{ padding: '14px 20px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: '#EFF6FF', color: '#2563EB', fontSize: 13, fontWeight: 600 }}>
          {c.leadsCount}
        </div>
      </td>
      <td style={{ padding: '14px 20px' }}>
        {c.ltv > 0
          ? <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{c.ltv.toLocaleString('pl-PL')} zł</span>
          : <span style={{ fontSize: 13, color: '#D1D5DB' }}>–</span>
        }
      </td>
      <td style={{ padding: '14px 20px' }}>
        <button
          onClick={onEdit}
          title="Edytuj dane"
          style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', borderRadius: 8 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#2563EB'; (e.currentTarget as HTMLButtonElement).style.background = '#EFF6FF'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF'; (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
        >
          <Edit2 style={{ width: 15, height: 15 }} />
        </button>
      </td>
    </tr>
  );
}

function EditField({ label, defaultValue, type = 'text' }: { label: string; defaultValue: string; type?: string }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, marginBottom: 4, display: 'block' }}>{label}</label>
      <input
        type={type}
        defaultValue={defaultValue}
        style={{ width: '100%', padding: '9px 12px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 13, color: '#374151', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }}
        onFocus={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.background = '#fff'; }}
        onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#F9FAFB'; }}
      />
    </div>
  );
}
