import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom"; // 👈 import Link
import ForceGraph from "../ForceGraph/ForceGraph";
import {
  extractPdfMetadata,
  extractPdfTitleAuthorsHeuristic,
} from "../../utils/pdfMeta";
import "./HomePage.css";

import { db, storage } from "../../firebaseConfig";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  increment,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const INGEST_ENDPOINT =
  "https://papertrail-o2guomx2ea-uc.a.run.app/process_papers/urls";
const SIMILARITY_ENDPOINT =
  "https://papertrail-o2guomx2ea-uc.a.run.app/similarity/papers";
// const INGEST_ENDPOINT = "http://127.0.0.1:8000/process_papers/urls";
// const SIMILARITY_ENDPOINT = "http://127.0.0.1:8000/similarity/papers";

async function computeSimilaritiesForProject(projectId, papers) {
  try {
    const payload = {
      project_id: projectId,
      papers: papers.map((p) => ({
        paper_id: p.id,
        title: p.title || "",
        abstract: p.abstract || "",
        references: p.references || "",
        authors: p.author || p.sub || "",
      })),
    };

    console.log("[SIM] Sending payload to backend:", payload);

    const res = await fetch(SIMILARITY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Similarity service returned ${res.status}`);
    }

    const data = await res.json();
    console.log("[SIM] Backend response:", data);
    return data.paper_similarities || [];
  } catch (err) {
    console.error("[SIM] Error calling similarity service", err);
    return [];
  }
}

async function recomputeSimilaritiesForProject(projectId, papers) {
  if (!projectId || !papers || !papers.length) return;

  try {
    console.log("[SIM] Recomputing similarities for project:", projectId);

    const simResults = await computeSimilaritiesForProject(projectId, papers);
    const simCol = collection(db, "projects", projectId, "similarities");

    // delete old similarity docs
    const existing = await getDocs(simCol);
    const deletions = existing.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletions);

    if (!simResults.length) {
      console.log("[SIM] No similarity results returned");
      return;
    }

    // write new similarity docs
    const writes = simResults.map((entry) =>
      addDoc(simCol, {
        ...entry,
        projectId,
        createdAt: serverTimestamp(),
      })
    );

    await Promise.all(writes);
    console.log("[SIM] Saved similarity entries:", simResults.length);
  } catch (err) {
    console.error("[SIM] Error recomputing similarities", err);
  }
}

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
    return data[0] || null;
  } catch (err) {
    console.error("Error calling ingest service", err);
    return null;
  }
}

export default function HomePage() {
  const { projectId } = useParams();

  const [papers, setPapers] = useState([]);
  const [similarities, setSimilarities] = useState([]);
  const [metric, setMetric] = useState("overall");
  const [minScore, setMinScore] = useState(0.4);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [projectInfo, setProjectInfo] = useState(null);

  const prevPaperCountRef = useRef(0);

  //get project name
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

  // Fetch papers
  useEffect(() => {
    if (!projectId) return;

    const papersCol = collection(db, "projects", projectId, "papers");
    const q = query(papersCol, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPapers(docs);

      // pick first as default selection
      if (!selectedPaper && docs.length > 0) {
        setSelectedPaper(docs[0]);
      }
    });

    return () => unsubscribe();
  }, [projectId]);

  // Auto recompute similarities:
  // - once when we first have papers
  // - again whenever the number of papers changes (new paper added / one removed)
  useEffect(() => {
    if (!projectId) return;
    if (!papers.length) return;

    if (prevPaperCountRef.current === papers.length) {
      return;
    }

    prevPaperCountRef.current = papers.length;
    recomputeSimilaritiesForProject(projectId, papers);
  }, [projectId, papers.length, papers]);

  // Fetch similarities
  useEffect(() => {
    if (!projectId) return;

    const simCol = collection(db, "projects", projectId, "similarities");
    const unsub = onSnapshot(simCol, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSimilarities(docs);
    });

    return () => unsub();
  }, [projectId]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

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

    try {
      const storageRef = ref(
        storage,
        `projects/${projectId}/papers/${Date.now()}-${file.name}`
      );
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const papersCol = collection(db, "projects", projectId, "papers");
      const paperRef = await addDoc(papersCol, {
        projectId,
        title,
        sub: author || "Uploaded PDF",
        author,
        subject: meta.subject || "",
        fileName: file.name,
        fileUrl: url,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "projects", projectId), {
        pdfCount: increment(1),
      });

      const ingestResult = await ingestPaperMetadata({
        projectId,
        paperId: paperRef.id,
        fileUrl: url,
      });

      if (ingestResult) {
        const {
          title: parsedTitle,
          authors: parsedAuthors,
          abstract,
          references,
          raw_text_excerpt,
        } = ingestResult;

        await updateDoc(doc(db, "projects", projectId, "papers", paperRef.id), {
          title: parsedTitle || title,
          author: parsedAuthors || author,
          abstract: abstract || null,
          references: references || null,
          rawTextExcerpt: raw_text_excerpt || null,
        });
      }
    } catch (err) {
      console.error("Error uploading file or saving Firestore doc", err);
    }

    e.target.value = "";
  };

  // const handleComputeSimilarities = async () => {
  //   if (!projectId) return;
  //   if (!papers.length) {
  //     console.log("[SIM] No papers to compare");
  //     return;
  //   }

  //   console.log("[SIM] Computing similarities for project:", projectId);

  //   const simResults = await computeSimilaritiesForProject(projectId, papers);
  //   if (!simResults.length) {
  //     console.log("[SIM] No similarity results returned");
  //     return;
  //   }

  //   try {
  //     const simCol = collection(db, "projects", projectId, "similarities");

  //     const writes = simResults.map((entry) =>
  //       addDoc(simCol, {
  //         ...entry,
  //         projectId,
  //         createdAt: serverTimestamp(),
  //       })
  //     );

  //     await Promise.all(writes);
  //     console.log(
  //       "[SIM] Saved similarity entries to Firestore:",
  //       simResults.length
  //     );
  //   } catch (err) {
  //     console.error("[SIM] Error writing similarities to Firestore", err);
  //   }
  // };

  return (
    <div className="home-wrap">
      {/* LEFT RAIL */}
      <aside className="left-rail">
        <div className="rail-topbar">
          {/* <div className="rail-title">Papers</div> */}
          <div className="title">
            {projectInfo?.title ? (
              <>
                <span className="project-name">{projectInfo.title}</span>
              </>
            ) : null}
          </div>

          <label className="icon-btn" title="Add paper pdf">
            ＋
            <input
              type="file"
              accept="application/pdf"
              style={{ display: "none" }}
              onChange={handleUpload}
            />
          </label>

          {/* <button
            className="icon-btn"
            type="button"
            onClick={handleComputeSimilarities}
            title="Compute similarities between papers"
          >
            ⇆
          </button> */}
        </div>

        <ul className="paper-list">
          {papers.map((p) => (
            <li
              key={p.id}
              className={
                "paper-item" +
                (selectedPaper && selectedPaper.id === p.id
                  ? " is-selected"
                  : "")
              }
              onClick={() => setSelectedPaper(p)}
            >
              <div className="avatar" />
              <div className="paper-text">
                <div className="paper-title">{p.title}</div>
                <div className="paper-sub">
                  {p.sub || p.author || "Uploaded Paper PDF"}
                </div>
                {p.abstract && (
                  <div className="paper-abstract">
                    {p.abstract.slice(0, 120)}
                    {p.abstract.length > 120 ? "..." : ""}
                  </div>
                )}
              </div>
              <div className="chev">›</div>
            </li>
          ))}
        </ul>
      </aside>

      {/* RIGHT AREA */}
      <section className="canvas-wrap">
        <div className="topbar">
          <div className="title">Similarity Map</div>

          <div className="topbar-right">
            {/* metric controls */}
            <label className="metric-select">
              Metric:
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
              >
                <option value="overall">Overall</option>
                <option value="title">Title</option>
                <option value="abstract">Abstract</option>
                <option value="authors">Authors</option>
                <option value="references">References</option>
              </select>
            </label>

            <label className="metric-select">
              Similarity Threshold: {minScore.toFixed(2)}
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={minScore}
                onChange={(e) => setMinScore(parseFloat(e.target.value))}
              />
            </label>

            {/* 👇 NEW: navigation to paper + writing views, with projectId */}
            {projectId && (
              <>
                <Link
                  to={`/paper/${projectId}`}
                  className="btn small"
                  title="Open PDF reading + insight capture"
                >
                  Open Papers
                </Link>
                <Link
                  to={`/writing/${projectId}`}
                  className="btn small"
                  title="Open writing workspace for this project"
                >
                  Open Writing
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="canvas-area">
          <ForceGraph
            papers={papers}
            similarities={similarities}
            metric={metric}
            minScore={minScore}
            onNodeClick={(node) => {
              const p = papers.find((pp) => pp.id === node.id);
              if (p) setSelectedPaper(p);
            }}
          />
        </div>
      </section>
    </div>
  );
}
