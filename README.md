# Luminal

## Project Description

Luminal is an intelligent routing system for Large Language Model (LLM) requests. Instead of always using the most expensive or powerful model, the gateway analyzes each prompt, considers the user's budget, retrieves relevant context (RAG), and can call external tools (MCP) before deciding which model to use. The goal is to reduce costs while maintaining high quality, and to provide full transparency through logging and a dashboard.

### What It Does

- Accepts user prompts via a simple API.
- Analyzes the complexity and intent of each prompt.
- Retrieves additional context from knowledge bases (RAG) if needed.
- Calls external tools (databases, APIs, etc.) via MCP when required.
- Routes the prompt to the most appropriate model based on complexity, budget, and context.
- Logs every request with cost, tokens, latency, model used, and quality score.
- Provides a dashboard for monitoring usage, costs, and trends.
- Supports 8 LLM providers: OpenAI, Anthropic, DeepSeek, NVIDIA, Mistral, Gemini, OpenRouter, and local Ollama.
- Enforces budget limits and sends alerts when thresholds are crossed.
- Offers caching, retries, and failover for reliability.

### What We Want to Build

We aim to build a production-ready, self-hostable AI gateway that can be used by developers and startups to optimize their LLM usage. The system will combine:

- **LangGraph** for agentic orchestration.
- **RAG** for grounding responses in real documents.
- **MCP** for connecting to external tools.
- **FastAPI** for the backend.
- **Next.js** for the dashboard.
- **PostgreSQL** and **Redis** for storage and caching.

The final product will be a modular, extensible platform that demonstrates modern AI infrastructure skills.

---

## Quick Start

### Option 1 — Docker (easiest)

The repo ships with a `docker-compose.yml` that starts the backend, dashboard, Postgres, Redis, and Chroma together.

Prerequisite: Docker Desktop, or Docker Engine + the Compose plugin.

```bash
git clone <your-repo-url> luminal
cd luminal
cp .env.example .env       # then edit it and add at least one provider key
docker-compose up -d
```

Give it about 30 seconds to seed the database and build the dashboard, then open:

| URL | What it is |
|---|---|
| http://localhost:3000 | Dashboard (frontend) |
| http://localhost:8000 | Backend API |
| http://localhost:8000/docs | Auto-generated FastAPI Swagger docs |

Default login: `admin@admin.com` / `admin` — change this under Settings after your first login.

Stop everything with `docker-compose down`. Stop it AND delete all data with `docker-compose down -v`.

---

### Option 2 — Run locally without Docker

Use this if you want hot-reload while editing the code. Needs two terminals running at the same time.

Prerequisites:
- Python 3.11+
- Node.js 18+
- Postgres 14+ (optional — SQLite works fine for local use, see below)
- Redis 7+ (optional — only used for response caching and rate limiting)
- Chroma (optional — only needed if you want RAG/document search)

Terminal 1 — backend:

```bash
cd luminal
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env       # then edit it and add at least one provider key

python3 -m uvicorn app.main:app --port 8000 --reload
```

The `--reload` flag matters: without it, the backend will not pick up code changes on its own, and you'll have to manually stop and restart it every time you edit a file.

The first time it starts, the backend automatically creates the SQLite database, creates a default admin user, and sets up the default model configs.

Terminal 2 — dashboard:

```bash
cd luminal/dashboard
npm install
npm run dev
```

Dashboard runs at http://localhost:3000.

---

## Configuration

Copy `.env.example` to `.env` in the repo root before starting anything, then fill it in. At minimum you need one provider key to get real answers back (Ollama is free and runs entirely on your own machine, no key needed).

Provider keys can also be added after logging in, via Dashboard → Settings, without restarting the backend — anything saved there applies immediately. Only actual code changes need a restart; `.env` values are only read once, at startup.

---

## Deployment

### Option A — Render (Docker + free-tier Postgres)

The repo includes a ready-to-use `Dockerfile` and a `render.yaml` Blueprint that sets up the backend and a free Postgres database together.

1. Push your repo to GitHub.
2. In Render: New → Blueprint → pick your repo. It reads `render.yaml` and creates the backend service and database for you.
3. Once it's up, open the backend service → Environment, and add at least one provider API key (e.g. `MISTRAL_API_KEY`, `NVIDIA_API_KEY`, `OPENROUTER_API_KEY`).
4. Deploy the dashboard separately (Render Static Site, or Vercel — see Option B below) and point `NEXT_PUBLIC_API_URL` at your Render backend URL.

Things worth knowing about Render's free tier:
- The free Postgres database is deleted after 90 days unless you upgrade it to a paid plan — fine for testing, not for anything long-lived.
- There's no free persistent disk, so if you're using Chroma for RAG, uploaded documents won't survive a redeploy. Either skip RAG on the free tier, or switch `VECTOR_STORE` to `pinecone` (which has a real free tier and doesn't need local disk).
- Redis is optional — the app runs fine without it, it just won't cache responses or rate-limit.
- `DATABASE_URL` from Render's Postgres works as-is now — the backend automatically rewrites a plain `postgres://` or `postgresql://` URL to use the async driver it needs, no manual editing required.

