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
- Supports multiple LLM providers (OpenAI, Anthropic, DeepSeek, Ollama, etc.).
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

## 🚀 Quick Start

### Option 1 — Docker (easiest, recommended)

The repo ships with a `docker-compose.yml` that boots the backend, dashboard, Postgres, Redis, and Chroma together.

**Prerequisites:** Docker Desktop (or Docker Engine + Compose plugin) installed.

```bash
# 1. Clone the repo
git clone <your-repo-url> luminal
cd luminal

# 2. (Optional) edit .env with at least one provider key
cp .env.example .env       # or just create .env — see "Configuration" below

# 3. Start everything
docker-compose up -d
```

Wait ~30 seconds for the backend to seed the DB and the dashboard to build. Then open:

| URL | What it is |
|---|---|
| http://localhost:3000 | Dashboard (frontend) |
| http://localhost:8000 | Backend API |
| http://localhost:8000/docs | Auto-generated FastAPI Swagger docs |

**Default login:** `admin@admin.com` / `admin` — change this immediately under Settings after first login.

Stop everything with `docker-compose down`. Wipe all data with `docker-compose down -v`.

---

### Option 2 — Run locally without Docker

Useful if you want hot-reload while hacking on the code.

**Prerequisites:**
- Python 3.11+
- Node.js 18+
- Postgres 14+ (or just use SQLite for quick experimentation — see `.env` below)
- Redis 7+ (optional but recommended — response cache)
- Chroma (optional — only needed for RAG)

#### Terminal 1 — backend

```bash
cd luminal

# Create venv and install deps
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create your .env (see "Configuration" below for what to put)
cp .env.example .env

# Start the backend with hot-reload
python3 -m uvicorn app.main:app --port 8000 --reload
```

> ⚠️ **The `--reload` flag matters.** Without it, the backend won't pick up code changes and you'll have to manually stop and restart it every time you edit a file.

On first start, the backend auto-creates the SQLite database, seeds a default admin user, and registers the default model configs.

#### Terminal 2 — dashboard

```bash
cd luminal/dashboard
npm install
npm run dev
```

Dashboard runs at http://localhost:3000.

---

## ⚙️ Configuration

Create a `.env` file in the repo root before starting anything. At minimum you need **one provider key** to send real prompts (Ollama is free and runs locally).

```bash
# .env

# ── Required for JWT signing in production ─────────────────
SECRET_KEY=replace-me-with-openssl-rand-hex-32

# ── Database ──────────────────────────────────────────────
# Dev (default — file-based, no setup needed):
DATABASE_URL=sqlite+aiosqlite:///./luminal.db
# Prod (Postgres):
# DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/luminal

# ── Redis (optional — enables response caching) ───────────
# REDIS_URL=redis://localhost:6379/0

# ── RAG / Vector store ────────────────────────────────────
# VECTOR_STORE=chroma          # chroma | pinecone | weaviate
# CHROMA_HOST=localhost
# CHROMA_PORT=8000

# ── Provider keys (add at least one) ──────────────────────
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
MISTRAL_API_KEY=...
DEEPSEEK_API_KEY=...
GEMINI_API_KEY=...
NVIDIA_API_KEY=...
# OPENROUTER_API_KEY=sk-or-...
# Ollama needs no key — just run `ollama serve` locally

# ── App ───────────────────────────────────────────────────
APP_ENV=development            # development | production
DEBUG=true                     # set false in production
ALLOWED_ORIGINS=http://localhost:3000
```

Provider keys can also be added **after login** via Dashboard → Settings, without restarting the backend. Anything saved to the DB applies immediately; only `.env` code changes need a restart.

---

## 🌐 Deployment

### Option A — Single VPS (DigitalOcean / Hetzner / AWS EC2)

Best for fully self-hosted production. One machine, one `docker-compose.yml`.

```bash
# On a fresh Ubuntu 22.04+ server
git clone <your-repo-url> luminal && cd luminal
cp .env.example .env && nano .env       # fill in secrets + provider keys
docker-compose up -d
```

Open ports `3000` and `8000` in your firewall, then put **Caddy** in front for HTTPS:

