// Renders assistant responses as GitHub-flavored markdown using the shared product theme.
'use client';

import type { ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type MarkdownRendererProps = {
  content: string;
  className?: string;
};

// Keep links safe and open them in a new tab so assistant output cannot navigate the app shell away.
function LinkRenderer({
  href,
  children,
  ...props
}: ComponentProps<'a'>) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-medium text-[var(--app-highlight)] underline underline-offset-4 hover:text-[var(--app-accent)]"
      {...props}
    >
      {children}
    </a>
  );
}

export default function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  return (
    <div
      className={[
        'min-w-0 text-sm leading-7',
        '[&_h1]:mt-4 [&_h1]:text-2xl [&_h1]:font-semibold',
        '[&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold',
        '[&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold',
        '[&_p]:my-3',
        '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6',
        '[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6',
        '[&_li]:my-1',
        '[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--app-border-strong)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[var(--app-muted-strong)]',
        '[&_hr]:my-5 [&_hr]:border-[var(--app-border)]',
        '[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden',
        '[&_thead]:bg-[color-mix(in_srgb,var(--app-panel-soft)_85%,transparent)]',
        '[&_th]:border [&_th]:border-[var(--app-border)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold',
        '[&_td]:border [&_td]:border-[var(--app-border)] [&_td]:px-3 [&_td]:py-2',
        '[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-[1rem] [&_pre]:border [&_pre]:border-[var(--app-border)] [&_pre]:bg-[color-mix(in_srgb,var(--app-panel-strong)_96%,transparent)] [&_pre]:p-4',
        '[&_code]:rounded-md [&_code]:bg-[color-mix(in_srgb,var(--app-panel-strong)_92%,transparent)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.92em]',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        className ?? '',
      ].join(' ')}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: LinkRenderer,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
