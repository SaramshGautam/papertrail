import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
// import { getInsights } from "../../utils/storage";
import "./WritingPage.css";

import { db } from "../../firebaseConfig";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  collectionGroup,
  where,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

// const SUGGEST_ENDPOINT = "http://127.0.0.1:8000/suggest_papers";
const SUGGEST_ENDPOINT =
  "https://papertrail-o2guomx2ea-uc.a.run.app/suggest_papers";

function deriveCiteKey(paperLike) {
  const authors = paperLike.authors || "";
  let lastName = "ref";

  if (authors) {
    // take first chunk before "and" or comma
    const firstChunk = authors.split(/and|,/)[0] || authors;
    const tokens = firstChunk.trim().split(/\s+/);
    if (tokens.length) {
      lastName = tokens[tokens.length - 1]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    }
  }

  const yearPart = paperLike.year
    ? String(paperLike.year).replace(/[^0-9]/g, "")
    : "nd";

  return yearPart ? `${lastName}${yearPart}` : lastName;
}

function buildBibtexEntry(key, paperLike) {
  const authors = paperLike.authors || "";
  const title = paperLike.title || "";
  const year = paperLike.year || "n.d.";
  const venue =
    paperLike.venue || paperLike.journal || paperLike.conference || "";
  const type = paperLike.type || "article"; // you can later refine this

  return `@${type}{${key},
  author = {${authors}},
  title = {${title}},
  year = {${year}},
  ${venue ? `journal = {${venue}},\n` : ""}}`;
}

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
    console.log("List of suggested papers:", data.suggested_papers);

    return data.suggested_papers || [];
  } catch (err) {
    console.error("[SUGGEST] error", err);
    return [];
  }
}