```caddyfile
# /etc/caddy/Caddyfile
luminal.yourdomain.com {
    reverse_proxy localhost:3000
}
api.luminal.yourdomain.com {
    reverse_proxy localhost:8000
}
```

Finally, update `docker-compose.yml` so the dashboard knows the public backend URL:

```yaml
dashboard:
  environment:
    - NEXT_PUBLIC_API_URL=https://api.luminal.yourdomain.com
```

Rebuild: `docker-compose up -d --build dashboard`.

---

### Option B — Split deploy (best free-tier combo)

- **Frontend** → Vercel (free)
- **Backend + Postgres + Redis + Chroma** → Railway / Render / Fly.io

#### Frontend on Vercel

1. Push your repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → **New Project** → import the repo.
3. Set **Root Directory** to `dashboard`.
4. Add env var: `NEXT_PUBLIC_API_URL` = your backend public URL (e.g. `https://api.luminal.up.railway.app`). No trailing slash.
5. Click **Deploy**.

#### Backend on Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
2. Select your repo — Railway auto-detects the `Dockerfile`.
3. Add plugins: **PostgreSQL**, **Redis** (Railway provides both).
4. Set env vars in the backend service:

```
DATABASE_URL = <from Railway Postgres plugin, prepend postgresql+asyncpg://>
REDIS_URL    = <from Railway Redis plugin>
SECRET_KEY   = <openssl rand -hex 32>
APP_ENV      = production
VECTOR_STORE = chroma
```

5. Expose port `8000` and generate a public domain under **Settings → Networking**.
6. Use that domain as `NEXT_PUBLIC_API_URL` in Vercel.

---

### Option C — All-in-one on Fly.io

Fly.io can run the whole stack on a single machine with one command.

```bash
curl -L https://fly.io/install.sh | sh

cd luminal
fly launch                  # generates fly.toml from docker-compose
fly secrets set \
  DATABASE_URL=postgresql+asyncpg://... \
  REDIS_URL=redis://... \
  SECRET_KEY=$(openssl rand -hex 32)

fly deploy
```

---

## ✅ Production checklist

Before pointing real traffic at a Luminal instance:

| Setting | Why |
|---|---|
| `SECRET_KEY` | Long random string: `openssl rand -hex 32` |
| `DATABASE_URL` | Postgres — SQLite is dev-only |
| `REDIS_URL` | Required for response cache & rate limits |
| `NEXT_PUBLIC_API_URL` | Must match backend public URL, no trailing slash |
| `ALLOWED_ORIGINS` | CORS — add your real frontend domain |
| `DEBUG=false` | Turn off debug output |
| `APP_ENV=production` | Enables stricter validation |
| Provider keys | Add at least one via dashboard Settings, or paste in `.env` |
| Change `admin` password | First thing after first login |
| HTTPS | Put Caddy / nginx / Cloudflare in front |
| Backups | Schedule `pg_dump` of Postgres if self-hosted |

---

## 🧪 Verifying your install

After starting everything:

```bash
# Backend health check
curl http://localhost:8000/

# Login (use default creds or what you set)
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@admin.com","password":"admin"}'

# Send a prompt
curl -X POST http://localhost:8000/route \
  -H "Authorization: Bearer <JWT-from-login>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"What is the capital of France?"}'
```

If the first prompt comes back with a model answer and shows up under Dashboard → Recent Logs, you're fully wired up. 🎉

---

## Phases and Subtasks

### Phase 1: Core Gateway & Basic Routing

**Goal:** Working MVP – user can register, configure models, send a request, get a response, and see basic logs.

#### Subtasks

1. **Project Scaffold** – Initialize repo with FastAPI, Docker, environment config, and folder structure. ✅
2. **Database Models** – Define SQLAlchemy models for `User`, `APIKey`, `ModelConfig`, and `ExecutionLog`. ✅
3. **User & API Key Management** – Implement registration, login, and CRUD endpoints for API keys. ✅
4. **POST /route Endpoint** – Accept user prompt and API key; validate key. ✅
5. **Basic Complexity Scorer** – Use heuristic scoring (prompt length, keywords, question type) to classify low/medium/high. ✅
6. **Router Logic** – Read user’s model mapping (complexity → model name) from DB and choose model. ✅
7. **OpenRouter Client** – Integrate HTTP client to call OpenRouter with selected model; parse response. ✅
8. **Logging** – Save every request to `ExecutionLog` with prompt, model, tokens, cost, latency, timestamp. ✅
9. **Simple Dashboard** – Backend APIs for today’s cost/requests and a minimal Next.js page to display them. ✅
10. **Tests** – Unit tests for complexity scorer, router, and logging. ✅

