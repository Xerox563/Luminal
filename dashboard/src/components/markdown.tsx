"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ─── Shared response renderer ──────────────────────────────────────────────
// Model responses come back as markdown (headers, bold, tables, code, lists)
// — this renders that properly instead of dumping raw "**text**"/"###" into
// a <pre> block.
export function Markdown({ content }: { content: string }) {
  return (
    <div className="md-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      <style jsx global>{`
        .md-body {
          font-size: 14px;
          line-height: 1.75;
          color: #e4e4e7;
        }
        .md-body > *:first-child {
          margin-top: 0;
        }
        .md-body > *:last-child {
          margin-bottom: 0;
        }
        .md-body p {
          margin: 0 0 12px;
        }
        .md-body h1,
        .md-body h2,
        .md-body h3,
        .md-body h4 {
          font-weight: 700;
          color: #f4f4f5;
          margin: 20px 0 10px;
          line-height: 1.35;
        }
        .md-body h1 {
          font-size: 20px;
        }
        .md-body h2 {
          font-size: 17px;
        }
        .md-body h3 {
          font-size: 15px;
        }
        .md-body h4 {
          font-size: 14px;
        }
        .md-body strong {
          color: #f4f4f5;
          font-weight: 700;
        }
        .md-body em {
          color: #d4d4d8;
        }
        .md-body ul,
        .md-body ol {
          margin: 0 0 12px;
          padding-left: 22px;
        }
        .md-body li {
          margin: 4px 0;
        }
        .md-body li > p {
          margin: 0;
        }
        .md-body a {
          color: #a78bfa;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .md-body code {
          background: rgba(167, 139, 250, 0.1);
          color: #c4b5fd;
          padding: 2px 6px;
          border-radius: 5px;
          font-size: 12.5px;
          font-family: "JetBrains Mono", Monaco, monospace;
        }
        .md-body pre {
          background: #08080c;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 14px 16px;
          overflow-x: auto;
          margin: 0 0 12px;
        }
        .md-body pre code {
          background: none;
          padding: 0;
          color: #e4e4e7;
        }
        .md-body blockquote {
          margin: 0 0 12px;
          padding: 4px 14px;
          border-left: 3px solid #a855f7;
          color: #a1a1aa;
        }
        .md-body hr {
          border: none;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          margin: 16px 0;
        }
        .md-body table {
          width: 100%;
          border-collapse: collapse;
          margin: 0 0 14px;
          font-size: 13px;
          overflow-x: auto;
          display: block;
        }
        .md-body th,
        .md-body td {
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 7px 11px;
          text-align: left;
        }
        .md-body th {
          background: rgba(255, 255, 255, 0.04);
          color: #d4d4d8;
          font-weight: 700;
        }
        .md-body tr:nth-child(even) td {
          background: rgba(255, 255, 255, 0.015);
        }
      `}</style>
    </div>
  );
}
