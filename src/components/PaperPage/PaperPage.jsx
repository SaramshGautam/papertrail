import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { saveInsight } from "../../utils/storage";
import { Document, Page, pdfjs } from "react-pdf";
import "./PaperPage.css";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

import { db } from "../../firebaseConfig";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function PaperPage() {
  const { projectId } = useParams();

  const [quote, setQuote] = useState("");
  const [summary, setSummary] = useState("");
  const [citation, setCitation] = useState("");
  const [page, setPage] = useState("");

  const [papers, setPapers] = useState([]);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [projectInfo, setProjectInfo] = useState(null);

  const [numPages, setNumPages] = useState(null);
  const pdfContainerRef = useRef(null);
  const summaryRef = useRef(null);

  const [insights, setInsights] = useState([]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  function getPageNumberFromRange(range) {
    let node = range.commonAncestorContainer;
    while (node) {
      if (node.nodeType === 1) {
        const el = node;
        const pageAttr = el.getAttribute && el.getAttribute("data-page-number");
        if (pageAttr) {
          return pageAttr;
        }
      }
      node = node.parentNode;
    }
    return null;
  }

  function buildFullCitation(paper) {
    if (!paper) return "";

    const authors = paper.author || paper.sub || "";
    const title = paper.title || paper.fileName || "";
    const year = paper.year || paper.pubYear || paper.yearPublished || null; // support future fields if you add them
    const venue = paper.venue || paper.journal || paper.conference || ""; // also future-proof

    const parts = [];

    if (authors) parts.push(authors);
    parts.push(year ? `(${year}).` : "(n.d.).");
    if (title) parts.push(title.endsWith(".") ? title : `${title}.`);
    if (venue) parts.push(venue);

    return parts.join(" ").trim();
  }

  const handlePdfSelection = () => {
    if (!pdfContainerRef.current) return;
    const sel = window.getSelection();
    if (!sel) return;

    const raw = sel.toString();
    if (!raw.trim()) return;

    const range = sel.rangeCount ? sel.getRangeAt(0) : null;
    if (range) {
      const container = pdfContainerRef.current;
      const isInside =
        container.contains(range.commonAncestorContainer) ||
        container === range.commonAncestorContainer;
      if (!isInside) return;
    }

    let text = raw;

    text = text.replace(/-\s*\n\s*/g, "");
    text = text.replace(/\s*\n\s*/g, " ");
    text = text.replace(/\s+/g, " ").trim();

    if (!text) return;

    // Append or replace Quote
    setQuote((prev) => (prev ? `${prev}\n${text}` : text));

    // 2) Auto-detect page number from DOM, if possible
    if (range) {
      const pageNum = getPageNumberFromRange(range);
      if (pageNum) {
        setPage(pageNum.toString());
      }
    }

    // 3) Auto-fill citation only if empty
    if (!citation && selectedPaper) {
      const auto = buildFullCitation(selectedPaper);
      if (auto) {
        setCitation(auto);
      }
    }

    if (summaryRef.current) {
      summaryRef.current.focus();
    }
  };

  useEffect(() => {
    if (!projectId || !selectedPaper?.id) {
      setInsights([]);
      return;
    }

    const insightsCol = collection(
      db,
      "projects",
      projectId,
      "papers",
      selectedPaper.id,
      "insights"
    );
    const q = query(insightsCol, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setInsights(docs);
    });

    return () => unsub();
  }, [projectId, selectedPaper?.id]);

  useEffect(() => {
    if (!projectId) return;

    const papersCol = collection(db, "projects", projectId, "papers");
    const q = query(papersCol, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPapers(docs);

      // If nothing selected yet, auto-select the first paper
      if (!selectedPaper && docs.length > 0) {
        setSelectedPaper(docs[0]);
      }
    });

    return () => unsub();
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;

    const ref = doc(db, "projects", projectId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setProjectInfo(snap.data());
      }
    });
    return () => unsub();
  }, [projectId]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!quote && !summary) return;

    const payload = {
      quote,
      summary,
      citation,
      page,
      projectId: projectId || null,
      paperId: selectedPaper?.id || null,
      paperTitle: selectedPaper?.title || null,
    };

    // saveInsight(payload);

    try {
      if (projectId && selectedPaper?.id) {
        const insightsCol = collection(
          db,
          "projects",
          projectId,
          "papers",
          selectedPaper.id,
          "insights"
        );

        await addDoc(insightsCol, {
          quote,
          summary,
          citation,
          page,
          projectId,
          paperId: selectedPaper.id,
          paperTitle: selectedPaper.title || selectedPaper.fileName || "",
          createdAt: serverTimestamp(),
        });
      }

      setQuote("");
      setSummary("");
      setCitation("");
      setPage("");
      alert("Insight saved.");
    } catch (e) {
      console.error("Failed to save insights", e);
      alert("Failed to save insight. Please try again.");
    }
  };

  return (
    <div className="paper-layout">
      {/* LEFT: paper list + PDF viewer */}
      <div className="reader-pane">
        <div className="paper-reader-layout">
          {/* Paper list */}
          <div className="paper-list-pane">
            <div className="paper-pane-topbar">
              <div className="paper-pane-title">Papers</div>
              {projectInfo?.title && (
                <div className="paper-pane-project">{projectInfo.title}</div>
              )}
            </div>

            {!projectId && (
              <p className="muted">
                No project selected. Open a project from the landing page.
              </p>
            )}

            {projectId && papers.length === 0 && (
              <p className="muted">No papers yet. Upload from the Home view.</p>
            )}

            <ul className="paper-list">
              {papers.map((p) => (
                <li
                  key={p.id}
                  className={
                    "paper-list-item" +
                    (selectedPaper?.id === p.id ? " selected" : "")
                  }
                  onClick={() => setSelectedPaper(p)}
                >
                  <div className="paper-list-title">
                    {p.title || p.fileName || "Untitled paper"}
                  </div>
                  <div className="paper-list-sub">
                    {p.author || p.sub || "Unknown author"}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* PDF viewer */}
          {/* <div className="pdf-viewer-pane">
            {selectedPaper && selectedPaper.fileUrl ? (
              <iframe
                src={selectedPaper.fileUrl}
                title={selectedPaper.title || "Paper PDF"}
                className="pdf-iframe"
              />
            ) : (
              <div className="pdf-placeholder">
                <p>No paper selected</p>
                <p className="muted">
                  Choose a paper from the list on the left to view it.
                </p>
              </div>
            )}
          </div> */}

          <div className="pdf-viewer-pane">
            {selectedPaper && selectedPaper.fileUrl ? (
              <div
                className="pdf-viewer-inner"
                ref={pdfContainerRef}
                onMouseUp={handlePdfSelection}
              >
                <Document
                  file={selectedPaper.fileUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={<div className="pdf-placeholder">Loading PDF…</div>}
                  error={
                    <div className="pdf-placeholder">Failed to load PDF.</div>
                  }
                  renderMode="canvas"
                >
                  {Array.from(new Array(numPages || 0), (el, index) => (
                    <div className="pdf-page-wrapper" key={index}>
                      <Page
                        pageNumber={index + 1}
                        width={pdfContainerRef.current?.clientWidth - 40}
                        renderTextLayer={true}
                        renderAnnotationLayer={false}
                      />
                    </div>
                  ))}
                </Document>
              </div>
            ) : (
              <div className="pdf-placeholder">
                <p>No paper selected</p>
                <p className="muted">
                  Choose a paper from the list on the left to view it.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: notes capture (unchanged, just hooked to selectedPaper) */}
      <aside className="notes-pane">
        <div className="notes-header">
          <h2>Linked Note Capture</h2>

          {projectId && (
            <div className="notes-header-links">
              <Link to={`/home/${projectId}`} className="notes-nav-link subtle">
                ← Back to Project
              </Link>
              <Link
                to={`/writing/${projectId}`}
                className="notes-nav-link primary"
              >
                Open Writing
              </Link>
            </div>
          )}
        </div>
        {selectedPaper && (
          <p className="muted current-paper-hint">
            Capturing notes for:
            <br />
            <strong>{selectedPaper.title || selectedPaper.fileName}</strong>
          </p>
        )}

        <form onSubmit={handleSave} className="note-form">
          <label>Quote</label>
          <textarea
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="Copy/paste highlight or a direct quote"
            rows={3}
            required
          />

          <label>Why it matters / summary (optional)</label>
          <textarea
            ref={summaryRef}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Summarize the insight in your words"
            rows={3}
          />

          <div className="row">
            <div className="field">
              <label>Citation</label>
              <input
                value={citation}
                onChange={(e) => setCitation(e.target.value)}
                placeholder="Smith et al., 2022"
                required
              />
            </div>
            <div className="field small">
              <label>Page</label>
              <input
                value={page}
                onChange={(e) => setPage(e.target.value)}
                placeholder="67"
                required
              />
            </div>
          </div>

          <button className="save-btn" type="submit">
            + Add Insight
          </button>
        </form>

        <div className="helper">
          <p className="muted">
            Tip: In mid-fi, bind selection from the PDF to auto-fill "Quote" and
            detect page.
          </p>
        </div>

        {selectedPaper && (
          <div className="insights-section">
            <h3 className="insights-title">Saved insights for this paper</h3>

            {insights.length === 0 ? (
              <p className="muted small">
                No insights yet. Highlight text in the PDF and click “+ Add
                Insight”.
              </p>
            ) : (
              <div className="insights-list">
                {insights.map((ins) => (
                  <div key={ins.id} className="insight-card">
                    {ins.quote && (
                      <div className="insight-quote">“{ins.quote}”</div>
                    )}

                    {ins.summary && (
                      <div className="insight-summary">{ins.summary}</div>
                    )}

                    <div className="insight-meta">
                      {ins.citation && (
                        <span className="insight-citation">{ins.citation}</span>
                      )}
                      {ins.page && (
                        <span className="insight-page">p. {ins.page}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
