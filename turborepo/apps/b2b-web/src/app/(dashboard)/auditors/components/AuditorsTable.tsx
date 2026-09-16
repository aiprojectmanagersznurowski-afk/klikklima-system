import React from 'react';
import { Edit2, Trash2, Phone } from 'lucide-react';

export function AuditorsTable({ auditors, onEdit, onDelete }: { auditors: any[], onEdit: (a: any) => void, onDelete: (id: string) => void }) {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden font-sans shadow-xs">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-secondary/50 border-b border-border">
            <tr>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Audytor
              </th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Firma
              </th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Kontakt
              </th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Certyfikat F-GAZ
              </th>
              <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Akcje
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {auditors.map((auditor) => (
              <tr key={auditor.id} className="hover:bg-secondary/30 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      {auditor.avatarUrl ? (
                        <img className="h-10 w-10 rounded-full object-cover" src={auditor.avatarUrl} alt={auditor.imie_i_nazwisko} />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center border border-border">
                          <span className="text-primary font-semibold text-sm">
                            {(auditor.imie_i_nazwisko || "").split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-foreground">{auditor.imie_i_nazwisko}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-foreground font-medium">{auditor.nazwa_firmy || "-"}</div>
                  <div className="text-sm text-muted-foreground">NIP: {auditor.nip || "-"}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-foreground truncate max-w-[200px]" title={auditor.email || undefined}>
                    {auditor.email || "-"}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    {auditor.telefon || "-"}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                    {auditor.certyfikat_fgaz || "-"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-3">
                    <button onClick={() => onEdit(auditor)} className="text-muted-foreground hover:text-primary transition-colors p-1 cursor-pointer" title="Edytuj">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDelete(auditor.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1 cursor-pointer" title="Usuń">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            
            {auditors.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground text-sm">
                  Brak wyników. Spróbuj zmienić parametry wyszukiwania lub dodaj pierwszego audytora.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
