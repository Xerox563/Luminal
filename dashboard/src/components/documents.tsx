"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { panelStyle, SectionTitle, ghostBtn, easeOutExpo } from "@/components/ui";

interface Document {
  id: string;
  filename: string;
  chunks_count: number;
  created_at: string;
}

export function DocumentsSection({
  token,
  notify,
}: {
  token: string;
  notify: (msg: string) => void;
}) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [chunkSize, setChunkSize] = useState(1000);
  const [overlap, setOverlap] = useState(200);
  const [showUpload, setShowUpload] = useState(false);

  const loadDocuments = async () => {
    try {
      const res = await api<{ documents: Document[]; total: number }>("/documents", token);
      setDocuments(res.documents || []);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDocuments(); }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("chunk_size", chunkSize.toString());
      formData.append("overlap", overlap.toString());

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/documents/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Upload failed (${res.status})`);
      }
      await loadDocuments();
      setFile(null);
      setShowUpload(false);
      notify(`Document "${file.name}" uploaded and indexed`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string, filename: string) => {
    if (!confirm(`Delete "${filename}"?`)) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/documents/${docId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadDocuments();
      notify(`Document "${filename}" deleted`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 13px",
    borderRadius: 10,
    background: "#0c0c12",
    border: "1px solid rgba(255,255,255,0.09)",
    color: "#e4e4e7",
    fontSize: 13,
    outline: "none",
    fontFamily: "'JetBrains Mono', monospace",
    boxSizing: "border-box" as const,
  };

  const numInputStyle: React.CSSProperties = {
    width: 100,
    padding: "10px 13px",
    borderRadius: 10,
    background: "#0c0c12",
    border: "1px solid rgba(255,255,255,0.09)",
    color: "#e4e4e7",
    fontSize: 13,
    outline: "none",
    fontFamily: "'JetBrains Mono', monospace",
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 1.0, ease: easeOutExpo }}
      style={{ marginTop: 16 }}
    >
      <motion.div whileHover={{ y: -3 }} style={panelStyle}>
        <SectionTitle
          title="Documents (RAG)"
          subtitle="Upload PDFs, TXT, MD files for retrieval-augmented generation"
          right={
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setShowUpload(!showUpload)}
              style={ghostBtn}
            >
              {showUpload ? "Close" : "+ Add Document"}
            </motion.button>
          }
        />

        {/* Upload Form */}
        <AnimatePresence>
          {showUpload && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              style={{ overflow: "hidden" }}
            >
              <div
                style={{
                  marginBottom: 16,
                  padding: 20,
                  background: "rgba(255,255,255,0.02)",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "#d4d4d8", marginBottom: 16 }}>
                  Upload &amp; Index Document
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ display: "block", fontSize: 12, color: "#71717a", marginBottom: 6 }}>File (PDF, TXT, MD)</label>
                    <input
                      type="file"
                      accept=".pdf,.txt,.md"
                      onChange={handleFileChange}
                      style={{ width: "100%", fontSize: 13, color: "#71717a" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#71717a", marginBottom: 6 }}>Chunk Size</label>
                    <input
                      type="number"
                      value={chunkSize}
                      onChange={(e) => setChunkSize(Number(e.target.value))}
                      min={100}
                      max={5000}
                      style={numInputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#71717a", marginBottom: 6 }}>Overlap</label>
                    <input
                      type="number"
                      value={overlap}
                      onChange={(e) => setOverlap(Number(e.target.value))}
                      min={0}
                      max={1000}
                      style={numInputStyle}
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={handleUpload}
                    disabled={uploading || !file}
                    style={{
                      padding: "10px 22px",
                      borderRadius: 11,
                      border: "none",
                      cursor: "pointer",
                      background: "linear-gradient(135deg, #6366f1, #a855f7)",
                      color: "white",
                      fontSize: 13,
                      fontWeight: 600,
                      opacity: uploading || !file ? 0.6 : 1,
                      fontFamily: "inherit",
                    }}
                  >
                    {uploading ? "Indexing…" : "Upload & Index"}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Documents List */}
        {loading ? (
          <div style={{ padding: "20px 0", textAlign: "center", color: "#52525b" }}>Loading…</div>
        ) : documents.length === 0 ? (
          <div style={{ padding: "30px 0", textAlign: "center", color: "#52525b", fontSize: 13 }}>
            No documents uploaded yet. Click "+ Add Document" to upload files for RAG.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {documents.map((doc, i) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.3 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)",
                  borderRadius: 12,
                  gap: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: "rgba(139,92,246,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#a78bfa",
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    📄
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "#e4e4e7", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {doc.filename}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#71717a", marginTop: 3 }}>
                      {doc.chunks_count} chunks · {new Date(doc.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleDelete(doc.id, doc.filename)}
                  style={{ ...ghostBtn, color: "#f87171", borderColor: "rgba(248,113,113,0.3)", padding: "8px 14px", flexShrink: 0 }}
                >
                  Delete
                </motion.button>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.section>
  );
}