export default function WritingPage() {
  const { projectId } = useParams();

  const [projectInfo, setProjectInfo] = useState(null);

  const [draft, setDraft] = useState("");

  const [insights, setInsights] = useState([]);
  const [insightSuggestions, setInsightSuggestions] = useState([]);

  // const insights = useMemo(() => getInsights(), []);
  // const [insightSuggestions, setInsightSuggestions] = useState([]);

  const [papers, setPapers] = useState([]);
  const [paperSuggestions, setPaperSuggestions] = useState([]);
  const [bibtexEntries, setBibtexEntries] = useState([]);

  const textareaRef = useRef(null);

  // listen to BibTeX entries for this project
  useEffect(() => {
    if (!projectId) {
      setBibtexEntries([]);
      return;
    }

    const bibCol = collection(db, "projects", projectId, "bibtex");
    const q = query(bibCol, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setBibtexEntries(docs);
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

  useEffect(() => {
    if (!projectId) {
      setInsights([]);
      return;
    }

    // collectionGroup lets us listen to projects/*/papers/*/insights
    const q = query(
      collectionGroup(db, "insights"),
      where("projectId", "==", projectId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setInsights(docs);
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

    const cursorPos = e.target.selectionStart ?? text.length;
    const uptoCursor = text.slice(0, cursorPos);

    const lastChar = uptoCursor[cursorPos - 1];
    if (lastChar === "}" || lastChar === ".") {
      setPaperSuggestions([]);
      return;
    }

    if (!uptoCursor.endsWith("\\cite{")) {
      return;
    }

    // tiny guard: skip if too short
    const clause = getLastClause(uptoCursor);
    if (!clause || clause.length < 10) return;

    console.log("[SUGGEST] Trigger for \\cite{ with clause:", clause);

    const suggestions = await fetchPaperSuggestionsFromBackend({
      projectId,
      sentence: clause,
      papers,
    });

    setPaperSuggestions(suggestions);
  };

  const handleCiteClick = async (suggestedPaper) => {
    const ta = textareaRef.current;
    if (!ta) return;

    const currentText = draft;
    const pos = ta.selectionStart ?? currentText.length;
    const uptoCursor = currentText.slice(0, pos);
    const afterCursor = currentText.slice(pos);

    // Merge suggestion with Firestore paper (to grab venue, etc. if present)
    const firestorePaper = papers.find((p) => p.id === suggestedPaper.paper_id);
    const mergedPaper = {
      ...suggestedPaper,
      ...firestorePaper,
    };

    // 1) Derive a default citation key
    let defaultKey = deriveCiteKey(mergedPaper);

    // 2) Let the user confirm / edit the key
    const userKey = window.prompt(
      "Citation key for this reference:",
      defaultKey
    );
    const citeKey = (userKey && userKey.trim()) || defaultKey;

    // 3) Replace the last "\cite{" before cursor with "\cite{key}"
    const citeToken = "\\cite{";
    const idx = uptoCursor.lastIndexOf(citeToken);

    let newText;
    let newCursorPos;

    if (idx !== -1) {
      const before = uptoCursor.slice(0, idx);
      // Everything typed after \cite{ up to cursor is discarded and replaced by key
      newText = before + citeToken + citeKey + "}" + afterCursor;
      newCursorPos = (before + citeToken + citeKey + "}").length;
    } else {
      // Fallback: insert a fresh \cite{key}
      newText = uptoCursor + `\\cite{${citeKey}}` + afterCursor;
      newCursorPos = (uptoCursor + `\\cite{${citeKey}}`).length;
    }

    setDraft(newText);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCursorPos, newCursorPos);
    });

    // 4) Build and save BibTeX entry to Firestore
    if (!projectId) return;

    const bibtex = buildBibtexEntry(citeKey, mergedPaper);

    const bibDocRef = doc(db, "projects", projectId, "bibtex", citeKey);

    try {
      await setDoc(
        bibDocRef,
        {
          key: citeKey,
          bibtex,
          title: mergedPaper.title || "",
          authors: mergedPaper.authors || "",
          year: mergedPaper.year || null,
          venue:
            mergedPaper.venue ||
            mergedPaper.journal ||
            mergedPaper.conference ||
            "",
          paperId: mergedPaper.paper_id || mergedPaper.id || null,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
      console.log("[BIBTEX] Saved entry for", citeKey);
    } catch (err) {
      console.error("[BIBTEX] Failed to save entry:", err);
    }
  };

  const groupedInsights = useMemo(() => {
    if (!insights || insights.length === 0) return [];

    const byPaper = new Map();

    insights.forEach((ins) => {
      const paperId = ins.paperId || "unassigned";
      if (!byPaper.has(paperId)) {
        byPaper.set(paperId, []);
      }
      byPaper.get(paperId).push(ins);
    });

    return Array.from(byPaper.entries()).map(([paperId, items]) => {
      const paper = papers.find((p) => p.id === paperId);
      return {
        paperId,
        paperTitle:
          paper?.title ||
          paper?.fileName ||
          (paperId === "unassigned" ? "Unlinked insights" : "Unknown paper"),
        items,
      };
    });
  }, [insights, papers]);

  return (
    <div className="writing-wrap">
      <section className="editor">
        <div className="writing-header">
          <h2>
            Writing
            {projectInfo?.title && (
              <span className="project-title-tag"> • {projectInfo.title}</span>
            )}
          </h2>

          {projectId && (
            <div className="writing-nav-links">
              <Link to={`/paper/${projectId}`} className="chip-link">
                ← Papers
              </Link>
              <Link to={`/home/${projectId}`} className="chip-link">
                Similarity Map
              </Link>
            </div>
          )}
        </div>
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
          // <p className="muted">
          //   Begin a citation with \cite&#123; to view suggested papers from your
          //   project.
          // </p>
          <p className="muted">
            Start Typing. Begin a citation with{" "}
            <span className="code">\cite&#123;</span> to view suggested papers
            from your project.
          </p>
        )}
        <ul>
          {paperSuggestions.map((p) => (
            <li key={p.paper_id} className="sug">
              <div className="sug-text">{p.title}</div>
              <div className="sug-meta">
                {p.authors || "Unknown authors"} • score{" "}
                {p.score != null ? p.score.toFixed(2) : "–"}
              </div>
              <button
                className="mini"
                // onClick={() =>
                //   insertCitation(
                //     p.authors ? `${p.authors} (${p.year || "n.d."})` : "Source"
                //   )
                // }
                onClick={() => handleCiteClick(p)}
              >
                Cite
              </button>
            </li>
          ))}
        </ul>

        {/* 2) Your existing insight-based suggestions */}
        {/* <h3>Contextual Insights</h3>
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
        </ul> */}

        <h3>All Saved Insights by Paper</h3>
        {groupedInsights.length === 0 && (
          <p className="muted">No insights saved for this project yet.</p>
        )}

        <div className="insights-groups">
          {groupedInsights.map((group) => (
            <div key={group.paperId} className="insights-group">
              <div className="insights-group-header">
                <div className="insights-group-title">{group.paperTitle}</div>
                <div className="insights-group-count">
                  {group.items.length} insight
                  {group.items.length > 1 ? "s" : ""}
                </div>
              </div>
              <ul className="insights-group-list">
                {group.items.map((ins) => (
                  <li key={ins.id} className="insight-chip">
                    <div className="insight-quote">
                      “{ins.summary || ins.quote}”
                    </div>
                    <div className="insight-meta">
                      {ins.citation || "Uncited"}{" "}
                      {ins.page ? `• p.${ins.page}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <h3>BibTeX Entries</h3>
        {bibtexEntries.length === 0 && (
          <p className="muted">
            No BibTeX entries saved yet. Use the Cite button to add them.
          </p>
        )}

        <div className="bibtex-section">
          <ul className="bibtex-list">
            {bibtexEntries.map((entry) => {
              const key = entry.key || entry.id;
              const displayRaw =
                entry.raw ||
                `@article{${key},
  title = {${entry.title || "Untitled"}},
  author = {${entry.authors || entry.author || "Unknown"}},
  year = {${entry.year || "n.d."}},
  note = {${entry.venue || entry.journal || entry.conference || ""}}
}`;

              return (
                <li key={entry.id} className="bibtex-item">
                  <div className="bibtex-key">{key}</div>
                  <pre className="bibtex-code">{displayRaw}</pre>
                </li>
              );
            })}
          </ul>
        </div>

        {/* <div className="helper muted">
          Later: we can merge insight and paper suggestions, and bias toward
          citing papers already in this project.
        </div> */}
      </aside>
    </div>
  );
}
