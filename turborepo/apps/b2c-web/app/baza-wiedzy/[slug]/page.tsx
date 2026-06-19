import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Calendar } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { articles } from '@/lib/articles';
import fs from 'fs/promises';
import path from 'path';
import ReactMarkdown from 'react-markdown';

// Static params for static site generation
export function generateStaticParams() {
  return articles.map((article) => ({
    slug: article.slug,
  }));
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = articles.find((a) => a.slug === slug);

  if (!article) {
    notFound();
  }

  let fileContent = '';
  try {
    const filePath = path.join(process.cwd(), 'content', 'articles', `${slug}.md`);
    fileContent = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    console.error("Brak pliku MD dla tego artykułu.");
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="pt-32 pb-24 sm:pt-40 sm:pb-32">
        <article className="max-w-4xl mx-auto px-6 lg:px-12">
          {/* Back button */}
          <div className="mb-12">
            <Link 
              href="/baza-wiedzy"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              <ChevronLeft size={20} />
              Wstecz
            </Link>
          </div>

          {/* Article Header */}
          <header className="mb-12">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-6">
              <Calendar className="w-4 h-4" />
              {article.date}
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-8xl font-bold tracking-tight text-foreground leading-[1.05] mb-8">
              {article.title}
            </h1>
            <p className="text-xl sm:text-2xl text-muted-foreground leading-relaxed font-medium">
              {article.excerpt}
            </p>
          </header>

          {/* Featured Image */}
          <div className="w-full aspect-[16/9] rounded-3xl overflow-hidden mb-16 shadow-lg">
            <img 
              src={article.imageUrl} 
              alt={article.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Content (HTML) */}
          <div 
            className="
              max-w-none text-lg sm:text-xl text-muted-foreground leading-relaxed
              [&_h1]:text-4xl [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mb-6
              [&_h2]:text-3xl [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-12 [&_h2]:mb-6 [&_h2]:tracking-tight
              [&_h3]:text-2xl [&_h3]:font-bold [&_h3]:text-foreground [&_h3]:mt-8 [&_h3]:mb-4
              [&_p]:mb-6
              [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-6 [&_ul]:space-y-2
              [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-6 [&_ol]:space-y-2
              [&_li]:text-muted-foreground
              [&_strong]:font-semibold [&_strong]:text-foreground
              [&_em]:italic
              [&_a]:text-primary hover:[&_a]:text-primary/80
            "
          >
            {fileContent ? (
              <ReactMarkdown>{fileContent}</ReactMarkdown>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: article.content }} />
            )}
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
