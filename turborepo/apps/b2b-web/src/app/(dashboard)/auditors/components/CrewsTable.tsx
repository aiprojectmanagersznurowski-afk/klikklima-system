import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';

export function CrewsTable({ crews, onEdit, onDelete }: { crews: any[], onEdit: (c: any) => void, onDelete: (id: string) => void }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden font-sans">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ekipa</th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kontakt</th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Logistyka</th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kwalifikacje</th>
              <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Akcje</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {crews.map((crew) => (
              <tr key={crew.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{crew.nazwa}</div>
                  <div className="text-sm text-gray-500">NIP: {crew.nip || "-"}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{crew.koordynator_imie_nazwisko || "-"}</div>
                  <div className="text-sm text-gray-500">{crew.telefon_kontaktowy || "-"}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{crew.kod_pocztowy_bazowy || "-"}</div>
                  <div className="text-sm text-gray-500">{crew.promien_dzialania_km ? `do ${crew.promien_dzialania_km}km` : "-"}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap space-y-1">
                  {crew.certyfikat_fgaz && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mr-2">
                      F-GAZ
                    </span>
                  )}
                  {crew.uprawnienia_sep && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                      SEP
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-3">
                    <button onClick={() => onEdit(crew)} className="text-gray-400 hover:text-blue-600 transition-colors p-1" title="Edytuj">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDelete(crew.id)} className="text-gray-400 hover:text-red-600 transition-colors p-1" title="Usuń">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            
            {crews.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-sm">
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
