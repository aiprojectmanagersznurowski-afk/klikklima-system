import { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { LeadsList } from './components/LeadsList';
import { LeadCard } from './components/LeadCard';
import { Customers } from './components/Customers';
import { Team } from './components/Team';
import { NotificationCenter } from './components/NotificationCenter';

export type Page = 'dashboard' | 'leads' | 'lead-card' | 'customers' | 'team' | 'notifications';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);

  const openLead = (id: number) => {
    setSelectedLeadId(id);
    setCurrentPage('lead-card');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} />;
      case 'leads':
        return <LeadsList onOpenLead={openLead} />;
      case 'lead-card':
        return <LeadCard leadId={selectedLeadId} onBack={() => setCurrentPage('leads')} />;
      case 'customers':
        return <Customers />;
      case 'team':
        return <Team />;
      case 'notifications':
        return <NotificationCenter />;
      default:
        return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}
