import React, { useState } from 'react';
import { TopBar } from './components/TopBar';
import { AuditorsTable, Auditor } from './components/AuditorsTable';
import { AddAuditorModal } from './components/AddAuditorModal';

const MOCK_AUDITORS: Auditor[] = [
  { id: '1', name: 'Jan Kowalski', companyName: 'Klima-Tech Sp. z o.o.', nip: '123-456-78-90', email: 'jan.kowalski@klimatech.pl', phone: '+48 123 456 789', fgazCert: 'FGAZ/1234/2023' },
  { id: '2', name: 'Anna Nowak', avatarUrl: 'https://i.pravatar.cc/150?u=anna', companyName: 'Nowak Chłodnictwo', nip: '987-654-32-10', email: 'anna@nowakchlodnictwo.pl', phone: '+48 987 654 321', fgazCert: 'FGAZ/5678/2022' },
  { id: '3', name: 'Piotr Wiśniewski', companyName: 'Serwis HVAC Wiśniewski', nip: '111-222-33-44', email: 'piotr.w@serwishvac.com', phone: '+48 111 222 333', fgazCert: 'FGAZ/9012/2024' },
];

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAuditors = MOCK_AUDITORS.filter(auditor => {
    const query = searchQuery.toLowerCase();
    return (
      auditor.name.toLowerCase().includes(query) ||
      auditor.companyName.toLowerCase().includes(query) ||
      auditor.email.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-['Inter']">
      <main className="flex-1 flex flex-col min-w-0">
        <TopBar 
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAddClick={() => setIsModalOpen(true)} 
        />
        
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <AuditorsTable auditors={filteredAuditors} />
          </div>
        </div>
      </main>

      <AddAuditorModal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen}
        onSave={() => setIsModalOpen(false)}
      />
    </div>
  );
}
