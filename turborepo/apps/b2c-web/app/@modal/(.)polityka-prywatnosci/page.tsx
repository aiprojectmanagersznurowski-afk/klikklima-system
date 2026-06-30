import fs from 'fs/promises';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import { LegalModal } from '@/components/ui/LegalModal';

export default async function PrivacyModalPage() {
  const filePath = path.join(process.cwd(), 'content', 'polityka-prywatnosci.md');
  const fileContent = await fs.readFile(filePath, 'utf8');

  return (
    <LegalModal title="Polityka Prywatności">
      <ReactMarkdown>{fileContent}</ReactMarkdown>
    </LegalModal>
  );
}
