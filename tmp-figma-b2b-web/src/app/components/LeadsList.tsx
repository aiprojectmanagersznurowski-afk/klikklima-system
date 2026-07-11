import { useState } from 'react';
import { ExternalLink, UserPlus, ChevronLeft, ChevronRight, Filter, Plus, X, Check } from 'lucide-react';
import { leads, auditors, stageLabels, type Lead, type LeadStage } from './mockData';

interface LeadsListProps {
  onOpenLead: (id: number) => void;
}

type StageFilter = 0 | LeadStage;

const stageBadge: Record<number, { bg: string; color: string; label: string }> = {
  1: { bg: '#EFF6FF', color: '#2563EB', label: 'Nowy lead' },
  2: { bg: '#FFF7ED', color: '#C2410C', label: 'Oczekuje na audyt' },
  3: { bg: '#FEFCE8', color: '#854D0E', label: 'Wycena' },
  4: { bg: '#F5F3FF', color: '#6D28D9', label: 'Do instalacji' },
  5: { bg: '#ECFDF5', color: '#065F46', label: 'Zakończone' },
};

export function LeadsList({ onOpenLead }: LeadsListProps) {
  const [stageFilter, setStageFilter] = useState<StageFilter>(0);
  const [page, setPage] = useState(1);
  const [assignModal, setAssignModal] = useState<number | null>(null);
  const [selectedAuditor, setSelectedAuditor] = useState<number | null>(null);
  const itemsPerPage = 6;

  const filtered = stageFilter === 0 ? leads : leads.filter(l => l.stage === stageFilter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paged = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: '#111827', margin: 0 }}>Leady</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>{filtered.length} leadów łącznie</p>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          <Plus style={{ width: 15, height: 15 }} />
          Nowy lead
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6B7280', fontSize: 13 }}>
          <Filter style={{ width: 14, height: 14 }} />
          <span>Etap lejka:</span>
        </div>
        <select
          value={stageFilter}
          onChange={e => { setStageFilter(Number(e.target.value) as StageFilter); setPage(1); }}
          style={{
            padding: '8px 12px',
            background: '#fff',
            border: '1px solid #E5E7EB',
            borderRadius: 10,
            fontSize: 13,
            color: '#374151',
            cursor: 'pointer',
            outline: 'none',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <option value={0}>Wszystkie etapy ({leads.length})</option>
          {([1, 2, 3, 4, 5] as LeadStage[]).map(s => (
            <option key={s} value={s}>{s}. {stageLabels[s]} ({leads.filter(l => l.stage === s).length})</option>
          ))}
        </select>

        {stageFilter !== 0 && (
          <button
            onClick={() => { setStageFilter(0); setPage(1); }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: '#F3F4F6', border: 'none', borderRadius: 8, fontSize: 12, color: '#6B7280', cursor: 'pointer' }}
          >
            <X style={{ width: 12, height: 12 }} /> Wyczyść filtr
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F0F0F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F0F0F0' }}>
              {['ID', 'Data wpłynięcia', 'Klient', 'Miasto', 'Etap', 'Audytor', 'Kwota est.', 'Akcje'].map(col => (
                <th key={col} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((lead, idx) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                isLast={idx === paged.length - 1}
                onOpen={() => onOpenLead(lead.id)}
                onAssign={() => { setAssignModal(lead.id); setSelectedAuditor(lead.auditor?.id ?? null); }}
              />
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                  Brak leadów dla wybranego etapu
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ borderTop: '1px solid #F0F0F0', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ padding: 6, background: 'none', border: 'none', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? '#D1D5DB' : '#6B7280', borderRadius: 6 }}
            >
              <ChevronLeft style={{ width: 16, height: 16 }} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: p === page ? 600 : 400,
                  background: p === page ? '#2563EB' : 'transparent',
                  color: p === page ? '#fff' : '#6B7280',
                }}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ padding: 6, background: 'none', border: 'none', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? '#D1D5DB' : '#6B7280', borderRadius: 6 }}
            >
              <ChevronRight style={{ width: 16, height: 16 }} />
            </button>
            <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 8 }}>
              Strona {page} z {totalPages} · {filtered.length} wyników
            </span>
          </div>
        )}
      </div>

      {/* Assign modal */}
      {assignModal !== null && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => setAssignModal(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, padding: 24, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#111827' }}>Przypisz audytora</h3>
              <button onClick={() => setAssignModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>Lead #{assignModal}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {auditors.filter(a => a.role === 'Audytor').map(a => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAuditor(a.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: `1px solid ${selectedAuditor === a.id ? '#2563EB' : '#E5E7EB'}`,
                    background: selectedAuditor === a.id ? '#EFF6FF' : '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 500, flexShrink: 0 }}>
                    {a.initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#111827' }}>{a.name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF' }}>{a.activeAssignments} aktywnych przypisań</p>
                  </div>
                  {selectedAuditor === a.id && <Check style={{ width: 16, height: 16, color: '#2563EB' }} />}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setAssignModal(null)}
                style={{ flex: 1, padding: '10px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 13, color: '#374151', cursor: 'pointer' }}
              >
                Anuluj
              </button>
              <button
                onClick={() => setAssignModal(null)}
                style={{ flex: 1, padding: '10px', background: '#2563EB', border: 'none', borderRadius: 10, fontSize: 13, color: '#fff', fontWeight: 500, cursor: 'pointer' }}
              >
                Zapisz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LeadRow({ lead, isLast, onOpen, onAssign }: { lead: Lead; isLast: boolean; onOpen: () => void; onAssign: () => void }) {
  const [hovered, setHovered] = useState(false);
  const badge = stageBadge[lead.stage];

  return (
    <tr
      style={{ borderBottom: isLast ? 'none' : '1px solid #F9FAFB', background: hovered ? '#F9FAFB' : '#fff', transition: 'background 0.1s' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td style={{ padding: '13px 16px' }}>
        <button
          onClick={onOpen}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#2563EB', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          #{lead.id}
          <ExternalLink style={{ width: 11, height: 11 }} />
        </button>
      </td>
      <td style={{ padding: '13px 16px', fontSize: 13, color: '#6B7280' }}>{lead.dateReceived}</td>
      <td style={{ padding: '13px 16px' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#111827' }}>{lead.client.firstName} {lead.client.lastName}</p>
        <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{lead.client.phone}</p>
      </td>
      <td style={{ padding: '13px 16px', fontSize: 13, color: '#6B7280' }}>{lead.city}</td>
      <td style={{ padding: '13px 16px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: badge.bg, color: badge.color }}>
          {badge.label}
        </span>
      </td>
      <td style={{ padding: '13px 16px' }}>
        {lead.auditor ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: lead.auditor.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
              {lead.auditor.initials}
            </div>
            <span style={{ fontSize: 13, color: '#374151' }}>{lead.auditor.name.split(' ')[0]}</span>
          </div>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: '#FEF2F2', color: '#B91C1C' }}>
            Nieprzypisany
          </span>
        )}
      </td>
      <td style={{ padding: '13px 16px', fontSize: 13, color: '#374151', fontWeight: lead.estimatedAmount ? 500 : 400 }}>
        {lead.estimatedAmount ? `${lead.estimatedAmount.toLocaleString('pl-PL')} zł` : <span style={{ color: '#D1D5DB' }}>–</span>}
      </td>
      <td style={{ padding: '13px 16px' }}>
        <button
          onClick={onAssign}
          title="Przypisz audytora"
          style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', borderRadius: 8, transition: 'color 0.1s, background 0.1s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#2563EB'; (e.currentTarget as HTMLButtonElement).style.background = '#EFF6FF'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF'; (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
        >
          <UserPlus style={{ width: 15, height: 15 }} />
        </button>
      </td>
    </tr>
  );
}
