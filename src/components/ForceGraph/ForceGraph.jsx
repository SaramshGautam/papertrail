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
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!papers || papers.length === 0 || !svgRef.current) return;

    const svgEl = svgRef.current;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const containerEl = svgEl.parentNode;
    const container = d3.select(containerEl);

    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;

    // Tooltip selection
    const tooltip = container
      .append("div")
      .attr("class", "fg-tooltip")
      .style("opacity", 0);

    function moveTooltip(event) {
      const rect = containerEl.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      tooltip.style("left", `${x + 14}px`).style("top", `${y + 14}px`);
    }

    // Build node list (include abstract so we can show it on hover)
    const nodes = papers.map((p) => ({
      id: p.id,
      title: p.title,
      author: p.author || p.sub,
      abstract: p.abstract || "",
    }));
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // Build links from similarities for selected metric
    const links = (similarities || [])
      .map((sim, idx) => {
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

        const score =
          sim.scores?.[metric] ??
          sim[`${metric}_score`] ??
          sim[metric] ??
          sim[`sim_${metric}`];

        if (!a || !b) return null;
        if (!nodeById.has(a) || !nodeById.has(b)) return null;
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

    if (links.length === 0) {
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#9ca3af")
        .text("No links for current filter / threshold");
      return;
    }

    svg
      .attr("viewBox", [0, 0, width, height])
      .style(
        "font-family",
        "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
      );

    const color = d3.scaleOrdinal(d3.schemeTableau10);

    // Links
    const link = svg
      .append("g")
      .attr("stroke", "#4b5563")
      .attr("stroke-opacity", 0.4)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d) => 0.8 + (d.value || 0) * 2);

    // Nodes
    const node = svg
      .append("g")
      .attr("stroke", "#6C584C")
      .attr("stroke-width", 1.2)
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
      })
      .on("mouseover", (event, d) => {
        // Highlight node + links a bit
        d3.select(event.currentTarget)
          .select("circle")
          .attr("stroke-width", 2)
          .attr("stroke", "#fbbf24");

        link.attr("stroke-opacity", (l) =>
          l.source.id === d.id || l.target.id === d.id ? 0.9 : 0.15
        );

        const abstractSnippet = d.abstract
          ? d.abstract.slice(0, 220) + (d.abstract.length > 220 ? "…" : "")
          : "No abstract available.";

        tooltip.style("opacity", 1).html(
          `<div class="fg-tooltip-title">${d.title || "Untitled paper"}</div>
             <div class="fg-tooltip-author">${
               d.author || "Unknown author"
             }</div>
             <div class="fg-tooltip-abstract">${abstractSnippet}</div>`
        );
        moveTooltip(event);
        // .style("left", event.pageX + 16 + "px")
        // .style("top", event.pageY + 16 + "px");
      })
      .on("mousemove", (event) => {
        tooltip;
        // .style("left", event.pageX + 16 + "px")
        // .style("top", event.pageY + 16 + "px");
        moveTooltip(event);
      })
      .on("mouseout", (event) => {
        d3.select(event.currentTarget)
          .select("circle")
          .attr("stroke-width", 1.2)
          .attr("stroke", "#6C584C");

        link.attr("stroke-opacity", 0.4);
        tooltip.style("opacity", 0);
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
      .attr("fill", "#e5e7eb")
      .text(
        (d) => (d.title || "").slice(0, 26) + (d.title?.length > 26 ? "…" : "")
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
      .force("charge", d3.forceManyBody().strength(-140))
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

    // return () => simulation.stop();
    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [papers, similarities, metric, minScore, onNodeClick]);

  return (
    <div className="force-graph-container">
      <svg ref={svgRef} className="force-graph-svg" />
      <div ref={tooltipRef} className="fg-tooltip" />
    </div>
  );
}