---

### Option B — Split deploy (frontend + backend on separate free-tier hosts)

- Frontend → Vercel (free)
- Backend + Postgres → Render (Option A above) or Railway

Frontend on Vercel:

1. Push your repo to GitHub.
2. Go to vercel.com → New Project → import the repo.
3. Set Root Directory to `dashboard`.
4. Add env var `NEXT_PUBLIC_API_URL` = your backend's public URL, no trailing slash.
5. Deploy.

Backend on Railway (if you'd rather use Railway than Render):

1. Go to railway.app → New Project → Deploy from GitHub repo. Railway auto-detects the `Dockerfile`.
2. Add a PostgreSQL plugin (and optionally Redis).
3. Set env vars on the backend service: `DATABASE_URL` (from the Postgres plugin), `REDIS_URL` (from the Redis plugin, optional), `SECRET_KEY` (`openssl rand -hex 32`), `APP_ENV=production`, `VECTOR_STORE=chroma`.
4. Expose port 8000 and generate a public domain under Settings → Networking.
5. Use that domain as `NEXT_PUBLIC_API_URL` in Vercel.

---

### Option C — Single VPS (DigitalOcean / Hetzner / AWS EC2)

Best for fully self-hosted, everything-on-one-machine production.

```bash
git clone <your-repo-url> luminal && cd luminal
cp .env.example .env && nano .env       # fill in secrets + provider keys
docker-compose up -d
```

Open ports 3000 and 8000 in your firewall, then put a reverse proxy like Caddy in front for HTTPS:

```caddyfile
luminal.yourdomain.com {
    reverse_proxy localhost:3000
}
api.luminal.yourdomain.com {
    reverse_proxy localhost:8000
}
```

Then point the dashboard at the public backend URL:

```yaml
dashboard:
  environment:
    - NEXT_PUBLIC_API_URL=https://api.luminal.yourdomain.com
```

Rebuild with `docker-compose up -d --build dashboard`.

---

## Production checklist

Before pointing real traffic at a Luminal instance:

| Setting | Why |
|---|---|
| `SECRET_KEY` | Long random string: `openssl rand -hex 32` |
| `DATABASE_URL` | Postgres — SQLite is dev-only |
| `REDIS_URL` | Optional, but needed for response caching and rate limiting |
| `NEXT_PUBLIC_API_URL` | Must match the backend's public URL, no trailing slash |
| `ALLOWED_ORIGINS` | CORS — set this to your real frontend domain instead of `*` |
| `DEBUG=false` | Turns off debug output |
| `APP_ENV=production` | Enables stricter validation |
| Provider keys | Add at least one, via dashboard Settings or `.env` |
| Change the `admin` password | First thing to do after your first login |
| HTTPS | Put Caddy, nginx, or Cloudflare in front |
| Backups | Schedule `pg_dump` of Postgres if self-hosted |

---

## Verifying your install

After starting everything:

```bash
# Backend health check
curl http://localhost:8000/health

# Log in (use the default admin creds, or whatever you set)
# Note: this endpoint takes form fields, not JSON
curl -X POST http://localhost:8000/auth/login \
  -d "username=admin@admin.com&password=admin"

# Send a prompt
curl -X POST http://localhost:8000/route \
  -H "Authorization: Bearer <JWT-from-login>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"What is the capital of France?"}'
```

If that last request comes back with a model answer, and it shows up under Dashboard → Logs, everything is wired up correctly.

---

## Phases and Subtasks

### Phase 1: Core Gateway & Basic Routing

**Goal:** Working MVP – user can register, configure models, send a request, get a response, and see basic logs.

#### Subtasks

1. **Project Scaffold** – Initialize repo with FastAPI, Docker, environment config, and folder structure. (done)
2. **Database Models** – Define SQLAlchemy models for `User`, `APIKey`, `ModelConfig`, and `ExecutionLog`. (done)
3. **User & API Key Management** – Implement registration, login, and CRUD endpoints for API keys. (done)
4. **POST /route Endpoint** – Accept user prompt and API key; validate key. (done)
5. **Basic Complexity Scorer** – Use heuristic scoring (prompt length, keywords, question type) to classify low/medium/high. (done)
6. **Router Logic** – Read user’s model mapping (complexity → model name) from DB and choose model. (done)
7. **OpenRouter Client** – Integrate HTTP client to call OpenRouter with selected model; parse response. (done)
8. **Logging** – Save every request to `ExecutionLog` with prompt, model, tokens, cost, latency, timestamp. (done)
9. **Simple Dashboard** – Backend APIs for today’s cost/requests and a minimal Next.js page to display them. (done)
10. **Tests** – Unit tests for complexity scorer, router, and logging. (done)

---

### Phase 2: Multi-Provider, Budget & Caching

**Goal:** Support multiple providers, enforce budgets, add caching and resilience.

#### Subtasks

1. **Provider Abstraction** – Create adapter interface for LLM providers; implement for OpenAI, Anthropic, DeepSeek, Ollama. (done)
2. **Enhanced Complexity Detection** – Replace heuristics with a small ML model or LLM‑as‑judge. (done)
3. **Budget Management** – Add user fields: monthly budget, current spend, projected spend; implement monthly reset. (done)
4. **Budget‑Aware Routing** – Modify router to check budget before selection; force cheaper model if threshold exceeded. (done)
5. **Redis Caching** – Cache responses for identical prompts (hash) and optionally similar prompts using embeddings. (done)
6. **Retry & Fallback** – On failure, retry with exponential backoff; if still fails, try a fallback model. (done)
7. **Streaming Support** – Add Server‑Sent Events (SSE) endpoint for streaming token responses. (done)
8. **Rate Limiting** – Implement Redis‑based rate limiting per API key. (done)
9. **Dashboard Expansion** – Show cost breakdown by model, budget status, and monthly trends. (done)
10. **Integration Tests** – Test multi‑provider routing, budget enforcement, and caching. (done)

---

### Phase 3: RAG Integration & Tool Use (MCP)

**Goal:** Enable retrieval‑augmented generation and external tool calling.

#### Subtasks

1. **Vector Database Setup** – Integrate Chroma (dev) and configurable Pinecone/Weaviate (prod) with embedding model. (done)
2. **Document Ingestion** – Create endpoints/scripts to upload files, chunk text, embed, and store vectors. (done)
3. **Retrieval Module** – Build function that takes a query and returns top‑k relevant chunks with scores. (done)
4. **Context Injection** – In `/route`, detect if query needs external knowledge; if yes, retrieve and prepend to prompt. (done)
5. **MCP Client/Server** – Implement MCP server that can register tools (e.g., weather API, database query). (done)
6. **Tool‑Calling Logic** – Add a decision step (heuristic or LLM) to determine if a tool should be called. (done)
7. **Tool Execution** – Call the selected tool via MCP, capture result, and merge into prompt. (done)
8. **Source Citations** – When RAG is used, append citations to the response and log them. (done)
9. **Logging & Dashboard** – Extend `ExecutionLog` to include retrieval and tool metadata; update dashboard. (done)
10. **Unit Tests** – Test retrieval, tool calling, and context injection. (done)

---

### Phase 4: Agentic Orchestration with LangGraph

**Goal:** Replace linear flow with a stateful agent graph, add self‑reflection and human‑in‑the‑loop.

#### Subtasks

1. **LangGraph State Machine** – Refactor routing pipeline into LangGraph nodes: `analyze` → `retrieve` → `tool` → `route` → `generate`. (done)
2. **Conversation State** – Persist conversation history and context across multiple turns (session management). (done)
3. **Critic Agent** – Add a node that reviews the generated response and scores quality; if low, re‑generate with stronger model. (done)
4. **Human‑in‑the‑Loop** – For high‑risk tool actions (e.g., refund, email), pause and ask for user approval via callback. (done)
5. **Error Recovery** – On tool failure or low confidence, loop back to previous nodes with different parameters. (done)
6. **Tracing** – Integrate LangSmith or OpenTelemetry to log agent decisions and state transitions. (done)
7. **Router Integration** – Make routing decision consider agent state (e.g., previous failures, quality history). (done)
8. **Integration Tests** – Test multi‑step agent workflows, critic loops, and approval flows. (done)
9. **Dashboard Update** – Show agent decision trace and loop counts. (done)
10. **Performance Optimisation** – Cache intermediate agent results to reduce latency. (done)

---

### Phase 5: Production Hardening & Full Dashboard

**Goal:** Make the system secure, observable, and ready for deployment; complete analytics dashboard.

#### Subtasks

1. **Dashboard Authentication** – Add JWT‑based login for dashboard with role‑based access (admin, developer).
2. **API Key Encryption** – Encrypt API keys at rest using AES‑256 and store only ciphertext.
3. **PII Redaction** – Sanitise prompts and logs to remove emails, phone numbers, etc.
4. **Observability Stack** – Expose Prometheus metrics and create Grafana dashboards for request volume, latency, cost.
5. **Error Tracking** – Integrate Sentry for real‑time error alerts and performance monitoring.
6. **Container Orchestration** – Finalize Docker Compose for all services; write Kubernetes manifests (optional).
7. **CI/CD Pipeline** – GitHub Actions workflow for linting, tests, Docker build, and deploy to cloud.
8. **Full Dashboard** – Build analytics views: cost trends, per‑model performance, quality scores, request logs with filters.
9. **Load Testing** – Write k6/Locust scripts to simulate traffic, identify bottlenecks, and optimise caching/pooling.
10. **Documentation** – Write README, API docs, architecture diagram, and a demo script with sample data.
