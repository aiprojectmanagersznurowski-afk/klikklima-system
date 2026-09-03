"use client"
import React, { useState } from "react"
import { Plus, X, Trash2 } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/format-date"
import { addAuthorizedUser, deleteAuthorizedUser } from "./actions"
import { DeleteJustificationDialog } from "@/components/delete-justification-dialog"

type User = {
  id: string
  email: string
  role: string
  createdAt: Date
}

export function SettingsClient({ users }: { users: User[] }) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteDialogUserId, setDeleteDialogUserId] = useState<string | null>(null);

  const handleAddUser = async () => {
    setError("");
    if (!email) {
      setError("Podaj adres email.");
      return;
    }
    setLoading(true);
    const result = await addAuthorizedUser(email, "admin");
    setLoading(false);
    
    if (result.success) {
      setShowInviteModal(false);
      setEmail("");
    } else {
      setError(result.error || "Wystąpił błąd");
    }
  };

  const handleDeleteUser = (id: string) => {
    setDeleteDialogUserId(id);
  };

  const getInitials = (email: string) => email.substring(0, 2).toUpperCase();

  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in duration-300">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Ustawienia platformy</h1>
      
      <div className="flex gap-8 items-start">
        <div className="w-64 shrink-0 space-y-1 hidden md:block">
          {["Ogólne", "Zarządzanie Dostępem", "Integracje (Stripe)"].map((item, i) => (
            <button key={item} className={cn(
              "w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
              i === 1 ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            )}>
              {item}
            </button>
          ))}
        </div>

        <Card className="flex-1">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white rounded-t-xl">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Konta Pracowników</h2>
              <p className="text-sm text-gray-500">Zarządzaj dostępem do platformy KlikKlima B2B.</p>
            </div>
            <Button onClick={() => setShowInviteModal(true)} className="gap-2"><Plus size={16}/> Dodaj pracownika</Button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 font-medium">Użytkownik</th>
                  <th className="px-6 py-3 font-medium">Rola</th>
                  <th className="px-6 py-3 font-medium">Data dodania</th>
                  <th className="px-6 py-3 font-medium text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(user => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">{getInitials(user.email)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-gray-900">{user.email.split('@')[0]}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200" variant="outline">
                        Administrator
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatDate(user.createdAt, "d MMMM yyyy")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteUser(user.id)}>
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      Brak dodanych użytkowników.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in px-4">
          <Card className="w-full max-w-md shadow-2xl scale-in-95 duration-200">
            <CardHeader className="flex flex-row justify-between items-start border-b border-gray-100 pb-4">
              <div>
                <CardTitle className="text-lg">Zaproś pracownika</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Dodaj nowy adres email z uprawnieniami administratora.</p>
              </div>
              <button onClick={() => { setShowInviteModal(false); setError(""); setEmail(""); }} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100">
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Email pracownika</label>
                <input 
                  type="email" 
                  placeholder="jan@klikklima.pl" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Rola w systemie</label>
                <select disabled className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed">
                  <option>Administrator</option>
                </select>
                <p className="text-xs text-gray-500">Obecnie wszystkie nowe konta otrzymują pełen dostęp administracyjny.</p>
              </div>
            </CardContent>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
              <Button variant="outline" onClick={() => { setShowInviteModal(false); setError(""); setEmail(""); }} disabled={loading}>Anuluj</Button>
              <Button onClick={handleAddUser} disabled={loading}>{loading ? "Dodawanie..." : "Dodaj dostęp"}</Button>
            </div>
          </Card>
        </div>
      )}

      {deleteDialogUserId && (
        <DeleteJustificationDialog
          title="Usuń dostęp pracownika"
          description="Czy na pewno chcesz usunąć dostęp temu użytkownikowi? Ta operacja jest nieodwracalna."
          onConfirm={(values) => deleteAuthorizedUser(deleteDialogUserId, values)}
          onClose={() => setDeleteDialogUserId(null)}
          onSuccess={() => {
            setDeleteDialogUserId(null);
          }}
        />
      )}
    </div>
  );
}
