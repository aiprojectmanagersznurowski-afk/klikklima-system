"use client";

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AddCrewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (formData: FormData) => Promise<boolean>;
  initialData?: any;
}

export function AddCrewModal({ open, onOpenChange, onSave, initialData }: AddCrewModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    nip: '',
    coordinator: '',
    fgazCert: '',
    sep: false,
    zipCode: '',
    radius: '',
    teamsCount: '1',
    drillingRig: false,
    iban: ''
  });

  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
          name: initialData.nazwa || '',
          phone: initialData.telefon_kontaktowy || '',
          email: initialData.email || '',
          nip: initialData.nip || '',
          coordinator: initialData.koordynator_imie_nazwisko || '',
          fgazCert: initialData.certyfikat_fgaz || '',
          sep: initialData.uprawnienia_sep || false,
          zipCode: initialData.kod_pocztowy_bazowy || '',
          radius: initialData.promien_dzialania_km?.toString() || '',
          teamsCount: initialData.liczba_brygad?.toString() || '1',
          drillingRig: initialData.posiada_wiertnice || false,
          iban: initialData.iban || ''
        });
      } else {
        setFormData({
          name: '',
          phone: '',
          email: '',
          nip: '',
          coordinator: '',
          fgazCert: '',
          sep: false,
          zipCode: '',
          radius: '',
          teamsCount: '1',
          drillingRig: false,
          iban: ''
        });
      }
    }
  }, [open, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      data.append(key, value.toString());
    });
    
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
      
      <div className="relative z-50 w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 font-sans">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">
            {initialData ? "Edytuj Ekipę" : "Dodaj Ekipę Monterską"}
          </h2>
          <button 
            onClick={() => onOpenChange(false)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 max-h-[80vh] overflow-y-auto">
          
          <h3 className="text-lg font-medium text-gray-900 mb-4">Biznes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Nazwa Ekipy <span className="text-red-500">*</span></label>
              <input required name="name" type="text" value={formData.name} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Koordynator (Imię i nazwisko)</label>
              <input name="coordinator" type="text" value={formData.coordinator} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">NIP</label>
              <input name="nip" type="text" value={formData.nip} onChange={handleChange} placeholder="000-000-00-00" className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Telefon</label>
              <input name="phone" type="tel" value={formData.phone} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <input name="email" type="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>

          <h3 className="text-lg font-medium text-gray-900 mb-4">Kwalifikacje</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Nr certyfikatu F-GAZ</label>
              <input name="fgazCert" type="text" value={formData.fgazCert} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="space-y-1.5 flex items-center mt-6">
              <input name="sep" type="checkbox" checked={formData.sep} onChange={handleChange} className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
              <label className="ml-2 block text-sm text-gray-900">Uprawnienia SEP do 1kV</label>
            </div>
          </div>

          <h3 className="text-lg font-medium text-gray-900 mb-4">Logistyka</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Bazowy kod pocztowy</label>
              <input name="zipCode" type="text" value={formData.zipCode} onChange={handleChange} placeholder="XX-XXX" className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Promień działania (km)</label>
              <input name="radius" type="number" min="10" value={formData.radius} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Liczba dostępnych brygad</label>
              <input name="teamsCount" type="number" min="1" value={formData.teamsCount} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="space-y-1.5 flex items-center mt-6">
              <input name="drillingRig" type="checkbox" checked={formData.drillingRig} onChange={handleChange} className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
              <label className="ml-2 block text-sm text-gray-900">Wiertnica do żelbetu</label>
            </div>
          </div>

          <h3 className="text-lg font-medium text-gray-900 mb-4">Finanse</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">IBAN</label>
              <input name="iban" type="text" value={formData.iban} onChange={handleChange} placeholder="PL..." className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>

          <div className="mt-8 flex justify-end space-x-3 pt-6 border-t border-gray-100">
            <button 
              type="button" 
              onClick={() => onOpenChange(false)}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Anuluj
            </button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 shadow-sm"
            >
              {isSubmitting ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
