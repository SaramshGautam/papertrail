// src/components/ForceGraph/ForceGraph.jsx
import React, { useRef, useEffect } from "react";
import * as d3 from "d3";
import "./ForceGraph.css";

export default function ForceGraph({
  papers,
  similarities,
  metric = "overall",
  minScore = 0.2,
  onNodeClick,
}) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!papers || papers.length === 0 || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;

    // Build node list
    const nodes = papers.map((p) => ({
      id: p.id,
      title: p.title,
      author: p.author,
    }));
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // Build links from similarities for selected metric
    const links = (similarities || [])
      .map((sim, idx) => {
        // Normalize paper ids: handle different naming schemes
        const a =
          sim.paperAId ||
          sim.paper1_id ||
          sim.paper1Id ||
          sim.paperA ||
          sim.paper_a;

        const b =
          sim.paperBId ||
          sim.paper2_id ||
          sim.paper2Id ||
          sim.paperB ||
          sim.paper_b;

        // Normalize score field for the selected metric
        const score =
          sim.scores?.[metric] ??
          sim[`${metric}_score`] ?? // e.g. "overall_score"
          sim[metric] ??
          sim[`sim_${metric}`];

        console.log("[FG] similarity doc", idx, {
          sim,
          metric,
          a,
          b,
          score,
        });

        if (!a || !b) {
          console.warn("[FG] missing paper ids in sim", sim);
          return null;
        }

        if (!nodeById.has(a) || !nodeById.has(b)) {
          console.warn("[FG] node not found for ids", { a, b });
          return null;
        }

        if (score == null || Number.isNaN(score) || score < minScore) {
          return null;
        }

        return {
          source: a,
          target: b,
          value: score,
        };
      })
      .filter(Boolean);

    console.log("[FG] built links:", links);

    if (links.length === 0) {
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#888")
        .text("No links for current filter / threshold");
      return;
    }

    svg
      .attr("viewBox", [0, 0, width, height])
      .style("font-family", "system-ui, sans-serif");

    const color = d3.scaleOrdinal(d3.schemeTableau10);

    // Links
    const link = svg
      .append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d) => 1 + (d.value || 0) * 2);

    // Nodes
    const node = svg
      .append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(
        d3
          .drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended)
      )
      .on("click", (event, d) => {
        if (onNodeClick) onNodeClick(d);
      });

    node
      .append("circle")
      .attr("r", 12)
      .attr("fill", (d, i) => color(i));

    node.append("title").text((d) => d.title || d.id);

    node
      .append("text")
      .attr("x", 14)
      .attr("y", "0.31em")
      .attr("font-size", 10)
      .text(
        (d) => (d.title || "").slice(0, 30) + (d.title?.length > 30 ? "…" : "")
      );

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance((d) => 120 - (d.value || 0) * 40)
      )
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(22))
      .on("tick", ticked);

    function ticked() {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    }

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => simulation.stop();
  }, [papers, similarities, metric, minScore, onNodeClick]);

  return <svg ref={svgRef} className="force-graph-svg" />;
}
