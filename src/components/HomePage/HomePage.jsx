import React, { useState, useRef } from "react";
import Whiteboard from "../WhiteBoard/Whiteboard";
import papers from "../../data/papers.json";
import {
  extractPdfMetadata,
  extractPdfTitleAuthorsHeuristic,
} from "../../utils/pdfMeta";
import "./HomePage.css";

export default function HomePage() {
  const wbRef = useRef(null);

  const [uploadedPaper, setUploadedPaper] = useState([]);

  // const addPaperToCanvas = (p) => {
  //   const text = `${p.title}\n${p.sub}`;
  //   wbRef.current?.addPaperCard(text);
  // };

  const onPaperClick = (p) => {
    wbRef.current?.addOrSelectPaper(p);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

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
        console.error("Heuristic title/author extarction failed", err);
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

    //1. preview or parse file name

    const newPaper = {
      id: `paper-${Date.now()}`,
      title,
      sub: author || "Uploaded PDF",
      author,
      subject: meta.subject || "",
      file,
    };

    // const newPaper = {
    //   id: `paper-${Date.now()}`,
    //   title: meta.title || file.name.replace(/\.pdf$/i, ""),
    //   sub: meta.author || "Uploaded PDF",
    //   author: meta.author || "",
    //   subject: meta.subject || "",
    //   file,
    // };
    setUploadedPaper((prev) => [newPaper, ...prev]);

    // immediately drop it onto canvas
    wbRef.current?.addOrSelectPaper(newPaper);

    e.target.value = "";
  };

  const allPapers = [...uploadedPaper, ...papers];

  return (
    <div className="home-wrap">
      {/* LEFT RAIL */}
      <aside className="left-rail">
        <div className="rail-topbar">
          <div className="rail-title">Papers</div>
          {/* <button className="icon-btn" title="Add paper">
            ＋
          </button> */}

          <label className="icon-btn" title="Add paper pdf">
            ＋
            <input
              type="file"
              accept="application/pdf"
              style={{ display: "none" }}
              onChange={handleUpload}
            />
          </label>
        </div>

        <ul className="paper-list">
          {allPapers.map((p) => (
            <li
              key={p.id}
              className="paper-item"
              onClick={() => onPaperClick(p)}
            >
              <div className="avatar" />
              <div className="paper-text">
                <div className="paper-title">{p.title}</div>
                <div className="paper-sub">
                  {p.sub || p.author || "Uploaded Paper PDF"}
                </div>
              </div>
              <div className="chev">›</div>
            </li>
          ))}
        </ul>
      </aside>

      {/* RIGHT CANVAS AREA */}
      <section className="canvas-wrap">
        <div className="topbar">
          <div className="title">Mind Map</div>

          <div className="topbar-right">
            <div className="search">
              <span className="search-icon">🔍</span>
              <input placeholder="Search" />
            </div>
            <div className="profile-badge" title="Account" />
          </div>
        </div>

        <div className="canvas-area">
          <Whiteboard ref={wbRef} />
        </div>

        <button className="write-cta">✍︎ Write</button>
      </section>
    </div>
  );
}
