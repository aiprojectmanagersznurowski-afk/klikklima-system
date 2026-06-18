import fs from 'fs/promises';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import { BackButton } from '@/components/ui/BackButton';

export const metadata = {
  title: 'Polityka Prywatności | KlikKlima',
  description: 'Zasady przetwarzania danych osobowych.',
};

export default async function PolicyPage() {
  const filePath = path.join(process.cwd(), 'content', 'polityka-prywatnosci.md');
  const fileContent = await fs.readFile(filePath, 'utf8');

  return (
    <div className="min-h-screen bg-background py-16 px-5 sm:px-8">
      <div className="max-w-3xl mx-auto">
        <BackButton label="Wstecz" />
        
        <div className="bg-white p-8 sm:p-12 rounded-3xl shadow-sm border border-border">
          {/* Prosty silnik CSS dla wygenerowanego HTML z Markdowna bez używania tailwind-typography */}
          <div className="markdown-body">
            <style>{`
              .markdown-body h1 { font-size: 2.25rem; font-weight: 800; margin-bottom: 1.5rem; color: #0d1b2e; }
              .markdown-body h2 { font-size: 1.5rem; font-weight: 700; margin-top: 2rem; margin-bottom: 1rem; color: #1750c8; }
              .markdown-body p { margin-bottom: 1rem; color: #475569; line-height: 1.7; }
              .markdown-body ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1rem; color: #475569; }
              .markdown-body li { margin-bottom: 0.5rem; }
              .markdown-body em { color: #94a3b8; font-style: italic; }
            `}</style>
            
            <ReactMarkdown>{fileContent}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
