// src/components/HomePage/PaperSimilarityTree.jsx
import React, { useMemo } from "react";
import "./PaperSimilarityTree.css";

/**
 * props:
 *  - papers: [{ id, title, ... }]
 *  - similarities: [{
 *        id,
 *        paperId,
 *        similarities: [
 *          { otherPaperId, overall, title, abstract, authors, references }
 *        ]
 *    }]
 *  - metric: "overall" | "title" | "abstract" | "authors" | "references"
 *  - threshold: number (0–1)
 *  - rootPaperId: string | null
 */
export default function PaperSimilarityTree({
  papers,
  similarities,
  metric = "overall",
  threshold = 0.4,
  rootPaperId,
}) {
  const paperMap = useMemo(() => {
    const m = new Map();
    papers.forEach((p) => m.set(p.id, p));
    return m;
  }, [papers]);

  const root = rootPaperId ? paperMap.get(rootPaperId) : null;

  // Build neighbors of the root from similarity docs
  const neighbors = useMemo(() => {
    if (!root) return [];

    // Find the simDoc whose paperId === root.id (or fallback to id)
    const simDoc =
      similarities.find(
        (s) => s.paperId === root.id || s.id === root.id // in case you stored it like that
      ) || null;

    if (!simDoc || !simDoc.similarities) return [];

    return simDoc.similarities
      .map((s) => {
        const other = paperMap.get(s.otherPaperId);
        if (!other) return null;

        const score = s[metric] ?? s.overall;
        if (typeof score !== "number" || score < threshold) return null;

        return {
          paper: other,
          score,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
  }, [root, similarities, paperMap, metric, threshold]);

  // Simple radial layout: root in center, neighbors around
  const layout = useMemo(() => {
    if (!root) return { rootNode: null, neighborNodes: [] };

    const centerX = 200;
    const centerY = 200;
    const radius = 140;

    const rootNode = {
      ...root,
      x: centerX,
      y: centerY,
    };

    const angleStep = neighbors.length
      ? (2 * Math.PI) / neighbors.length
      : 2 * Math.PI;

    const neighborNodes = neighbors.map((n, idx) => {
      const angle = idx * angleStep;
      return {
        ...n,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });

    return { rootNode, neighborNodes };
  }, [root, neighbors]);

  const { rootNode, neighborNodes } = layout;

  if (!papers.length) {
    return (
      <div className="sim-tree-empty">
        Add some papers to this project to see the similarity map.
      </div>
    );
  }

  if (!rootNode) {
    return (
      <div className="sim-tree-empty">
        Select a root paper to view its similarity tree.
      </div>
    );
  }

  return (
    <div className="sim-tree-wrap">
      <svg viewBox="0 0 400 400" className="sim-tree-svg">
        {/* edges from root to neighbors */}
        {neighborNodes.map((n, idx) => (
          <line
            key={idx}
            x1={rootNode.x}
            y1={rootNode.y}
            x2={n.x}
            y2={n.y}
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={0.5 + 2 * n.score}
          />
        ))}

        {/* neighbors */}
        {neighborNodes.map((n, idx) => (
          <g key={n.paper.id}>
            <circle
              cx={n.x}
              cy={n.y}
              r={10}
              fill="white"
              stroke="#666"
              strokeWidth="1"
            />
            <text x={n.x} y={n.y - 14} textAnchor="middle" fontSize="9">
              {shortenTitle(n.paper.title)}
            </text>
            <text
              x={n.x}
              y={n.y + 18}
              textAnchor="middle"
              fontSize="8"
              fill="#555"
            >
              {n.score.toFixed(2)}
            </text>
          </g>
        ))}

        {/* root */}
        <g>
          <circle
            cx={rootNode.x}
            cy={rootNode.y}
            r={16}
            fill="#fff7e6"
            stroke="#ff9800"
            strokeWidth="2"
          />
          <text
            x={rootNode.x}
            y={rootNode.y - 2}
            textAnchor="middle"
            fontSize="10"
          >
            {shortenTitle(rootNode.title, 26)}
          </text>
        </g>
      </svg>

      <div className="sim-tree-legend">
        <p>
          Center = selected paper. Outer nodes = similar papers for
          <b> {metric}</b> (≥ {threshold.toFixed(2)}). Line thickness encodes
          similarity.
        </p>
      </div>
    </div>
  );
}

function shortenTitle(title = "", maxLen = 22) {
  if (!title) return "";
  return title.length > maxLen ? title.slice(0, maxLen - 3) + "…" : title;
}
