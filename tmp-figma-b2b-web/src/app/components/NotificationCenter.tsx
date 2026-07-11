import { useState } from 'react';
import { MessageSquare, Mail, AlertCircle, CheckCircle, Clock, RefreshCw, Filter } from 'lucide-react';
import { notificationLogs, type NotificationLog } from './mockData';

type StatusFilter = 'all' | 'Wysłano' | 'Błąd' | 'Oczekuje';

export function NotificationCenter() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filtered = statusFilter === 'all'
    ? notificationLogs
    : notificationLogs.filter(l => l.status === statusFilter);

  const errors = notificationLogs.filter(l => l.status === 'Błąd').length;
  const sent = notificationLogs.filter(l => l.status === 'Wysłano').length;
  const pending = notificationLogs.filter(l => l.status === 'Oczekuje').length;

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: '#111827', margin: 0 }}>Centrum Powiadomień</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Logi automatycznych wysyłek SMS i Email</p>
        </div>
        {errors > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: 12 }}>
            <AlertCircle style={{ width: 16, height: 16, color: '#EF4444' }} />
            <span style={{ fontSize: 13, color: '#B91C1C', fontWeight: 500 }}>
              {errors} {errors === 1 ? 'błąd wysyłki' : 'błędy wysyłki'} – wymagają interwencji
            </span>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        <NotifStat label="Wysłane pomyślnie" value={sent} bg="#ECFDF5" color="#059669" icon={CheckCircle} />
        <NotifStat label="Błędy wysyłki" value={errors} bg="#FEF2F2" color="#EF4444" icon={AlertCircle} urgent={errors > 0} />
        <NotifStat label="Oczekujące" value={pending} bg="#FFFBEB" color="#D97706" icon={Clock} />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6B7280', fontSize: 13 }}>
          <Filter style={{ width: 14, height: 14 }} />
          <span>Status:</span>
        </div>
        {(['all', 'Wysłano', 'Błąd', 'Oczekuje'] as StatusFilter[]).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: `1px solid ${statusFilter === s ? '#2563EB' : '#E5E7EB'}`,
              background: statusFilter === s ? '#EFF6FF' : '#fff',
              color: statusFilter === s ? '#2563EB' : '#6B7280',
              fontSize: 13,
              fontWeight: statusFilter === s ? 500 : 400,
              cursor: 'pointer',
            }}
          >
            {s === 'all' ? 'Wszystkie' : s}
            {s !== 'all' && (
              <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>
                ({notificationLogs.filter(l => l.status === s).length})
              </span>
            )}
          </button>
        ))}
        <button style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12, color: '#6B7280', cursor: 'pointer' }}>
          <RefreshCw style={{ width: 13, height: 13 }} />
          Odśwież
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F0F0F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F0F0F0' }}>
              {['Data i godzina', 'Kanał', 'Odbiorca', 'Treść wiadomości', 'Status'].map(col => (
                <th key={col} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((log, idx) => (
              <NotifRow key={log.id} log={log} isLast={idx === filtered.length - 1} />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                  Brak wyników dla wybranego filtra
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Error highlight box */}
      {errors > 0 && statusFilter !== 'Wysłano' && statusFilter !== 'Oczekuje' && (
        <div style={{ marginTop: 16, padding: '16px 20px', background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <AlertCircle style={{ width: 16, height: 16, color: '#EF4444', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#B91C1C' }}>Wykryto błędy wysyłki</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#EF4444' }}>
                Sprawdź wiadomości oznaczone jako "Błąd". Mogą wymagać ręcznego wysłania lub weryfikacji danych odbiorcy.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NotifRow({ log, isLast }: { log: NotificationLog; isLast: boolean }) {
  const [hovered, setHovered] = useState(false);

  const statusConfig = {
    'Wysłano': { bg: '#ECFDF5', color: '#059669', icon: CheckCircle },
    'Błąd': { bg: '#FEE2E2', color: '#B91C1C', icon: AlertCircle },
    'Oczekuje': { bg: '#FFFBEB', color: '#92400E', icon: Clock },
  } as const;

  const s = statusConfig[log.status];
  const Icon = s.icon;

  return (
    <tr
      style={{
        borderBottom: isLast ? 'none' : '1px solid #F9FAFB',
        background: log.status === 'Błąd' ? (hovered ? '#FEF2F2' : '#FFF5F5') : (hovered ? '#F9FAFB' : '#fff'),
        transition: 'background 0.1s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td style={{ padding: '13px 20px', fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>{log.date}</td>
      <td style={{ padding: '13px 20px' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 500,
          background: log.channel === 'SMS' ? '#EFF6FF' : '#F5F3FF',
          color: log.channel === 'SMS' ? '#2563EB' : '#6D28D9',
        }}>
          {log.channel === 'SMS'
            ? <MessageSquare style={{ width: 11, height: 11 }} />
            : <Mail style={{ width: 11, height: 11 }} />
          }
          {log.channel}
        </span>
      </td>
      <td style={{ padding: '13px 20px', fontSize: 13, color: '#374151', fontWeight: 500 }}>{log.recipient}</td>
      <td style={{ padding: '13px 20px', maxWidth: 320 }}>
        <p style={{ fontSize: 13, color: '#6B7280', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {log.content}
        </p>
      </td>
      <td style={{ padding: '13px 20px' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 12px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 500,
          background: s.bg,
          color: s.color,
        }}>
          <Icon style={{ width: 12, height: 12 }} />
          {log.status}
        </span>
        {log.status === 'Błąd' && (
          <button style={{ marginLeft: 8, fontSize: 11, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Wyślij ponownie
          </button>
        )}
      </td>
    </tr>
  );
}

function NotifStat({ label, value, bg, color, icon: Icon, urgent }: {
  label: string; value: number; bg: string; color: string; icon: React.ElementType; urgent?: boolean;
}) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      border: `1px solid ${urgent ? '#FEE2E2' : '#F0F0F0'}`,
      padding: '18px 22px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon style={{ width: 18, height: 18, color }} />
      </div>
      <div>
        <p style={{ fontSize: 24, fontWeight: 700, color: urgent ? '#EF4444' : '#111827', margin: 0, letterSpacing: '-0.02em' }}>{value}</p>
        <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>{label}</p>
      </div>
    </div>
  );
}
