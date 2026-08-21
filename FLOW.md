LUMINAL — SYSTEM FLOW DOCUMENTATION
====================================

WHAT IT IS
----------
Luminal is a self-hosted LLM routing gateway. It accepts prompts, analyzes
complexity, optionally retrieves context (RAG) and calls tools (MCP), then
routes the request to the cheapest suitable model and logs everything.

It has two parts:
  1. Backend  — FastAPI + SQLite (port 8000)
  2. Dashboard — Next.js + Framer Motion (port 3000)


HOW TO RUN
----------
Terminal 1 (backend):
    cd ~/Downloads/Old/Stuff/Grind/Luminal
    python3 -m uvicorn app.main:app --port 8000

  On first boot it:
    - creates the SQLite DB (luminal.db) and all tables
    - creates the default admin user (admin@admin.com / admin)
    - seeds default model configs for that user:
        low    -> anthropic/claude-3-haiku   (default)
        medium -> openai/gpt-4o-mini
        high   -> openai/gpt-4o

  Keys come from the .env file (e.g. OPENROUTER_API_KEY).

Terminal 2 (dashboard):
    cd dashboard
    npm run dev          (http://localhost:3000)


LOGIN
-----
Open http://localhost:3000
Login screen: admin@admin.com / admin
The login button POSTs to POST /auth/login (OAuth2 form), gets a JWT,
stores it in localStorage ("luminal_token"), then the app re-boots with it.

NOTE: JWT "sub" is stored as a string — python-jose rejects integer subjects.
This was the root cause of the dashboard being stuck on "loading" forever.


DASHBOARD UI — HOW IT WORKS
---------------------------
On load (with a saved token) the page calls these endpoints in parallel:

  GET /dashboard/stats                 -> today/month totals + cost by model
  GET /dashboard/logs?limit=60         -> recent execution logs
  GET /dashboard/budget                -> budget + spend + thresholds
  GET /dashboard/cost-breakdown?days=30-> daily cost/requests/tokens trend
  GET /dashboard/model-performance?days=30
  GET /dashboard/rag-stats?days=30     -> RAG vs tool usage stats
  GET /api-keys                        -> list of API keys

Every 45 seconds everything silently refreshes (auto-refresh).

Sections (top to bottom):
  1. Header — logo, LIVE/OFFLINE status pill, budget ring %, refresh, logout.
  2. Stat cards (7) — requests today, cost today, tokens, avg latency,
     monthly cost, budget left, requests/month. Numbers count up on load.
  3. Cost & Usage Trend — animated SVG area/line chart (cost + requests, 30d).
  4. Monthly Budget panel — animated progress ring + spend/limit + alert
     badges. "Edit" opens an input to PATCH /dashboard/budget.
  5. RAG & Tool Usage — animated percentage bars + mini stat grid.
  6. Model Performance — cost bars per model + req/tokens/latency/quality/err.
  7. Route a Prompt + Live Trace terminal (see below).
  8. API Keys — create/list/copy/delete keys. New keys shown once.
  9. Recent Logs — table with filter chips (All / Success / Errors).


PROMPT FLOW (what happens when you hit "Send")
----------------------------------------------
The UI POSTs to POST /route with JSON { prompt, api_key: "" }.
Authentication is the JWT Bearer token (api_key is optional now).

Backend /route handler:
  1. Resolve user from JWT (fallback to api_key for API clients).
  2. Check monthly budget — 402 if over budget.
  3. Reuse the session_id from the request body if the caller sent one (continues
     that conversation's history); otherwise generate a new one (user_<id>_<hex>).
  4. Run the LangGraph agent pipeline (see below).
  5. If the run is still paused on tool approval, return 202 with the pending
     approval info instead of logging/billing anything.
  6. Otherwise write an ExecutionLog row + add cost to user's current_spend.
  7. Return { content, model, complexity, tokens_used, cost, latency_ms, session_id, citations }.

AGENT PIPELINE (LangGraph StateGraph) — nodes in order:
  1. analyze   -> hybrid complexity score (low/medium/high; heuristic or
                  LLM-as-judge) computed once and reused by route, so the two
                  never disagree within a request
  2. retrieve  -> RAG: only if the prompt matches RAG keywords; embeds query,
                  searches vector store, injects context + citations
  3. tool      -> keyword/LLM decision; if a tool matches, runs it via MCP —
                  unless it's marked requires_approval, in which case the run
                  pauses here (approval_required=True) instead of calling it
  3b. approval -> only entered when tool paused; the run ends here (still
                  paused) until POST /route/approve grants or denies it
  4. route     -> picks the model config matching the complexity (budget-aware:
                  80% -> downgrade one step, 95% -> cheapest model)
  5. generate  -> checks the Redis response cache, then calls the provider
                  (OpenRouter/OpenAI/Anthropic/DeepSeek/Ollama) with retry +
                  backoff; on a 402 from a cloud provider, falls back once to
                  local Ollama
  6. critic    -> optionally scores the response; if low quality, regenerates
                  (bounded) with the same model — skipped for local/Ollama
  7. error_recovery -> retries with lower temperature / disables RAG on failures

LIVE TRACE (the terminal panel)
-------------------------------
Right after Send, the UI opens an EventSource (SSE) to:
    GET /route/trace/<session_id>
The backend polls the in-memory agent state and streams each trace event as
JSON: { node, action, timestamp, data }.

The terminal renders each event as a color-coded line (analyze=blue,
retrieve=purple, tool=amber, route=green, generate=red, critic=pink, ...),
ending with "trace complete". The panel also shows a live CONNECTED/IDLE dot.


API USE (for developers)
------------------------
Create an API key in the dashboard, then:

  curl -X POST http://localhost:8000/route \
    -H "Content-Type: application/json" \
    -d '{"prompt": "What is the capital of France?", "api_key": "<KEY>"}'

Interactive docs: http://localhost:8000/docs

Other endpoints:
  POST /auth/register | /auth/login | /auth/me
  POST /api-keys (CRUD)
  GET  /dashboard/*  (stats, logs, budget, cost-breakdown, model-performance, rag-stats)
  POST /route/stream (SSE token streaming variant — same routing/RAG/tool-calling
                       helpers as the agent graph, but skips the critic loop and
                       approval-gated tools since both need a full response first)
  POST /route/approve { session_id, approved } (grant/deny a tool paused on approval)
  POST /documents (upload files for RAG ingestion)
  GET  /retrieval/search
  MCP tool endpoints under /mcp


DEFAULT MODEL ROUTING TABLE
---------------------------
  Prompt complexity   Model                   Provider
  ---------------     -----                   --------
  low                 anthropic/claude-3-haiku  OpenRouter (default)
  medium              openai/gpt-4o-mini        OpenRouter
  high                openai/gpt-4o             OpenRouter

These rows live in the model_configs table and are editable per user.


KEY FILES
---------
  app/main.py                       FastAPI app + CORS + startup
  app/api/route.py                  /route, /route/stream, /route/approve, /route/trace
  app/api/dashboard.py              analytics endpoints
  app/api/auth.py                   login, register, api-keys CRUD
  app/services/agent/graph.py       LangGraph pipeline definition + run/resume_agent
  app/services/agent/nodes.py       pipeline node logic
  app/services/agent/state.py       AgentState + trace buffer
  app/services/router.py            budget-aware model selection + hybrid complexity
  app/services/cache.py             Redis LLM response cache (used by generate_node)
  app/services/retry.py             retry-with-backoff (used by generate_node)
  app/services/providers/           provider adapters (incl. openrouter)
  app/services/rag.py               retrieval + citations
  app/services/tool_calling.py      MCP tool decisions
  app/services/budget.py            budget tracking
  app/db/init_db.py                 schema creation + admin seed + model configs
  dashboard/src/app/page.tsx        dashboard orchestration + header
  dashboard/src/components/*        stat cards, charts, panels, terminal, logs
  dashboard/src/lib/api.ts          API helpers + formatting
  dashboard/src/lib/types.ts        shared TypeScript types
  .env                              secrets + provider keys (not committed)