FROM python:3.11-slim

WORKDIR /app

# curl is only needed for the HEALTHCHECK below
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render injects its own PORT (commonly 10000) at runtime — this default
# only applies to local `docker run` / docker-compose, not Render itself.
ENV PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Shell form so ${PORT} is expanded at container start, not build time —
# --reload is a dev-only flag and must not run in production.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
