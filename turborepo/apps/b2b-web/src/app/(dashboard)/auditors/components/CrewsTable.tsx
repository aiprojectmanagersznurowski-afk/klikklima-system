import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { EMPTY_VALUE } from '@/lib/empty-value';

export function CrewsTable({ crews, onEdit, onDelete }: { crews: any[], onEdit: (c: any) => void, onDelete: (id: string) => void }) {
  return (
    <div className="bg-card rounded-2xl shadow-xs border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-left">
          <thead className="bg-secondary/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <tr>
              <th scope="col" className="p-3.5 px-6">Ekipa</th>
              <th scope="col" className="p-3.5 px-6">Kontakt</th>
              <th scope="col" className="p-3.5 px-6">Logistyka</th>
              <th scope="col" className="p-3.5 px-6">Kwalifikacje</th>
              <th scope="col" className="p-3.5 px-6 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {crews.map((crew) => (
              <tr key={crew.id} className="hover:bg-secondary/30 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-foreground">{crew.nazwa}</div>
                  <div className="text-xs font-mono text-muted-foreground mt-0.5">NIP: {crew.nip || EMPTY_VALUE}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-foreground">{crew.koordynator_imie_nazwisko || EMPTY_VALUE}</div>
                  <div className="text-xs font-mono text-muted-foreground mt-0.5">{crew.telefon_kontaktowy || EMPTY_VALUE}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-mono font-medium text-foreground">{crew.kod_pocztowy_bazowy || EMPTY_VALUE}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{crew.promien_dzialania_km ? `do ${crew.promien_dzialania_km}km` : EMPTY_VALUE}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap space-x-2">
                  {crew.certyfikat_fgaz && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                      F-GAZ
                    </span>
                  )}
                  {crew.uprawnienia_sep && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent/10 text-accent border border-accent/20">
                      SEP
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    <button onClick={() => onEdit(crew)} className="size-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-secondary transition-colors" title="Edytuj">
                      <Edit2 className="size-4" />
                    </button>
                    <button onClick={() => onDelete(crew.id)} className="size-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Usuń">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            
            {crews.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground text-sm">
                  Brak przypisanych ekip. Dodaj nową ekipę.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
