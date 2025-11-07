import React, { useEffect, useMemo, useRef, useState } from "react";
import { getInsights } from "../../utils/storage";
import "./WritingPage.css";

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

export default function WritingPage() {
  const [draft, setDraft] = useState("");
  const insights = useMemo(() => getInsights(), []);
  const [suggestions, setSuggestions] = useState([]);
  const textareaRef = useRef(null);

  useEffect(() => {
    setSuggestions(findSuggestions(draft, insights));
  }, [draft, insights]);

  const insertCitation = (c) => {
    const ta = textareaRef.current;
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
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Begin drafting... PaperTrail will suggest citations in context."
          rows={18}
        />
      </section>

      <aside className="suggestions">
        <h3>Contextual Suggestions</h3>
        {suggestions.length === 0 && (
          <p className="muted">Type a sentence to see matches.</p>
        )}
        <ul>
          {suggestions.map((s) => (
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
          In mid-fi: show “Found in Smith 2022” inline as you type.
        </div>
      </aside>
    </div>
  );
}
