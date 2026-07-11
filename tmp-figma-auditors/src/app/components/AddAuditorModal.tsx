import React, { useState } from 'react';
import { X, Camera } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

interface AddAuditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function AddAuditorModal({ open, onOpenChange, onSave }: AddAuditorModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    companyName: '',
    nip: '',
    fgazCert: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave();
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] bg-white rounded-2xl shadow-2xl p-0 font-['Inter'] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] overflow-hidden">
          
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <Dialog.Title className="text-xl font-semibold text-gray-900">
              Dodaj nowego audytora
            </Dialog.Title>
            <Dialog.Close className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors focus:outline-none">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="flex flex-col items-center mb-8">
              <div className="relative group cursor-pointer">
                <div className="w-20 h-20 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden group-hover:border-blue-400 transition-colors">
                  <Camera className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
                </div>
                <div className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700 text-center">
                  Wgraj zdjęcie profilowe
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-sm font-medium text-gray-700">Imię i nazwisko <span className="text-red-500">*</span></label>
                <input
                  id="name"
                  name="name"
                  required
                  type="text"
                  placeholder="np. Jan Kowalski"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-shadow placeholder:text-gray-400"
                />
              </div>
              
              <div className="space-y-1.5">
                <label htmlFor="phone" className="text-sm font-medium text-gray-700">Telefon</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+48 000 000 000"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-shadow placeholder:text-gray-400"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-gray-700">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="jan@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-shadow placeholder:text-gray-400"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="address" className="text-sm font-medium text-gray-700">Adres / Miasto</label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  placeholder="np. Warszawa, ul. Główna 1"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-shadow placeholder:text-gray-400"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="companyName" className="text-sm font-medium text-gray-700">Nazwa firmy</label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  placeholder="Wpisz nazwę firmy"
                  value={formData.companyName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-shadow placeholder:text-gray-400"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="nip" className="text-sm font-medium text-gray-700">NIP</label>
                <input
                  id="nip"
                  name="nip"
                  type="text"
                  placeholder="000-000-00-00"
                  value={formData.nip}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-shadow placeholder:text-gray-400"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="fgazCert" className="text-sm font-medium text-gray-700">Nr certyfikatu F-GAZ</label>
                <input
                  id="fgazCert"
                  name="fgazCert"
                  type="text"
                  placeholder="np. FGAZ/1234/2024"
                  value={formData.fgazCert}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-shadow placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end space-x-3 pt-6 border-t border-gray-100">
              <Dialog.Close asChild>
                <button type="button" className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                  Anuluj
                </button>
              </Dialog.Close>
              <button type="submit" className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm">
                Zapisz
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
