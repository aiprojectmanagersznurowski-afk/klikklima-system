import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';

export function AuditorsTable({ auditors, onEdit, onDelete }: { auditors: any[], onEdit: (a: any) => void, onDelete: (id: string) => void }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden font-['Inter']">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Audytor
              </th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Firma
              </th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Kontakt
              </th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Certyfikat F-GAZ
              </th>
              <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Akcje
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {auditors.map((auditor) => (
              <tr key={auditor.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      {auditor.avatarUrl ? (
                        <img className="h-10 w-10 rounded-full object-cover" src={auditor.avatarUrl} alt={auditor.imie_i_nazwisko} />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-blue-600 font-semibold text-sm">
                            {(auditor.imie_i_nazwisko || "").split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{auditor.imie_i_nazwisko}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 font-medium">{auditor.nazwa_firmy || "-"}</div>
                  <div className="text-sm text-gray-500">NIP: {auditor.nip || "-"}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{auditor.email || "-"}</div>
                  <div className="text-sm text-gray-500">{auditor.telefon || "-"}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                    {auditor.certyfikat_fgaz || "-"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-3">
                    <button onClick={() => onEdit(auditor)} className="text-gray-400 hover:text-blue-600 transition-colors p-1" title="Edytuj">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDelete(auditor.id)} className="text-gray-400 hover:text-red-600 transition-colors p-1" title="Usuń">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            
            {auditors.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-sm">
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
