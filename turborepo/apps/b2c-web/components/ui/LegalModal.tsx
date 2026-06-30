"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';

export function LegalModal({ title, children }: { title: string, children: React.ReactNode }) {
  const router = useRouter();

  return (
    <Dialog 
      open={true} 
      onOpenChange={(open) => {
        if (!open) {
          router.back();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[95vw] md:w-[70vw] md:max-w-[70vw] rounded-2xl p-6 sm:p-10">
        <DialogHeader>
          <DialogTitle className="sr-only">{title}</DialogTitle>
        </DialogHeader>
        <div className="markdown-body">
          <style>{`
            .markdown-body h1 { font-size: 2.25rem; font-weight: 800; margin-bottom: 1.5rem; color: #0d1b2e; }
            .markdown-body h2 { font-size: 1.5rem; font-weight: 700; margin-top: 2rem; margin-bottom: 1rem; color: #1750c8; }
            .markdown-body p { margin-bottom: 1rem; color: #475569; line-height: 1.7; }
            .markdown-body ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1rem; color: #475569; }
            .markdown-body li { margin-bottom: 0.5rem; }
            .markdown-body em { color: #94a3b8; font-style: italic; }
          `}</style>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