---

### Phase 2: Multi-Provider, Budget & Caching

**Goal:** Support multiple providers, enforce budgets, add caching and resilience.

#### Subtasks

1. **Provider Abstraction** – Create adapter interface for LLM providers; implement for OpenAI, Anthropic, DeepSeek, Ollama. ✅
2. **Enhanced Complexity Detection** – Replace heuristics with a small ML model or LLM‑as‑judge. ✅
3. **Budget Management** – Add user fields: monthly budget, current spend, projected spend; implement monthly reset. ✅
4. **Budget‑Aware Routing** – Modify router to check budget before selection; force cheaper model if threshold exceeded. ✅
5. **Redis Caching** – Cache responses for identical prompts (hash) and optionally similar prompts using embeddings. ✅
6. **Retry & Fallback** – On failure, retry with exponential backoff; if still fails, try a fallback model. ✅
7. **Streaming Support** – Add Server‑Sent Events (SSE) endpoint for streaming token responses. ✅
8. **Rate Limiting** – Implement Redis‑based rate limiting per API key. ✅
9. **Dashboard Expansion** – Show cost breakdown by model, budget status, and monthly trends. ✅
10. **Integration Tests** – Test multi‑provider routing, budget enforcement, and caching. ✅

---

### Phase 3: RAG Integration & Tool Use (MCP)

**Goal:** Enable retrieval‑augmented generation and external tool calling.

#### Subtasks

1. **Vector Database Setup** – Integrate Chroma (dev) and configurable Pinecone/Weaviate (prod) with embedding model. ✅
2. **Document Ingestion** – Create endpoints/scripts to upload files, chunk text, embed, and store vectors. ✅
3. **Retrieval Module** – Build function that takes a query and returns top‑k relevant chunks with scores. ✅
4. **Context Injection** – In `/route`, detect if query needs external knowledge; if yes, retrieve and prepend to prompt. ✅
5. **MCP Client/Server** – Implement MCP server that can register tools (e.g., weather API, database query). ✅
6. **Tool‑Calling Logic** – Add a decision step (heuristic or LLM) to determine if a tool should be called. ✅
7. **Tool Execution** – Call the selected tool via MCP, capture result, and merge into prompt. ✅
8. **Source Citations** – When RAG is used, append citations to the response and log them. ✅
9. **Logging & Dashboard** – Extend `ExecutionLog` to include retrieval and tool metadata; update dashboard. ✅
10. **Unit Tests** – Test retrieval, tool calling, and context injection. ✅

---

### Phase 4: Agentic Orchestration with LangGraph

**Goal:** Replace linear flow with a stateful agent graph, add self‑reflection and human‑in‑the‑loop.

#### Subtasks

1. **LangGraph State Machine** – Refactor routing pipeline into LangGraph nodes: `analyze` → `retrieve` → `tool` → `route` → `generate`. ✅
2. **Conversation State** – Persist conversation history and context across multiple turns (session management). ✅
3. **Critic Agent** – Add a node that reviews the generated response and scores quality; if low, re‑generate with stronger model. ✅
4. **Human‑in‑the‑Loop** – For high‑risk tool actions (e.g., refund, email), pause and ask for user approval via callback. ✅
5. **Error Recovery** – On tool failure or low confidence, loop back to previous nodes with different parameters. ✅
6. **Tracing** – Integrate LangSmith or OpenTelemetry to log agent decisions and state transitions. ✅
7. **Router Integration** – Make routing decision consider agent state (e.g., previous failures, quality history). ✅
8. **Integration Tests** – Test multi‑step agent workflows, critic loops, and approval flows. ✅
9. **Dashboard Update** – Show agent decision trace and loop counts. ✅
10. **Performance Optimisation** – Cache intermediate agent results to reduce latency. ✅

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
