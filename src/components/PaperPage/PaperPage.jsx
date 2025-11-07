import React, { useState } from "react";
import { saveInsight } from "../../utils/storage";
import "./PaperPage.css";

export default function PaperPage() {
  const [quote, setQuote] = useState("");
  const [summary, setSummary] = useState("");
  const [citation, setCitation] = useState("");
  const [page, setPage] = useState("");

  const handleSave = (e) => {
    e.preventDefault();
    if (!quote && !summary) return;
    saveInsight({ quote, summary, citation, page });
    setQuote("");
    setSummary("");
    setCitation("");
    setPage("");
    alert("Insight saved.");
  };

  return (
    <div className="paper-layout">
      <div className="reader-pane">
        <div className="pdf-placeholder">
          <p>PDF Reader Placeholder</p>
          <p className="muted">Drop a PDF here or set an iframe src later.</p>
        </div>
      </div>

      <aside className="notes-pane">
        <h2>Linked Note Capture</h2>
        <form onSubmit={handleSave} className="note-form">
          <label>Quote (optional)</label>
          <textarea
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="Copy/paste highlight or a direct quote"
            rows={3}
          />
          <label>Why it matters / summary</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Summarize the insight in your words"
            rows={3}
            required
          />
          <div className="row">
            <div className="field">
              <label>Citation</label>
              <input
                value={citation}
                onChange={(e) => setCitation(e.target.value)}
                placeholder="Smith et al., 2022"
              />
            </div>
            <div className="field small">
              <label>Page</label>
              <input
                value={page}
                onChange={(e) => setPage(e.target.value)}
                placeholder="23"
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
      </aside>
    </div>
  );
}
