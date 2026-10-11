import React, { useMemo } from 'react';
import { marked } from 'marked';

export function Markdown({ source }: { source: string }) {
  const html = useMemo(() => {
    if (!source) return '';
    return marked.parse(source, { breaks: true }) as string;
  }, [source]);
  return (
    <div
      className="bp-markdown"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
