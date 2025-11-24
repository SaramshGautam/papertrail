FROM python:3.11

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN python -c "from sentence_transformers import SentenceTransformer; m = SentenceTransformer('all-MiniLM-L6-v2'); m.save('/app/models/all-MiniLM-L6-v2')"

COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["sh","-c","gunicorn -w ${GUNICORN_WORKERS:-2} --threads ${GUNICORN_THREADS:-8} --timeout ${GUNICORN_TIMEOUT:-120} --bind :${PORT:-8080} --access-logfile - --error-logfile - app:app"]
