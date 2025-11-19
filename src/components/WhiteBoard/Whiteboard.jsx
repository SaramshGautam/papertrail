import React, { useRef, forwardRef, useImperativeHandle } from "react";
import { Tldraw } from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";

// 🔧 add below imports (after "@tldraw/tldraw/tldraw.css")

const PADDING = 20;

// Simple canvas measurer (cached)
let _measureCtx;
function measureCtx(font = "16px system-ui") {
  if (!_measureCtx) {
    const c = document.createElement("canvas");
    _measureCtx = c.getContext("2d");
  }
  _measureCtx.font = font;
  return _measureCtx;
}

// Wrap text to width with optional line clamp
function wrapTextToWidth(
  text,
  maxWidthPx,
  { font = "16px system-ui", maxLines } = {}
) {
  const ctx = measureCtx(font);
  const words = (text || "").split(/\s+/);
  const lines = [];
  let line = "";

  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width <= maxWidthPx) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);

  if (maxLines && lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (ctx.measureText(last + "…").width > maxWidthPx && last.length) {
      last = last.slice(0, -1);
    }
    kept[maxLines - 1] = last + "…";
    return kept;
  }
  return lines;
}

const makeId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Math.random().toString(36).slice(2, 10)}`;

// const makeRichText = (str) => ({
//   type: "doc",
//   content: [
//     {
//       type: "paragraph",
//       content: [{ type: "text", text: str }],
//     },
//   ],
// });

const makePaperRichText = (title, authors) => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: title,
          marks: [{ type: "bold" }], // bold title
        },
      ],
    },
    ...(authors
      ? [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: authors,
              },
            ],
          },
        ]
      : []),
  ],
});

const Whiteboard = forwardRef(function Whiteboard(_, ref) {
  const editorRef = useRef(null);
  const paperIndexRef = useRef(new Map());

  const onMount = (editor) => {
    editorRef.current = editor;
    // Hide grid (cross-version safe)
    const style = document.createElement("style");
    style.innerHTML = `.tl-grid{display:none!important}`;
    document.head.appendChild(style);
  };

  const flashRect = (idRect) => {
    const editor = editorRef.current;
    if (!editor || !idRect) return;
    try {
      editor.updateShapes([
        { id: idRect, type: "geo", props: { color: "blue" } },
      ]);
      setTimeout(() => {
        editor.updateShapes([
          { id: idRect, type: "geo", props: { color: "grey" } },
        ]);
      }, 350);
    } catch {}
  };

  // const createPaperCard = async (paper) => {
  //   const editor = editorRef.current;
  //   const vp = editor.getViewportPageBounds?.();
  //   const x =
  //     (vp?.minX ?? 100) + (vp?.width ?? 800) * (0.38 + Math.random() * 0.12);
  //   const y =
  //     (vp?.minY ?? 100) + (vp?.height ?? 600) * (0.34 + Math.random() * 0.12);

  //   const cardW = 300,
  //     baseH = 400;
  //   // cardH = 200;
  //   const innerW = cardW - PADDING * 2;
  //   const idRect = `shape:${makeId()}`;

  //   // 1) rectangle (safe props only)
  //   editor.createShapes([
  //     {
  //       id: idRect,
  //       type: "geo",
  //       x,
  //       y,
  //       rotation: 0,
  //       props: {
  //         w: cardW,
  //         h: baseH,
  //         geo: "rectangle",
  //         color: "grey",
  //         fill: "semi",
  //         dash: "draw",
  //         size: "m",
  //         // text: "HOCUS POCUS"
  //         //   richtext: `${paper.title}\n${paper.sub ?? ""}`,
  //       },
  //     },
  //   ]);

  //   console.log("Created geo shape:", editor.getShape(idRect));

  //   // 2) text via API (avoids schema mismatches)
  //   const textPoint = { x: x + 16, y: y + 16 };
  //   // await editor.putExternalContent({
  //   //   type: "text",
  //   //   text: `${paper.title}\n${paper.sub ?? ""}`,
  //   //   point: textPoint,
  //   // });

  //   // const cardW = 360,
  //   //   cardH = 200;
  //   // const innerW = cardW - PADDING * 2;

  //   // Wrap title + body nicely
  //   const title = paper.title ?? "";
  //   const subtitle = paper.author || paper.sub || "";
  //   // const body = paper.sub ?? "";

  //   const titleLines = wrapTextToWidth(title, innerW, {
  //     font: "16px system-ui",
  //     // maxLines: 2,
  //   });
  //   const subtitleLines = wrapTextToWidth(subtitle, innerW, {
  //     font: "10px system-ui",
  //     // maxLines: 2,
  //   });
  //   // const bodyLines = wrapTextToWidth(body, innerW, {
  //   //   font: "16px system-ui",
  //   //   maxLines: 3,
  //   // });

  //   const lineHTitle = 24;
  //   // const lineHBody = 20;
  //   const lineHSub = 20;
  //   const titleBlockH = titleLines.length * lineHTitle;
  //   const subBlockH = subtitleLines.length * lineHSub;

  //   // const bodyBlockH = bodyLines.length * lineHBody;
  //   // const totalNeeded = PADDING + titleBlockH + 6 + bodyBlockH + PADDING;
  //   const totalNeeded = PADDING + titleBlockH + 6 + subBlockH + PADDING;

  //   // Optionally expand rectangle height if text overflows
  //   if (totalNeeded > baseH) {
  //     editor.updateShapes([
  //       { id: idRect, type: "geo", props: { w: cardW, h: totalNeeded } },
  //     ]);
  //   }

  //   // Insert title + body separately for neat layout
  //   await editor.putExternalContent({
  //     type: "text",
  //     text: titleLines.join("\n"),
  //     point: { x: x + PADDING, y: y + PADDING },
  //   });

  //   await editor.putExternalContent({
  //     type: "text",
  //     text: subtitleLines.join("\n"),
  //     point: { x: x + PADDING, y: y + PADDING + titleBlockH + 8 },
  //   });

  //   // 3) try to group newly created text with the rect
  //   const selected = Array.from(editor.getSelectedShapeIds?.() ?? []);
  //   const textId =
  //     selected[0] ?? Array.from(editor.getCurrentPageShapeIds?.() ?? []).at(-1);

  //   let storedIds = [idRect];
  //   if (textId) storedIds.push(textId);

  //   try {
  //     editor.setSelectedShapes(storedIds);
  //     editor.groupShapes(storedIds);
  //     // after grouping, selection becomes the group
  //     const groupSel = Array.from(editor.getSelectedShapeIds?.() ?? []);
  //     if (groupSel.length === 1) {
  //       storedIds = groupSel; // store the group id
  //     }
  //   } catch {
  //     // grouping not available; keep rect + text ids
  //   }

  //   paperIndexRef.current.set(paper.id, { ids: storedIds, idRect });
  //   // keep it selected so the user sees it
  //   editor.setSelectedShapes(storedIds);
  //   flashRect(idRect);
  // };

  // Public method: create on first time, select afterwards

  const createPaperCard = (paper) => {
    const editor = editorRef.current;
    if (!editor) return;

    const vp = editor.getViewportPageBounds?.();

    const x =
      (vp?.minX ?? 100) + (vp?.width ?? 800) * (0.38 + Math.random() * 0.12);
    const y =
      (vp?.minY ?? 100) + (vp?.height ?? 600) * (0.34 + Math.random() * 0.12);

    const cardW = 300;
    const cardH = 400; // a bit taller so long CHI titles fit better

    const idRect = `shape:${makeId()}`;

    // 1) Create base geo rect
    editor.createShapes([
      {
        id: idRect,
        type: "geo",
        x,
        y,
        rotation: 0,
        props: {
          w: cardW,
          h: cardH,
          geo: "rectangle",
          color: "grey",
          fill: "semi",
          dash: "draw",
          size: "m",
          // note: no text here, we set richText next
        },
      },
    ]);

    // 2) Build label string: title + authors (or fallback)
    const title = paper.title ?? "";
    const authors = paper.author || paper.authors || paper.sub || "";

    const label = authors ? `${title}\n${authors}` : title;

    // 3) Update geo shape to include richText label
    editor.updateShapes([
      {
        id: idRect,
        type: "geo",
        props: {
          richText: makePaperRichText(title, authors),
          align: "start", // left align
          verticalAlign: "start", // top of card
        },
      },
    ]);

    // 4) Store + select + flash
    const storedIds = [idRect];
    paperIndexRef.current.set(paper.id, { ids: storedIds, idRect });
    editor.setSelectedShapes(storedIds);
    flashRect(idRect);
  };

  useImperativeHandle(ref, () => ({
    addOrSelectPaper: async (paper) => {
      const editor = editorRef.current;
      const entry = paperIndexRef.current.get(paper.id);

      if (entry?.ids?.length) {
        // just select/highlight existing
        editor?.setSelectedShapes(entry.ids);
        flashRect(entry.idRect);
        return;
      }
      // first time → create + remember
      await createPaperCard(paper);
    },
    // (optional) a way to forget/reset if you ever need it
    clearIndex: () => paperIndexRef.current.clear(),
  }));

  return (
    <div
      style={{
        position: "absolute",
        inset: 10,
        borderRadius: 8,
        overflow: "hidden",
        backgroundColor: "#e6e7e8",
      }}
    >
      <Tldraw hideUi onMount={onMount} persistenceKey="papertrail-whiteboard" />
    </div>
  );
});

export default Whiteboard;
