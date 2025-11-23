// import React, { useState } from "react";
// import { saveInsight } from "../../utils/storage";
// import "./PaperPage.css";

// export default function PaperPage() {
//   const [quote, setQuote] = useState("");
//   const [summary, setSummary] = useState("");
//   const [citation, setCitation] = useState("");
//   const [page, setPage] = useState("");

//   const handleSave = (e) => {
//     e.preventDefault();
//     if (!quote && !summary) return;
//     saveInsight({ quote, summary, citation, page });
//     setQuote("");
//     setSummary("");
//     setCitation("");
//     setPage("");
//     alert("Insight saved.");
//   };

//   return (
//     <div className="paper-layout">
//       <div className="reader-pane">
//         <div className="pdf-placeholder">
//           <p>PDF Reader Placeholder</p>
//           <p className="muted">Drop a PDF here or set an iframe src later.</p>
//         </div>
//       </div>

//       <aside className="notes-pane">
//         <h2>Linked Note Capture</h2>
//         <form onSubmit={handleSave} className="note-form">
//           <label>Quote (optional)</label>
//           <textarea
//             value={quote}
//             onChange={(e) => setQuote(e.target.value)}
//             placeholder="Copy/paste highlight or a direct quote"
//             rows={3}
//           />
//           <label>Why it matters / summary</label>
//           <textarea
//             value={summary}
//             onChange={(e) => setSummary(e.target.value)}
//             placeholder="Summarize the insight in your words"
//             rows={3}
//             required
//           />
//           <div className="row">
//             <div className="field">
//               <label>Citation</label>
//               <input
//                 value={citation}
//                 onChange={(e) => setCitation(e.target.value)}
//                 placeholder="Smith et al., 2022"
//               />
//             </div>
//             <div className="field small">
//               <label>Page</label>
//               <input
//                 value={page}
//                 onChange={(e) => setPage(e.target.value)}
//                 placeholder="23"
//               />
//             </div>
//           </div>
//           <button className="save-btn" type="submit">
//             + Add Insight
//           </button>
//         </form>

//         <div className="helper">
//           <p className="muted">
//             Tip: In mid-fi, bind selection from the PDF to auto-fill "Quote" and
//             detect page.
//           </p>
//         </div>
//       </aside>
//     </div>
//   );
// }

// src/components/PaperPage/PaperPage.jsx
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { saveInsight } from "../../utils/storage";
import "./PaperPage.css";

import { db } from "../../firebaseConfig";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

export default function PaperPage() {
  const { projectId } = useParams();

  const [quote, setQuote] = useState("");
  const [summary, setSummary] = useState("");
  const [citation, setCitation] = useState("");
  const [page, setPage] = useState("");

  const [papers, setPapers] = useState([]);
  const [selectedPaper, setSelectedPaper] = useState(null);

  // Subscribe to papers for this project
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

  const handleSave = (e) => {
    e.preventDefault();
    if (!quote && !summary) return;

    // include which paper this insight came from
    const payload = {
      quote,
      summary,
      citation,
      page,
      projectId: projectId || null,
      paperId: selectedPaper?.id || null,
      paperTitle: selectedPaper?.title || null,
    };

    saveInsight(payload);

    setQuote("");
    setSummary("");
    setCitation("");
    setPage("");
    alert("Insight saved.");
  };

  return (
    <div className="paper-layout">
      {/* LEFT: paper list + PDF viewer */}
      <div className="reader-pane">
        <div className="paper-reader-layout">
          {/* Paper list */}
          <div className="paper-list-pane">
            <h3 className="pane-title">Papers in this project</h3>

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
          <div className="pdf-viewer-pane">
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
          </div>
        </div>
      </div>

      {/* RIGHT: notes capture (unchanged, just hooked to selectedPaper) */}
      <aside className="notes-pane">
        <h2>Linked Note Capture</h2>
        {selectedPaper && (
          <p className="muted current-paper-hint">
            Capturing notes for:
            <br />
            <strong>{selectedPaper.title || selectedPaper.fileName}</strong>
          </p>
        )}

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
