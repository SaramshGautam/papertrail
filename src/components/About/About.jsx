import React from "react";
import "./About.css";
import { useNavigate } from "react-router-dom";

export default function About() {
  const navigate = useNavigate();
  return (
    <div className="about-wrap">
      <main className="about-container">
        {/* Hero / Intro */}
        <section className="about-hero">
          <h1>About PaperTrail</h1>
          <p className="about-tagline">
            PaperTrail helps researchers keep track of what they read, why it
            matters, and how it connects to their writing.
          </p>
        </section>

        {/* What it is */}
        <section className="about-section">
          <h2>What is PaperTrail?</h2>
          <p>
            PaperTrail is a lightweight companion for managing your research
            reading and writing workflow. Instead of juggling PDFs, scattered
            notes, and half-remembered highlights, PaperTrail keeps a trace of
            the papers you read, the insights you extract, and the places where
            you plan to use them.
          </p>
          <p>
            The goal is simple: when you sit down to write, you should be able
            to quickly recall{" "}
            <strong>
              what you’ve read, what it said, and why you saved it
            </strong>
            .
          </p>
        </section>

        {/* Key features */}
        <section className="about-section">
          <h2>Key Features</h2>
          <ul className="about-list">
            <li>
              <strong>Centralized paper library</strong> – Store basic metadata
              (title, authors, venue, year) and quick notes in one place.
            </li>
            <li>
              <strong>Structured summaries</strong> – Capture problem, method,
              findings, and your own takeaways in a consistent format.
            </li>
            <li>
              <strong>Writing-aware suggestions</strong> – While you write,
              PaperTrail can surface relevant papers from your library so it’s
              easier to cite what you’ve already read.
            </li>
            <li>
              <strong>Traceable “paper trails”</strong> – See how specific
              papers connect to projects, sections, or ideas over time.
            </li>
            <li>
              <strong>Simple, focused UI</strong> – No dashboard overload. Just
              the tools you need to move from reading to writing.
            </li>
          </ul>
        </section>

        {/* How it fits your workflow */}
        <section className="about-section">
          <h2>How PaperTrail Fits Into Your Workflow</h2>
          <ol className="about-steps">
            <li>
              <strong>Capture</strong> – When you read a paper, log it in
              PaperTrail with a short summary and at least one key quote or
              insight.
            </li>
            <li>
              <strong>Organize</strong> – Group papers by project, topic, or
              section of your manuscript so they’re easy to retrieve later.
            </li>
            <li>
              <strong>Write</strong> – As you draft, PaperTrail can suggest
              relevant papers to cite based on what you’re currently writing.
            </li>
            <li>
              <strong>Trace back</strong> – When you revisit a project, you can
              quickly see which papers informed which parts of your work.
            </li>
          </ol>
        </section>

        {/* Values / principles */}
        <section className="about-section about-highlight">
          <h2>Design Principles</h2>
          <div className="about-pill-grid">
            <div className="about-pill">
              <h3>Keep you in flow</h3>
              <p>
                PaperTrail aims to support your thinking, not interrupt it.
                Interactions are kept minimal so you can stay focused on your
                ideas.
              </p>
            </div>
            <div className="about-pill">
              <h3>Respect your notes</h3>
              <p>
                Your annotations and reflections are first-class citizens. The
                system is built around your interpretations, not just raw
                metadata.
              </p>
            </div>
            <div className="about-pill">
              <h3>Make recall effortless</h3>
              <p>
                When it’s time to write, your previous reading should feel
                searchable, browsable, and ready to plug into arguments.
              </p>
            </div>
          </div>
        </section>

        {/* Footer-ish */}
        <section className="about-section about-footer">
          <h2>What&apos;s Next?</h2>
          <p>
            PaperTrail is evolving. Future directions include deeper integration
            with citation managers, richer visual overviews of your reading
            history, and smarter suggestions that can help you discover gaps or
            connections in your literature review.
          </p>
          <p className="about-callout">
            Have ideas or feedback? We&apos;d love to hear how you manage your
            own paper trail.
          </p>
        </section>

        <section className="about-login-section">
          <button
            className="about-login-btn"
            onClick={() => navigate("/login")}
          >
            Back to Login
          </button>
        </section>
      </main>
    </div>
  );
}
