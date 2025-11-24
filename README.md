# 📄 PaperTrail Backend

PaperTrail is a Flask-based backend service that provides PDF ingestion, text extraction, academic metadata parsing, embedding-based paper recommendation, and pairwise paper similarity computation. It is designed to work with the PaperTrail React frontend for assisting researchers in writing, storing, and discovering papers relevant to their projects.

---

## 🚀 Features

### 1. PDF Processing

- Download PDFs from URLs or accept direct file uploads
- Extract text using PyPDF2
- Heuristically parse:
  - Title
  - Authors
  - Abstract
  - References

### 2. Paper Recommendation (`/suggest_papers`)

- Suggest relevant papers based on a sentence or clause the user just typed
- Uses a preloaded **SentenceTransformer (MiniLM-L6-v2)** model baked into the Docker image
- Computes cosine similarity between sentence embedding and paper abstracts

### 3. Pairwise Paper Similarity (`/similarity/papers`)

- Compare multiple papers on:
  - Title similarity
  - Abstract similarity
  - Reference similarity
  - Author similarity
- Returns an overall composite similarity score

### 4. Fully Dockerized & Cloud Run Ready

- Model is baked into the Docker image to avoid HuggingFace runtime downloads
- Runs on Gunicorn for production scalability
- Designed for Cloud Run autoscaling

---

## 📦 Requirements

Your `requirements.txt` should include:

```
flask
flask-cors
requests
PyPDF2
sentence-transformers
gunicorn
```

The model is **pre-downloaded during Docker build**, so Cloud Run never hits HuggingFace.

---

## 🛠️ Local Development

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the Flask server locally

```bash
python app.py
```

### 3. Test health endpoint

```bash
curl -X POST http://localhost:8080/
```

---

## 🐳 Docker Usage

### 1. Build Docker image (linux/amd64)

```bash
docker buildx build --platform=linux/amd64 -t papertrail-backend .
```

### 2. Run locally

```bash
docker run -p 8080:8080 papertrail-backend
```

---

## ☁️ Deploying to Cloud Run

### 1. Login & configure

```bash
gcloud auth login
gcloud config set project papertrail-479206
gcloud auth configure-docker gcr.io
```

### 2. Push image

```bash
docker push gcr.io/papertrail-479206/papertrail
```

### 3. Deploy

```bash
gcloud run deploy papertrail \
  --image gcr.io/papertrail-479206/papertrail \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory=1Gi \
  --set-env-vars GUNICORN_WORKERS=1,GUNICORN_THREADS=2
```

---

# 📡 API Endpoints

---

## POST `/`

Health check.

**Response**

```json
{
  "status": "running",
  "message": "PaperTrail is running and alive"
}
```

---

## POST `/suggest_papers`

Returns top-k relevant papers for a user-typed sentence.

### Request

```json
{
  "project_id": "abc123",
  "sentence": "Collaborative ideation in multilingual settings",
  "papers": [
    {
      "paper_id": "p1",
      "title": "Multilingual Collaboration",
      "abstract": "...",
      "authors": "Smith et al.",
      "year": 2023
    }
  ]
}
```

### Response

```json
{
  "project_id": "abc123",
  "sentence": "Collaborative ideation...",
  "suggested_papers": [
    {
      "paper_id": "p1",
      "title": "Multilingual Collaboration",
      "authors": "Smith et al.",
      "abstract": "...",
      "score": 0.83
    }
  ]
}
```

---

## POST `/similarity/papers`

Computes pairwise similarity between multiple papers.

### Request

```json
{
  "project_id": "abc",
  "papers": [
    { "paper_id": "1", "title": "AI Creativity", "abstract": "AI helps..." },
    { "paper_id": "2", "title": "Machine Learning", "abstract": "ML models..." }
  ]
}
```

### Response

```json
{
  "project_id": "abc",
  "paper_similarities": [
    {
      "paper1_id": "1",
      "paper2_id": "2",
      "title_score": 0.62,
      "abstract_score": 0.74,
      "references_score": 0.21,
      "authors_score": 0.5,
      "overall_score": 0.52
    }
  ]
}
```

---

## POST `/process_papers/urls`

Downloads and processes papers from URLs.

---

## POST `/process_papers/files`

Processes uploaded PDF files.

---

# 🧱 Project Structure

```
backend/
│
├── app.py                 # Main Flask API
├── requirements.txt       # Python dependencies
├── Dockerfile             # Cloud Run-ready image build
├── models/                # Pre-baked SentenceTransformers model
└── ...
```

---

# ⚠️ Troubleshooting

### 1. Model download errors (429 Too Many Requests from HF)

Cause: Cloud Run container tries downloading model on cold start  
Fix: Bake model into image (included in Dockerfile instructions above)

---

### 2. Out of Memory (OOM / SIGKILL from Gunicorn)

Fix:

- Set Cloud Run memory to ≥ 1Gi
- Set `GUNICORN_WORKERS=1`, `GUNICORN_THREADS=2`

---

### 3. Unauthenticated Docker push

Run:

```bash
gcloud auth configure-docker gcr.io
```

---

# 📬 Contact

If you’re integrating this backend with the PaperTrail React app or need help customizing embeddings or PDF extraction, feel free to reach out!
