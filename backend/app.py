from flask import Flask, request, jsonify
from flask_cors import CORS
from typing import List, Optional, Dict, Any
import tempfile
import requests
import os
from PyPDF2 import PdfReader

from sentence_transformers import SentenceTransformer, util



app = Flask(__name__)
CORS(app)  # allow cross-origin from your React app during dev

# ---------- SentenceTransformer model (global) ----------
# print("[MODEL] Loading sentence-transformers model...")
# st_model = SentenceTransformer("all-MiniLM-L6-v2")
# print("[MODEL] Loaded.")

print("[MODEL] Loading sentence-transformers model from local path...")
st_model = SentenceTransformer("/app/models/all-MiniLM-L6-v2")
print("[MODEL] Loaded.")





# ---------- Utility: download & read PDF ----------

def download_pdf_to_temp(url: str) -> str:
    """
    Download a PDF from a URL into a temporary file.
    Returns the local temp file path.
    """
    print(f"[DOWNLOAD] Attempting to download PDF from URL: {url}")

    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        print(f"[DOWNLOAD] Successfully downloaded {len(resp.content)} bytes")
    except Exception as e:
        print(f"[ERROR] Failed to download PDF: {e}")
        raise ValueError(f"Failed to download PDF from {url}: {e}")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.write(resp.content)
    tmp.flush()
    tmp.close()
    print(f"[DOWNLOAD] Saved temp file at {tmp.name}")
    return tmp.name


def read_pdf_text(pdf_path: str) -> str:
    """
    Extract all text from a PDF using PyPDF2 (basic, but works for many papers).
    """
    print(f"[PDF] Reading PDF: {pdf_path}")
    try:
        reader = PdfReader(pdf_path)
        print(f"[PDF] Number of pages: {len(reader.pages)}")

    except Exception as e:
        print(f"[PDF] Number of pages: {len(reader.pages)}")
        raise ValueError(f"Failed to read PDF at {pdf_path}: {e}")

    texts = []
    for page in reader.pages:
        try:
            texts.append(page.extract_text() or "")
        except Exception:
            continue

    return "\n".join(texts)


# ---------- Heuristic extraction ----------

def extract_structured_info(full_text: str) -> Dict[str, Optional[str]]:
    """
    Very simple heuristic parser for academic PDFs:
    - First line: title
    - Second line (if short-ish): authors
    - 'Abstract' section
    - 'References' / 'Bibliography' section
    """
    print("[INFO] Running structured extraction…")
    print(f"[INFO] First 200 chars of PDF text: {full_text[:200]}")
    lines = [ln.strip() for ln in full_text.splitlines()]
    lines = [ln for ln in lines if ln]  # remove empty lines

    title = None
    authors = None
    abstract = None
    references = None

    # --- Title & authors heuristic ---
    if lines:
        title = lines[0]
    if len(lines) > 1:
        potential_auth = lines[1]
        # crude heuristic: author line has "reasonable" word count
        if 3 <= len(potential_auth.split()) <= 15:
            authors = potential_auth

    # --- Abstract heuristic ---
    lower_lines = [ln.lower() for ln in lines]
    abstract_start_idx = None
    for i, ln in enumerate(lower_lines):
        if ln.startswith("abstract"):
            abstract_start_idx = i
            print(f"[INFO] Found abstract at line {i}")
            break

    if abstract_start_idx is not None:
        abstract_lines = []
        for ln in lines[abstract_start_idx:]:
            lnl = ln.lower()
            if lnl.startswith("keywords") or lnl.startswith("index terms"):
                break
            # stop at a numbered section header like "1 Introduction"
            if lnl.startswith("1 ") or lnl.startswith("i. "):
                break
            abstract_lines.append(ln)
        abstract = " ".join(abstract_lines).strip()

    # --- References heuristic ---
    ref_idx = None
    for i, ln in enumerate(lower_lines):
        if ln.startswith("references") or ln.startswith("bibliography"):
            print(f"[INFO] Found References at line {i}")
            ref_idx = i
            break

    if ref_idx is not None:
        references = "\n".join(lines[ref_idx:])

    return {
        "title": title,
        "authors": authors,
        "abstract": abstract,
        "references": references,
    }


# ---------- "Storage" stub ----------

def save_paper_record(record: Dict[str, Any]):
    """
    Placeholder for saving to Firestore / DB / etc.
    For now it just prints. Replace with actual Firestore logic later.
    """
    print("--- Saving paper record ---")
    for k, v in record.items():
        if isinstance(v, str) and len(v) > 200:
            print(f"{k}: {v[:200]} ... (truncated)")
        else:
            print(f"{k}: {v}")
    print("[DB] Save complete.\n")


# ---------- Endpoints ----------

@app.route("/", methods=["POST"])
def home():
    return {"status": "running", "message": "PaperTrail is running and alive" }

