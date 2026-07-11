import { useState } from 'react';
import { ArrowLeft, MapPin, Phone, Mail, Check, MessageSquare, Calendar, DollarSign, Wrench } from 'lucide-react';
import { leads, auditors, stageLabels, type LeadStage, type NoteEntry } from './mockData';

interface LeadCardProps {
  leadId: number | null;
  onBack: () => void;
}

const stageColors: Record<LeadStage, { bg: string; color: string; border: string }> = {
  1: { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  2: { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
  3: { bg: '#FEFCE8', color: '#854D0E', border: '#FDE68A' },
  4: { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' },
  5: { bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' },
};

export function LeadCard({ leadId, onBack }: LeadCardProps) {
  const lead = leads.find(l => l.id === leadId) ?? leads[0];
  const [currentStage, setCurrentStage] = useState<LeadStage>(lead.stage);
  const [newNote, setNewNote] = useState('');
  const [notesList, setNotesList] = useState<NoteEntry[]>(lead.notes);
  const [finalAmount, setFinalAmount] = useState(lead.estimatedAmount?.toString() ?? '');
  const [installDate, setInstallDate] = useState(lead.installationDate ?? '');
  const [selectedAuditorId, setSelectedAuditorId] = useState<number | null>(lead.auditor?.id ?? null);
  const [selectedTeam, setSelectedTeam] = useState(lead.team ?? '');

  const stages: LeadStage[] = [1, 2, 3, 4, 5];
  const stageStyle = stageColors[currentStage];

  const addNote = () => {
    if (!newNote.trim()) return;
    setNotesList(prev => [...prev, {
      id: Date.now(),
      text: newNote.trim(),
      author: 'Adam Kaczmarek',
      date: new Date().toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      type: 'note',
    }]);
    setNewNote('');
  };

  return (
    <div style={{ padding: 28 }}>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 20 }}
      >
        <ArrowLeft style={{ width: 15, height: 15 }} />
        Powrót do listy
      </button>

      {/* Header card */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F0F0F0', padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <span style={{ fontSize: 40, fontWeight: 700, color: '#E5E7EB', lineHeight: 1 }}>#{lead.id}</span>
            <div>
              <h1 style={{ color: '#111827', margin: '0 0 4px' }}>{lead.client.firstName} {lead.client.lastName}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9CA3AF', fontSize: 13 }}>
                <MapPin style={{ width: 13, height: 13 }} />
                <span>{lead.city}</span>
                <span style={{ color: '#E5E7EB' }}>·</span>
                <span>Wpłynął: {lead.dateReceived}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>Status:</span>
            <select
              value={currentStage}
              onChange={e => setCurrentStage(Number(e.target.value) as LeadStage)}
              style={{
                padding: '8px 12px',
                background: stageStyle.bg,
                border: `1px solid ${stageStyle.border}`,
                borderRadius: 10,
                fontSize: 13,
                color: stageStyle.color,
                fontWeight: 500,
                cursor: 'pointer',
                outline: 'none',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {stages.map(s => (
                <option key={s} value={s}>{s}. {stageLabels[s]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {stages.map((s, idx) => {
            const done = s < currentStage;
            const active = s === currentStage;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <button
                  onClick={() => setCurrentStage(s)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, flex: 1 }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600,
                    background: done || active ? '#2563EB' : '#F3F4F6',
                    color: done || active ? '#fff' : '#9CA3AF',
                    border: `2px solid ${done || active ? '#2563EB' : '#E5E7EB'}`,
                    transition: 'all 0.2s',
                  }}>
                    {done ? <Check style={{ width: 13, height: 13 }} /> : s}
                  </div>
                  <span style={{ fontSize: 12, color: active ? '#2563EB' : done ? '#9CA3AF' : '#9CA3AF', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }}>
                    {stageLabels[s]}
                  </span>
                </button>
                {idx < stages.length - 1 && (
                  <div style={{ height: 2, flex: 1, background: done ? '#93C5FD' : '#E5E7EB', margin: '0 8px', transition: 'background 0.2s' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        {/* Left: Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Contact */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F0F0F0', padding: 20 }}>
            <h3 style={{ color: '#111827', margin: '0 0 16px' }}>Dane kontaktowe</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <InfoItem icon={Phone} label="Telefon" value={lead.client.phone} />
              <InfoItem icon={Mail} label="Email" value={lead.client.email} />
              <InfoItem icon={MapPin} label="Miasto" value={lead.city} />
            </div>
          </div>

          {/* Triage results */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F0F0F0', padding: 20 }}>
            <h3 style={{ color: '#111827', margin: '0 0 12px' }}>Wyniki z formularza</h3>
            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 }}>{lead.triageResult}</p>
            {lead.equipment && lead.equipment !== '–' && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F9FAFB' }}>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wybrany sprzęt</p>
                <p style={{ fontSize: 13, color: '#1D4ED8', fontWeight: 500, margin: 0 }}>{lead.equipment}</p>
              </div>
            )}
          </div>
        </div>

        {/* Middle: Management */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F0F0F0', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ color: '#111827', margin: 0 }}>Zarządzanie</h3>

          <FieldGroup label="Przypisany audytor" icon={<div style={{ width: 16, height: 16, borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>A</span></div>}>
            <select
              value={selectedAuditorId ?? ''}
              onChange={e => setSelectedAuditorId(e.target.value ? Number(e.target.value) : null)}
              style={selectStyle}
            >
              <option value="">Wybierz audytora...</option>
              {auditors.filter(a => a.role === 'Audytor').map(a => (
                <option key={a.id} value={a.id}>{a.name} – {a.activeAssignments} aktywnych</option>
              ))}
            </select>
          </FieldGroup>

          <FieldGroup label="Ekipa montażowa" icon={<Wrench style={{ width: 13, height: 13, color: '#9CA3AF' }} />}>
            <select
              value={selectedTeam}
              onChange={e => setSelectedTeam(e.target.value)}
              style={selectStyle}
            >
              <option value="">Wybierz ekipę...</option>
              <option>Ekipa Czerwona</option>
              <option>Ekipa Niebieska</option>
              <option>Ekipa Zielona</option>
            </select>
          </FieldGroup>

          <FieldGroup label="Data instalacji" icon={<Calendar style={{ width: 13, height: 13, color: '#9CA3AF' }} />}>
            <input
              type="date"
              value={installDate}
              onChange={e => setInstallDate(e.target.value)}
              style={selectStyle}
            />
          </FieldGroup>

          <FieldGroup label="Finalna kwota" icon={<DollarSign style={{ width: 13, height: 13, color: '#9CA3AF' }} />}>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                value={finalAmount}
                onChange={e => setFinalAmount(e.target.value)}
                placeholder="0"
                style={{ ...selectStyle, paddingRight: 40 }}
              />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#9CA3AF' }}>PLN</span>
            </div>
          </FieldGroup>

          <button style={{ padding: '10px', background: '#2563EB', border: 'none', borderRadius: 10, fontSize: 13, color: '#fff', fontWeight: 500, cursor: 'pointer', marginTop: 4 }}>
            Zapisz zmiany
          </button>
        </div>

        {/* Right: Timeline */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F0F0F0', padding: 20, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ color: '#111827', margin: '0 0 16px' }}>Historia i notatki</h3>

          {/* Add note */}
          <div style={{ marginBottom: 20 }}>
            <textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Dodaj notatkę wewnętrzną..."
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: 10,
                fontSize: 13,
                color: '#374151',
                fontFamily: 'Inter, sans-serif',
                resize: 'none',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.background = '#fff'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#F9FAFB'; }}
            />
            <button
              onClick={addNote}
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '7px 12px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, fontSize: 12, color: '#2563EB', cursor: 'pointer', fontWeight: 500 }}
            >
              <MessageSquare style={{ width: 13, height: 13 }} />
              Dodaj notatkę
            </button>
          </div>

          {/* Timeline */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {notesList.length === 0 && (
              <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '16px 0' }}>Brak wpisów</p>
            )}
            {notesList.map((note, idx) => (
              <div key={note.id} style={{ display: 'flex', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: note.type === 'status_change' ? '#EFF6FF' : '#F3F4F6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {note.type === 'status_change'
                      ? <Check style={{ width: 13, height: 13, color: '#2563EB' }} />
                      : <MessageSquare style={{ width: 13, height: 13, color: '#9CA3AF' }} />
                    }
                  </div>
                  {idx < notesList.length - 1 && (
                    <div style={{ width: 1, flex: 1, background: '#F0F0F0', margin: '4px 0' }} />
                  )}
                </div>
                <div style={{ paddingBottom: idx < notesList.length - 1 ? 16 : 0, minWidth: 0 }}>
                  {note.type === 'status_change' ? (
                    <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
                      Status: <strong style={{ color: '#374151' }}>{note.oldStatus}</strong>
                      {' → '}
                      <strong style={{ color: '#2563EB' }}>{note.newStatus}</strong>
                    </p>
                  ) : (
                    <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.5 }}>{note.text}</p>
                  )}
                  <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{note.author} · {note.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #F0F0F0' }}>
        <Icon style={{ width: 14, height: 14, color: '#9CA3AF' }} />
      </div>
      <div>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
        <p style={{ fontSize: 13, color: '#374151', margin: '2px 0 0' }}>{value}</p>
      </div>
    </div>
  );
}

function FieldGroup({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        {icon}
        <label style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>{label}</label>
      </div>
      {children}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  background: '#F9FAFB',
  border: '1px solid #E5E7EB',
  borderRadius: 10,
  fontSize: 13,
  color: '#374151',
  outline: 'none',
  fontFamily: 'Inter, sans-serif',
  boxSizing: 'border-box',
};
