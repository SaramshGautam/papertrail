import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./LandingPage.css";

export default function Landing() {
  const [projects, setProjects] = useState([
    {
      id: 1,
      title: "Multimodal Ideation Study",
      desc: "Analyzing design behaviors from collaborative sessions.",
    },
    {
      id: 2,
      title: "LINC Paper Revision",
      desc: "Tracking updates and literature for multilingual meeting tools.",
    },
    {
      id: 3,
      title: "Thesis Reading Notes",
      desc: "Capturing highlights and quotes from core HCI readings.",
    },
  ]);

  const handleAddProject = () => {
    const title = prompt("Enter new project title:");
    if (!title) return;
    const desc = prompt("Short project description:") || "No description yet.";
    const newProject = { id: Date.now(), title, desc };
    setProjects([...projects, newProject]);
  };

  return (
    <div className="landing-wrap">
      <section className="landing-hero">
        <h1>PaperTrail</h1>
        <p className="sub">Read deeply. Capture clearly. Reuse confidently.</p>
        <div className="cta-row">
          <Link to="/home" className="btn primary">
            Go to Home
          </Link>
          <Link to="/paper" className="btn">
            Open Paper Workspace
          </Link>
          <Link to="/writing" className="btn">
            Start Writing
          </Link>
        </div>
      </section>

      {/* ===== Project Grid Section ===== */}
      <section className="project-section">
        <h2>Your Projects</h2>
        <div className="project-grid">
          {projects.map((p) => (
            <div key={p.id} className="project-card">
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
              <Link to="/home" className="open-link">
                Open Project →
              </Link>
            </div>
          ))}

          {/* Add New Project Card */}
          <div className="project-card add-card" onClick={handleAddProject}>
            <div className="add-symbol">＋</div>
            <p>Add New Project</p>
          </div>
        </div>
      </section>

      {/* ===== Features Section ===== */}
      <section className="landing-grid">
        <div className="card">
          <h3>Semantic Search</h3>
          <p>
            Find ideas by meaning and resurface citations with page anchors.
          </p>
        </div>
        <div className="card">
          <h3>Linked Notes</h3>
          <p>Turn highlights into reusable insight cards with provenance.</p>
        </div>
        <div className="card">
          <h3>Contextual Cite</h3>
          <p>Get gentle “Found in Smith 2022” cues while drafting.</p>
        </div>
      </section>
    </div>
  );
}