@app.route("/suggest_papers", methods=["POST"])
def suggest_papers():
    """
    POST JSON:
    {
      "project_id": "abc123",
      "sentence": "the user just wrote this clause...",
      "papers": [
        {
          "paper_id": "paperDocId",
          "title": "...",
          "abstract": "...",
          "authors": "Smith et al.",
          "year": 2022
        },
        ...
      ]
    }
    """
    print("\n====== [API HIT] /suggest_papers ======")
    data = request.get_json(silent=True) or {}
    print(f"[SUGGEST] Raw JSON body: {data}")
    project_id = data.get("project_id")
    sentence = data.get("sentence", "").strip()
    papers = data.get("papers", [])

    print(f"[SUGGEST] project_id: {project_id}")
    print(f"[SUGGEST] sentence: {sentence!r}")
    print(f"[SUGGEST] num papers: {len(papers)}")

    if not sentence or not papers:
        print("[SUGGEST][ERROR] Missing sentence or papers list")
        return jsonify({"error": "Need sentence and papers list"}), 400

    # texts to compare against (abstracts; fallback to title if missing)
    # abstracts = [
    #     (p["paper_id"], p.get("abstract") or p.get("title") or "")
    #     for p in papers
    # ]
    abstracts = []
    for p in papers:
        pid = p.get("paper_id")
        text = p.get("abstract") or p.get("title") or ""
        abstracts.append((pid, text))

    print(f"[SUGGEST] Built abstracts list of length {len(abstracts)}")
    if abstracts:
        print("[SUGGEST] First abstract snippet:",
              abstracts[0][1][:200].replace("\n", " "))

    # encode
    print("[SUGGEST] Encoding query sentence...")
    query_emb = st_model.encode(sentence, convert_to_tensor=True)
    # corpus_embs = st_model.encode([a[1] for a in abstracts], convert_to_tensor=True)
    print("[SUGGEST] Encoding abstracts...")
    corpus_texts = [a[1] for a in abstracts]
    corpus_embs = st_model.encode(corpus_texts, convert_to_tensor=True)

    print("[SUGGEST] Computing cosine similarities...")
    cos_scores = util.cos_sim(query_emb, corpus_embs)[0]  # 1 x N -> vector

    scored = []
    for (paper_id, text), score in zip(abstracts, cos_scores):
        scored.append({
            "paper_id": paper_id,
            "score": float(score),
        })

    print(f"[SUGGEST] Got {len(scored)} scores. Example:", 
          scored[0] if scored else "None")
    
    # sort desc, take top K
    scored.sort(key=lambda x: x["score"], reverse=True)
    top_k = scored[:5]
    print("[SUGGEST] Top-k scored papers:", top_k)

    # enrich with metadata from original list
    paper_by_id = {p["paper_id"]: p for p in papers}
    results = []
    for item in top_k:
        p = paper_by_id.get(item["paper_id"])
        if not p:
          continue
        results.append({
          "paper_id": p["paper_id"],
          "title": p.get("title"),
          "authors": p.get("authors"),
          "abstract": p.get("abstract"),
          "score": item["score"],
        })

    print("[SUGGEST] Top-k scored papers:", top_k)

    resp = {
        "project_id": project_id,
        "sentence": sentence,
        "suggested_papers": results,
    }
    print("[SUGGEST] Sending response:", resp)

    return jsonify(resp), 200


@app.route("/similarity/papers", methods=["POST"])
def compute_paper_similarities():
    """
    POST JSON:
    {
      "project_id": "abc123",
      "papers": [
        {
          "paper_id": "paperDocId1",
          "title": "Some title",
          "abstract": "Abstract text…",
          "references": "References text…",
          "authors": "Alice; Bob"
        },
        ...
      ]
    }

    Returns:
    {
      "project_id": "abc123",
      "paper_similarities": [
        {
          "paper1_id": "paperDocId1",
          "paper2_id": "paperDocId2",
          "title_score": 0.92,
          "abstract_score": 0.81,
          "references_score": 0.40,
          "authors_score": 0.67,
          "overall_score": 0.70
        },
        ...
      ]
    }
    """
    print("\n====== [API HIT] /similarity/papers ======")
    data = request.get_json(silent=True)
    print(f"[REQUEST] JSON: {data}")

    if not data or "papers" not in data:
        return jsonify({"error": "Expected 'project_id' and 'papers'"}), 400

    project_id = data.get("project_id")
    papers = data.get("papers", [])
    if not papers or len(papers) < 2:
        return jsonify({
            "project_id": project_id,
            "paper_similarities": []
        }), 200

    # Prepare text fields for each category
    paper_ids = [p.get("paper_id") for p in papers]
    titles = [p.get("title") or "" for p in papers]
    abstracts = [p.get("abstract") or "" for p in papers]
    references = [p.get("references") or "" for p in papers]
    authors = [p.get("authors") or "" for p in papers]

    print(f"[INFO] Computing embeddings for {len(papers)} papers")

    def embed(texts):
        # SentenceTransformer returns a tensor when convert_to_tensor=True
        return st_model.encode(
            texts,
            convert_to_tensor=True,
            normalize_embeddings=True
        )

    # Compute embeddings per category
    title_emb = embed(titles)
    abstract_emb = embed(abstracts)
    refs_emb = embed(references)
    authors_emb = embed(authors)

    # Cosine similarity matrices
    title_sim = util.cos_sim(title_emb, title_emb)        # NxN
    abstract_sim = util.cos_sim(abstract_emb, abstract_emb)
    refs_sim = util.cos_sim(refs_emb, refs_emb)
    authors_sim = util.cos_sim(authors_emb, authors_emb)

    # Build pairwise results (upper triangle only, i < j)
    n = len(papers)
    pairwise = []
    for i in range(n):
        for j in range(i + 1, n):
            t = float(title_sim[i, j])
            a = float(abstract_sim[i, j])
            r = float(refs_sim[i, j])
            au = float(authors_sim[i, j])

            overall = (t + a + r + au) / 4.0  # simple average; tweak if needed

            entry = {
                "paper1_id": paper_ids[i],
                "paper2_id": paper_ids[j],
                "title_score": t,
                "abstract_score": a,
                "references_score": r,
                "authors_score": au,
                "overall_score": overall,
            }
            pairwise.append(entry)

    print(f"[INFO] Computed {len(pairwise)} pairwise similarities")
    return jsonify({
        "project_id": project_id,
        "paper_similarities": pairwise
    }), 200


