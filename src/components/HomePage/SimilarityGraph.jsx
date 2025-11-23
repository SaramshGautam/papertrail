import React, { useMemo } from "react";
import "./SimilarityGraph.css";

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
 */
export default function SimilarityGraph({
  papers,
  similarities,
  metric = "overall",
  threshold = 0.4,
}) {
  // Build quick lookup for paper titles
  const paperMap = useMemo(() => {
    const m = new Map();
    papers.forEach((p) => m.set(p.id, p));
    return m;
  }, [papers]);

  // Nodes: just the papers we have
  const nodes = useMemo(() => {
    return papers.map((p, idx) => ({ ...p, index: idx }));
  }, [papers]);

  // Edges from similarity docs
  const edges = useMemo(() => {
    const edgesAccum = [];

    similarities.forEach((simDoc) => {
      const sourceId = simDoc.paperId || simDoc.id;
      const simsArray = simDoc.similarities || [];

      simsArray.forEach((s) => {
        const targetId = s.otherPaperId;
        if (!paperMap.has(sourceId) || !paperMap.has(targetId)) return;

        const weight = s[metric] ?? s.overall;
        if (typeof weight !== "number") return;
        if (weight < threshold) return;

        edgesAccum.push({
          sourceId,
          targetId,
          weight,
        });
      });
    });

    return edgesAccum;
  }, [similarities, paperMap, metric, threshold]);

  // Simple circle layout for nodes
  const layout = useMemo(() => {
    const count = nodes.length;
    if (count === 0) return { positionedNodes: [], edges: [] };

    const centerX = 200;
    const centerY = 200;
    const radius = 140;
    const angleStep = (2 * Math.PI) / count;

    const positionedNodes = nodes.map((n, idx) => {
      const angle = idx * angleStep;
      return {
        ...n,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });

    const nodePos = new Map();
    positionedNodes.forEach((n) => nodePos.set(n.id, n));

    const positionedEdges = edges
      .map((e) => {
        const src = nodePos.get(e.sourceId);
        const tgt = nodePos.get(e.targetId);
        if (!src || !tgt) return null;
        return {
          ...e,
          x1: src.x,
          y1: src.y,
          x2: tgt.x,
          y2: tgt.y,
        };
      })
      .filter(Boolean);

    return { positionedNodes, positionedEdges };
  }, [nodes, edges]);

  const { positionedNodes, positionedEdges } = layout;

  if (papers.length === 0) {
    return (
      <div className="sim-graph-empty">
        Add some papers to see similarities.
      </div>
    );
  }

  return (
    <div className="sim-graph-wrap">
      <svg viewBox="0 0 400 400" className="sim-graph-svg">
        {/* Edges */}
        {positionedEdges.map((e, idx) => (
          <line
            key={idx}
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={0.5 + 2 * e.weight}
          />
        ))}

        {/* Nodes */}
        {positionedNodes.map((n) => (
          <g key={n.id}>
            <circle
              cx={n.x}
              cy={n.y}
              r={10}
              fill="white"
              stroke="black"
              strokeWidth="1"
            />
            <text x={n.x} y={n.y - 14} textAnchor="middle" fontSize="9">
              {shortenTitle(n.title)}
            </text>
          </g>
        ))}
      </svg>

      <div className="sim-graph-legend">
        <p>
          Nodes = papers. Lines = similarity above threshold for <b>{metric}</b>
          .
        </p>
      </div>
    </div>
  );
}

function shortenTitle(title = "", maxLen = 22) {
  if (!title) return "";
  return title.length > maxLen ? title.slice(0, maxLen - 3) + "…" : title;
}
