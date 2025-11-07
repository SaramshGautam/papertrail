import React from "react";
import { Link } from "react-router-dom";
import "./LandingPage.css";

export default function LandingPage() {
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