@app.route("/process_papers/urls", methods=["POST"])
def process_papers_from_urls():
    """
    POST JSON:
    {
      "papers": [
        {
          "download_url": "https://...",
          "project_id": "project123",
          "paper_id": "paperDocId"
        },
        ...
      ]
    }
    """
    print("\n====== [API HIT] /process_papers/urls ======")
    data = request.get_json(silent=True)
    print(f"[REQUEST] Received JSON: {data}")

    if not data or "papers" not in data:
        print("[ERROR] Missing 'papers' in request")
        return jsonify({"error": "Expected JSON body with 'papers' list"}), 400

    results: List[Dict[str, Any]] = []

    for idx, paper in enumerate(data["papers"]):
        print(f"\n------ Processing Paper #{idx+1} ------")
        print(f"[INPUT] Paper entry: {paper}")
        download_url = paper.get("download_url")
        project_id = paper.get("project_id")
        paper_id = paper.get("paper_id")

        if not download_url:
            # skip or return error; here we skip
            print("[WARN] Missing download_url — skipping entry")
            continue

        try:
          pdf_path = download_pdf_to_temp(download_url)
          full_text = read_pdf_text(pdf_path)
          info = extract_structured_info(full_text)
        except ValueError as e:
          # If one fails, we still try to process others
          print(f"[ERROR] Failed to process: {e}")
          results.append({
              "project_id": project_id,
              "paper_id": paper_id,
              "download_url": download_url,
              "error": str(e),
          })
          continue

        record = {
            "project_id": project_id,
            "paper_id": paper_id,
            "download_url": download_url,
            "title": info.get("title"),
            "authors": info.get("authors"),
            "abstract": info.get("abstract"),
            "references": info.get("references"),
            "raw_text_excerpt": full_text[:2000],  # optional debug
        }

        save_paper_record(record)
        results.append(record)

    print("\n====== [API RESPONSE READY] ======")
    return jsonify(results), 200


@app.route("/process_papers/files", methods=["POST"])
def process_papers_from_files():
    """
    Accepts multipart/form-data:
      - files: one or more uploaded PDFs (field name "files")
      - project_id: optional text field

    Example with curl:
      curl -X POST http://localhost:8000/process_papers/files \
        -F "project_id=project123" \
        -F "files=@paper1.pdf" \
        -F "files=@paper2.pdf"
    """

    print("\n====== [API HIT] /process_papers/files ======")
    print("[REQUEST] Form fields:", request.form)
    print("[REQUEST] Files received:", request.files)

    project_id = request.form.get("project_id")
    files = request.files.getlist("files")

    if not files:
        print("[ERROR] No files uploaded")
        return jsonify({"error": "No files uploaded under 'files' field"}), 400

    results = []

    for idx, f in enumerate(files):

        if not f or f.filename == "":
            continue

        print(f"\n------ Processing Uploaded PDF #{idx+1} ------")
        print(f"[FILE] Name: {f.filename}")
        # Save upload to temp
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        tmp.write(f.read())
        tmp.flush()
        tmp.close()
        print(f"[FILE] Saved temp copy at {tmp.name}")

        try:
            full_text = read_pdf_text(tmp.name)
            info = extract_structured_info(full_text)
        except ValueError as e:
            print(f"[ERROR] Failed: {e}")
            results.append({
                "project_id": project_id,
                "paper_id": None,
                "filename": f.filename,
                "error": str(e),
            })
            continue

        record = {
            "project_id": project_id,
            "paper_id": None,
            "download_url": None,
            "filename": f.filename,
            "title": info.get("title"),
            "authors": info.get("authors"),
            "abstract": info.get("abstract"),
            "references": info.get("references"),
            "raw_text_excerpt": full_text[:2000],
        }

        save_paper_record(record)
        results.append(record)

    print("\n====== [API RESPONSE READY] /files ======")
    return jsonify(results), 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)

