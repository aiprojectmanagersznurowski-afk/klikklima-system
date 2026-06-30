import fs from 'fs/promises';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import { LegalModal } from '@/components/ui/LegalModal';

export default async function TermsModalPage() {
  const filePath = path.join(process.cwd(), 'content', 'regulamin.md');
  const fileContent = await fs.readFile(filePath, 'utf8');

  return (
    <LegalModal title="Regulamin">
      <ReactMarkdown>{fileContent}</ReactMarkdown>
    </LegalModal>
  );
}
