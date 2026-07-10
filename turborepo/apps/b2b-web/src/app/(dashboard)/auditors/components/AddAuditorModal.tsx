"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AddAuditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (formData: FormData) => Promise<boolean>;
  initialData?: any;
}

export function AddAuditorModal({ open, onOpenChange, onSave, initialData }: AddAuditorModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    companyName: '',
    nip: '',
    fgazCert: ''
  });

  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
          name: initialData.imie_i_nazwisko || '',
          phone: initialData.telefon || '',
          email: initialData.email || '',
          address: initialData.adres || '',
          companyName: initialData.nazwa_firmy || '',
          nip: initialData.nip || '',
          fgazCert: initialData.certyfikat_fgaz || ''
        });
        setPhotoPreview(initialData.avatarUrl || null);
      } else {
        setFormData({
          name: '',
          phone: '',
          email: '',
          address: '',
          companyName: '',
          nip: '',
          fgazCert: ''
        });
        setPhotoPreview(null);
      }
    }
  }, [open, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      data.append(key, value);
    });
    
    // If photo preview is a base64 string (new photo uploaded)
    if (photoPreview && photoPreview.startsWith('data:image')) {
      data.append('photoBase64', photoPreview);
    }
    
    const success = await onSave(data);
    setIsSubmitting(false);
    if (success) {
      onOpenChange(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div 
        className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" 
        onClick={() => onOpenChange(false)}
      />
      
      <div className="relative z-50 w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">
            {initialData ? "Edytuj audytora" : "Dodaj nowego audytora"}
          </h2>
          <button 
            onClick={() => onOpenChange(false)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 max-h-[80vh] overflow-y-auto">
          <div className="flex flex-col items-center mb-8">
            <div 
              className="relative group cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-20 h-20 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden group-hover:border-blue-400 transition-colors relative">
                {photoPreview ? (
                  <>
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                  </>
                ) : (
                  <Camera className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
                )}
              </div>
              <div className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700 text-center">
                Wgraj zdjęcie profilowe
              </div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileChange}
            />
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
            <button 
              type="button" 
              onClick={() => onOpenChange(false)}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Anuluj
            </button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm"
            >
              {isSubmitting ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
