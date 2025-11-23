import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./LandingPage.css";

import { db, storage } from "../../firebaseConfig";
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  doc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// 👇 use the same helpers you used on HomePage
import {
  extractPdfMetadata,
  extractPdfTitleAuthorsHeuristic,
} from "../../utils/pdfMeta";

const INGEST_ENDPOINT = "http://127.0.0.1:8000/process_papers/urls";

async function ingestPaperMetadata({ projectId, paperId, fileUrl }) {
  try {
    const res = await fetch(INGEST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        papers: [
          {
            download_url: fileUrl,
            project_id: projectId,
            paper_id: paperId,
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Ingest service returned ${res.status}`);
    }

    const data = await res.json();
    // our Flask endpoint returns a list; we sent only one item
    return data[0] || null;
  } catch (err) {
    console.error("Error calling ingest service", err);
    return null;
  }
}

export default function Landing() {
  const [projects, setProjects] = useState([]);

  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newFiles, setNewFiles] = useState([]);

  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Listen to projects from Firestore
  useEffect(() => {
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProjects(docs);
    });

    return () => unsub();
  }, []);

  const handleFilesChange = (e) => {
    const fileList = Array.from(e.target.files || []);
    setNewFiles(fileList);
  };

  const startEditProject = (project) => {
    setEditingId(project.id);
    setEditTitle(project.title || "");
    setEditDesc(project.desc || "");
  };

  const cancelEditProject = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDesc("");
  };

  const handleUpdateProject = async (e, projectId) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      alert("Title cannot be empty.");
      return;
    }
    try {
      await updateDoc(doc(db, "projects", projectId), {
        title: editTitle.trim(),
        desc: editDesc.trim(),
      });
      cancelEditProject();
    } catch (err) {
      console.error("Error updating project", err);
      alert("Could not update project, check console for details.");
    }
  };

  const resetForm = () => {
    setNewTitle("");
    setNewDesc("");
    setNewFiles([]);
    setIsAdding(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert("Please enter a project title.");
      return;
    }

    try {
      // 1) Create the project document
      const projectRef = await addDoc(collection(db, "projects"), {
        title: newTitle.trim(),
        desc: newDesc.trim(),
        pdfCount: 0, // will update after uploads
        createdAt: serverTimestamp(),
      });

      const projectId = projectRef.id;

      // 2) For each attached PDF:
      let savedCount = 0;

      for (const file of newFiles) {
        try {
          // --- Extract metadata (embedded + heuristic fallback) ---
          let meta = {};
          let heuristic = {};

          try {
            meta = await extractPdfMetadata(file);
          } catch (err) {
            console.error("PDF metadata parse failed", err);
          }

          const hasMetaTitle = meta?.title && meta.title.trim().length > 0;
          const hasMetaAuthor = meta?.author && meta.author.trim().length > 0;

          if (!hasMetaTitle && !hasMetaAuthor) {
            try {
              heuristic = await extractPdfTitleAuthorsHeuristic(file);
            } catch (err) {
              console.error("Heuristic title/author extraction failed", err);
            }
          }

          const title =
            (meta.title && meta.title.trim()) ||
            (heuristic.title && heuristic.title.trim()) ||
            file.name.replace(/\.pdf$/i, "");

          const author =
            (meta.author && meta.author.trim()) ||
            (heuristic.authors && heuristic.authors.trim()) ||
            (heuristic.author && heuristic.author.trim()) ||
            "";

          // --- Upload the file to Storage under this project ---
          const storageRef = ref(
            storage,
            `projects/${projectId}/papers/${Date.now()}-${file.name}`
          );
          await uploadBytes(storageRef, file);
          const fileUrl = await getDownloadURL(storageRef);

          // --- Create a paper doc inside this project's subcollection ---
          // await addDoc(collection(db, "projects", projectId, "papers"), {
          //   projectId,
          //   title,
          //   sub: author || "Uploaded PDF",
          //   author,
          //   subject: meta.subject || "",
          //   fileName: file.name,
          //   fileUrl,
          //   createdAt: serverTimestamp(),
          // });

          const paperRef = await addDoc(
            collection(db, "projects", projectId, "papers"),
            {
              projectId,
              title,
              sub: author || "Uploaded PDF",
              author,
              subject: meta.subject || "",
              fileName: file.name,
              fileUrl,
              createdAt: serverTimestamp(),
            }
          );

          savedCount += 1;

          console.log("[INGEST] Calling backend for paper:", {
            projectId,
            paperId: paperRef.id,
            fileUrl,
          });

          const ingestResult = await ingestPaperMetadata({
            projectId,
            paperId: paperRef.id,
            fileUrl,
          });

          console.log("[INGEST] Backend response:", ingestResult);

          if (ingestResult) {
            const {
              title: parsedTitle,
              authors: parsedAuthors,
              abstract,
              references,
              raw_text_excerpt,
            } = ingestResult;

            // --- Update that paper doc with parsed info ---
            await updateDoc(
              doc(db, "projects", projectId, "papers", paperRef.id),
              {
                // prefer parsed title/authors if they exist
                title: parsedTitle || title,
                author: parsedAuthors || author,
                abstract: abstract || null,
                references: references || null,
                rawTextExcerpt: raw_text_excerpt || null,
              }
            );
          }
        } catch (err) {
          console.error("Error handling a PDF for project", err);
          // continue with next file
        }
      }

      // 3) Update project with the actual number of PDFs attached
      try {
        await updateDoc(doc(db, "projects", projectId), {
          pdfCount: savedCount,
        });
      } catch (err) {
        console.error("Could not update pdfCount", err);
      }

      resetForm();
    } catch (err) {
      console.error("Error adding project", err);
      alert("Could not save project, check console for details.");
    }
  };

  return (
    <div className="landing-wrap">
      <section className="landing-hero">
        <h1>PaperTrail</h1>
        <p className="sub">Read deeply. Capture clearly. Reuse confidently.</p>
        {/* <div className="cta-row">
          <Link to={`/landing`} className="btn primary">
            Go to Home
          </Link>
          <Link to="/paper" className="btn">
            Open Paper Workspace
          </Link>
          <Link to="/writing" className="btn">
            Start Writing
          </Link>
        </div> */}
      </section>

      {/* ===== Project Grid Section ===== */}
      <section className="project-section">
        <h2>Your Projects</h2>
        <div className="project-grid">
          {/* {projects.map((p) => (
            <div key={p.id} className="project-card">
              <h3>{p.title}</h3>
              <p>{p.desc}</p>

              {typeof p.pdfCount === "number" && p.pdfCount > 0 && (
                <p className="project-meta">
                  {p.pdfCount} PDF{p.pdfCount > 1 ? "s" : ""} attached
                </p>
              )}

              <Link to={`/home/${p.id}`} className="open-link">
                Open Project →
              </Link>
            </div>
          ))} */}

          {projects.map((p) => (
            <div key={p.id} className="project-card">
              {/* edit icon – shows on hover */}
              <button
                type="button"
                className="icon-button edit-btn"
                onClick={() => startEditProject(p)}
              >
                <i className="fas fa-pen"></i>
              </button>

              {editingId === p.id ? (
                // EDIT MODE
                <form
                  className="edit-project-form"
                  onSubmit={(e) => handleUpdateProject(e, p.id)}
                >
                  <h3>Edit Project</h3>

                  <label className="field">
                    <span>Title</span>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      required
                    />
                  </label>

                  <label className="field">
                    <span>Description</span>
                    <textarea
                      rows={3}
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                    />
                  </label>

                  <div className="form-actions">
                    <button type="submit" className="btn primary">
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={cancelEditProject}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                // VIEW MODE
                <>
                  <h3>{p.title}</h3>
                  <p>{p.desc}</p>

                  {typeof p.pdfCount === "number" && p.pdfCount > 0 && (
                    <p className="project-meta">
                      {p.pdfCount} PDF{p.pdfCount > 1 ? "s" : ""} attached
                    </p>
                  )}

                  <Link to={`/home/${p.id}`} className="open-link">
                    Open Project →
                  </Link>
                </>
              )}
            </div>
          ))}

          {/* Add New Project Card / Form */}
          {!isAdding ? (
            <div
              className="project-card add-card"
              onClick={() => setIsAdding(true)}
            >
              <div className="add-symbol">＋</div>
              <p>Add New Project</p>
            </div>
          ) : (
            <div className="project-card add-card">
              <form className="add-project-form" onSubmit={handleSubmit}>
                <h3>New Project</h3>

                <label className="field">
                  <span>Title</span>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., CHI 2026 Thesis Project"
                    required
                  />
                </label>

                <label className="field">
                  <span>Description</span>
                  <textarea
                    rows={3}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Short description of what this project is about."
                  />
                </label>

                <label className="field">
                  <span>Attach PDFs</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={handleFilesChange}
                  />
                  {newFiles.length > 0 && (
                    <p className="project-meta">
                      {newFiles.length} PDF
                      {newFiles.length > 1 ? "s" : ""} selected
                    </p>
                  )}
                </label>

                <div className="form-actions">
                  <button type="submit" className="btn primary">
                    Save Project
                  </button>
                  <button type="button" className="btn" onClick={resetForm}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* ===== Features Section ===== */}
      <section className="features-section">
        <h2>Features</h2>
        <div className="landing-grid">
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
        </div>
      </section>
    </div>
  );
}
