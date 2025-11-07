import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getInsights, getPapers, addPaper } from "../../utils/storage";
import "./HomePage.css";

export default function HomePage() {
  const [papers, setPapers] = useState(getPapers());
  const insights = useMemo(() => getInsights().slice(0, 6), []);

  const handleAddPaper = (e) => {
    e.preventDefault();
    const title = prompt("Paper title");
    if (!title) return;
    const authors = prompt("Authors");
    const year = Number(prompt("Year")) || "";
    const url = prompt("PDF URL (optional)") || "";
    const updated = addPaper({ title, authors, year, url });
    setPapers(updated);
  };

  return (
    <div className="home-wrap">
      <div className="row">
        <section className="panel">
          <div className="panel-head">
            <h2>Your Papers</h2>
            <button className="mini-btn" onClick={handleAddPaper}>
              + Add
            </button>
          </div>
          <ul className="list">
            {papers.map((p) => (
              <li key={p.id}>
                <span className="title">{p.title}</span>
                <span className="meta">
                  {p.authors} {p.year ? `(${p.year})` : ""}
                </span>
              </li>
            ))}
          </ul>
          <Link to="/paper" className="link">
            Open Paper Workspace →
          </Link>
        </section>

        <section className="panel">
          <h2>Recent Insights</h2>
          <ul className="list">
            {insights.length === 0 && (
              <li>No insights yet. Create some from the Paper page.</li>
            )}
            {insights.map((i) => (
              <li key={i.id}>
                <span className="title">“{i.quote || i.summary}”</span>
                <span className="meta">
                  {i.citation || "Uncited"} {i.page ? `• p.${i.page}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <Link to="/writing" className="link">
            Go to Writing →
          </Link>
        </section>
      </div>
    </div>
  );
}
