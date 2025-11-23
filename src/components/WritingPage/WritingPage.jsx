import React, { useEffect, useMemo, useRef, useState } from "react";
import { getInsights } from "../../utils/storage";
import "./WritingPage.css";

import { db } from "../../firebaseConfig";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useParams } from "react-router-dom";

const SUGGEST_ENDPOINT = "http://127.0.0.1:8000/suggest_papers";

function getLastClause(text) {
  // crude but works fine: split on sentence-ish punctuation
  const parts = text.split(/[.!?]/);
  const last = parts[parts.length - 1].trim();
  return last;
}

function findSuggestions(text, insights) {
  // naive keyword overlap on the last sentence
  const lastSentence = (text.split(/[.!?]\s/).pop() || "").toLowerCase();
  if (!lastSentence) return [];
  const tokens = new Set(lastSentence.split(/\W+/).filter(Boolean));
  return insights
    .map((ins) => {
      const s = (ins.summary || ins.quote || "").toLowerCase();
      const words = new Set(s.split(/\W+/).filter(Boolean));
      let overlap = 0;
      tokens.forEach((t) => {
        if (words.has(t)) overlap++;
      });
      return { ins, overlap };
    })
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 5)
    .map((x) => x.ins);
}

async function fetchPaperSuggestionsFromBackend({
  projectId,
  sentence,
  papers,
}) {
  try {
    const payload = {
      project_id: projectId,
      sentence,
      papers: papers.map((p) => ({
        paper_id: p.id,
        title: p.title || "",
        abstract: p.abstract || "",
        authors: p.author || p.sub || "",
      })),
    };

    const res = await fetch(SUGGEST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    const data = await res.json();
    // console.log(`List of suggested papers: ${data.suggested_papers}`);
    console.log("List of suggested papers:", data.suggested_papers);

    return data.suggested_papers || [];
  } catch (err) {
    console.error("[SUGGEST] error", err);
    return [];
  }
}

// export default function WritingPage() {
//   const [draft, setDraft] = useState("");
//   const insights = useMemo(() => getInsights(), []);
//   const [suggestions, setSuggestions] = useState([]);
//   const textareaRef = useRef(null);

//   useEffect(() => {
//     setSuggestions(findSuggestions(draft, insights));
//   }, [draft, insights]);

//   const insertCitation = (c) => {
//     const ta = textareaRef.current;
//     const pos = ta.selectionStart;
//     const left = draft.slice(0, pos);
//     const right = draft.slice(pos);
//     const token = ` [${c}]`;
//     setDraft(left + token + right);
//     requestAnimationFrame(() => {
//       ta.focus();
//       ta.setSelectionRange(pos + token.length, pos + token.length);
//     });
//   };

//   return (
//     <div className="writing-wrap">
//       <section className="editor">
//         <h2>Writing</h2>
//         <textarea
//           ref={textareaRef}
//           value={draft}
//           onChange={(e) => setDraft(e.target.value)}
//           placeholder="Begin drafting... PaperTrail will suggest citations in context."
//           rows={18}
//         />
//       </section>

//       <aside className="suggestions">
//         <h3>Contextual Suggestions</h3>
//         {suggestions.length === 0 && (
//           <p className="muted">Type a sentence to see matches.</p>
//         )}
//         <ul>
//           {suggestions.map((s) => (
//             <li key={s.id} className="sug">
//               <div className="sug-text">“{s.summary || s.quote}”</div>
//               <div className="sug-meta">
//                 {s.citation || "Uncited"} {s.page ? `• p.${s.page}` : ""}
//               </div>
//               <button
//                 onClick={() => insertCitation(s.citation || "Source")}
//                 className="mini"
//               >
//                 Insert Cite
//               </button>
//             </li>
//           ))}
//         </ul>
//         <div className="helper muted">
//           In mid-fi: show “Found in Smith 2022” inline as you type.
//         </div>
//       </aside>
//     </div>
//   );
// }

// src/components/WritingPage/WritingPage.jsx

///
///
///
///
///
///
// import React, { useEffect, useMemo, useRef, useState } from "react";
// import { useParams } from "react-router-dom";
// import { getInsights } from "../../utils/storage";
// import "./WritingPage.css";

// import { db } from "../../firebaseConfig";
// import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

// function findSuggestions(text, insights) {
//   // naive keyword overlap on the last sentence
//   const lastSentence = (text.split(/[.!?]\s/).pop() || "").toLowerCase();
//   if (!lastSentence) return [];
//   const tokens = new Set(lastSentence.split(/\W+/).filter(Boolean));
//   return insights
//     .map((ins) => {
//       const s = (ins.summary || ins.quote || "").toLowerCase();
//       const words = new Set(s.split(/\W+/).filter(Boolean));
//       let overlap = 0;
//       tokens.forEach((t) => {
//         if (words.has(t)) overlap++;
//       });
//       return { ins, overlap };
//     })
//     .filter((x) => x.overlap > 0)
//     .sort((a, b) => b.overlap - a.overlap)
//     .slice(0, 5)
//     .map((x) => x.ins);
// }

// export default function WritingPage() {
//   const { projectId } = useParams();

//   const [draft, setDraft] = useState("");
//   const insights = useMemo(() => getInsights(), []);
//   const [suggestions, setSuggestions] = useState([]);
//   const textareaRef = useRef(null);

//   // 🔹 Papers for this project
//   const [papers, setPapers] = useState([]);
//   const [selectedPaperId, setSelectedPaperId] = useState(null);

//   // Subscribe to project papers from Firestore
//   useEffect(() => {
//     if (!projectId) return;

//     const papersCol = collection(db, "projects", projectId, "papers");
//     const q = query(papersCol, orderBy("createdAt", "desc"));

//     const unsub = onSnapshot(q, (snapshot) => {
//       const docs = snapshot.docs.map((doc) => ({
//         id: doc.id,
//         ...doc.data(),
//       }));
//       setPapers(docs);

//       // set a default selection if none yet
//       if (!selectedPaperId && docs.length > 0) {
//         setSelectedPaperId(docs[0].id);
//       }
//     });

//     return () => unsub();
//   }, [projectId, selectedPaperId]);

//   // Update suggestions when draft changes
//   useEffect(() => {
//     setSuggestions(findSuggestions(draft, insights));
//   }, [draft, insights]);

//   const insertCitation = (c) => {
//     const ta = textareaRef.current;
//     if (!ta) return;

//     const pos = ta.selectionStart;
//     const left = draft.slice(0, pos);
//     const right = draft.slice(pos);
//     const token = ` [${c}]`;
//     setDraft(left + token + right);
//     requestAnimationFrame(() => {
//       ta.focus();
//       ta.setSelectionRange(pos + token.length, pos + token.length);
//     });
//   };

//   return (
//     <div className="writing-wrap">
//       {/* MAIN EDITOR */}
//       <section className="editor">
//         <h2>Writing</h2>
//         <textarea
//           ref={textareaRef}
//           value={draft}
//           onChange={(e) => setDraft(e.target.value)}
//           placeholder="Begin drafting... PaperTrail will suggest citations in context."
//           rows={18}
//         />
//       </section>

//       {/* RIGHT SIDEBAR */}
//       <aside className="suggestions">
//         {/* 🔹 Project Papers block */}
//         <div className="project-papers-block">
//           <h3>Project Papers</h3>
//           {!projectId && (
//             <p className="muted">No project selected in the URL.</p>
//           )}
//           {projectId && papers.length === 0 && (
//             <p className="muted">No papers added to this project yet.</p>
//           )}
//           {projectId && papers.length > 0 && (
//             <ul className="paper-mini-list">
//               {papers.map((p) => (
//                 <li
//                   key={p.id}
//                   className={
//                     "paper-mini-item" +
//                     (selectedPaperId === p.id ? " is-selected" : "")
//                   }
//                   onClick={() => setSelectedPaperId(p.id)}
//                 >
//                   <div className="paper-mini-title">
//                     {p.title?.slice(0, 60)}
//                     {p.title && p.title.length > 60 ? "…" : ""}
//                   </div>
//                   <div className="paper-mini-sub">
//                     {p.author || p.sub || p.fileName || "Uploaded PDF"}
//                   </div>
//                 </li>
//               ))}
//             </ul>
//           )}
//         </div>

//         {/* 🔹 Contextual suggestions block */}
//         <h3>Contextual Suggestions</h3>
//         {suggestions.length === 0 && (
//           <p className="muted">Type a sentence to see matches.</p>
//         )}
//         <ul>
//           {suggestions.map((s) => (
//             <li key={s.id} className="sug">
//               <div className="sug-text">“{s.summary || s.quote}”</div>
//               <div className="sug-meta">
//                 {s.citation || "Uncited"} {s.page ? `• p.${s.page}` : ""}
//               </div>
//               <button
//                 onClick={() => insertCitation(s.citation || "Source")}
//                 className="mini"
//               >
//                 Insert Cite
//               </button>
//             </li>
//           ))}
//         </ul>

//         <div className="helper muted">
//           In mid-fi: show “Found in Smith 2022” inline as you type, and attach
//           each insight to a specific paper.
//         </div>
//       </aside>
//     </div>
//   );
// }
/////
/////
/////
/////
/////
/////
/////
/////

export default function WritingPage() {
  const { projectId } = useParams();

  const [draft, setDraft] = useState("");
  const insights = useMemo(() => getInsights(), []);
  const [insightSuggestions, setInsightSuggestions] = useState([]);

  const [papers, setPapers] = useState([]);
  const [paperSuggestions, setPaperSuggestions] = useState([]);
  const textareaRef = useRef(null);

  // subscribe to project papers
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
    });

    return () => unsub();
  }, [projectId]);

  // keep your existing insight-based suggestions
  useEffect(() => {
    setInsightSuggestions(findSuggestions(draft, insights));
  }, [draft, insights]);

  const handleChange = async (e) => {
    const text = e.target.value;
    setDraft(text);

    if (!projectId || papers.length === 0) return;

    const lastChar = text.slice(-1);
    if (![".", ",", ";"].includes(lastChar)) return;

    // tiny guard: skip if too short
    const clause = getLastClause(text);
    if (!clause || clause.length < 10) return;

    console.log("[SUGGEST] Trigger for clause:", clause);

    const suggestions = await fetchPaperSuggestionsFromBackend({
      projectId,
      sentence: clause,
      papers,
    });

    setPaperSuggestions(suggestions);
  };

  const insertCitation = (c) => {
    const ta = textareaRef.current;
    if (!ta) return;

    const pos = ta.selectionStart;
    const left = draft.slice(0, pos);
    const right = draft.slice(pos);
    const token = ` [${c}]`;
    setDraft(left + token + right);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(pos + token.length, pos + token.length);
    });
  };

  return (
    <div className="writing-wrap">
      <section className="editor">
        <h2>Writing</h2>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={handleChange}
          placeholder="Begin drafting... PaperTrail will suggest citations in context."
          rows={18}
        />
      </section>

      <aside className="suggestions">
        {/* 1) Paper-based suggestions */}
        <h3>Papers to Cite</h3>
        {paperSuggestions.length === 0 && (
          <p className="muted">
            Type a sentence and finish with ., , or ; to get suggestions.
          </p>
        )}
        <ul>
          {paperSuggestions.map((p) => (
            <li key={p.paper_id} className="sug">
              <div className="sug-text">{p.title}</div>
              <div className="sug-meta">
                {p.authors || "Unknown authors"} • score {p.score.toFixed(2)}
              </div>
              <button
                className="mini"
                onClick={() =>
                  insertCitation(
                    p.authors ? `${p.authors} (${p.year || "n.d."})` : "Source"
                  )
                }
              >
                Cite
              </button>
            </li>
          ))}
        </ul>

        {/* 2) Your existing insight-based suggestions */}
        <h3>Contextual Insights</h3>
        {insightSuggestions.length === 0 && (
          <p className="muted">
            Type a sentence to see matches from your notes.
          </p>
        )}
        <ul>
          {insightSuggestions.map((s) => (
            <li key={s.id} className="sug">
              <div className="sug-text">“{s.summary || s.quote}”</div>
              <div className="sug-meta">
                {s.citation || "Uncited"} {s.page ? `• p.${s.page}` : ""}
              </div>
              <button
                onClick={() => insertCitation(s.citation || "Source")}
                className="mini"
              >
                Insert Cite
              </button>
            </li>
          ))}
        </ul>

        <div className="helper muted">
          Later: we can merge insight and paper suggestions, and bias toward
          citing papers already in this project.
        </div>
      </aside>
    </div>
  );
}
