# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Luminal is a self-hosted LLM routing gateway. It accepts prompts, analyzes complexity, optionally
retrieves context (RAG) and calls external tools (MCP), then routes the request to the cheapest
suitable model and logs everything for cost/quality analytics. Two parts:

- **Backend** — FastAPI + SQLAlchemy (async) + SQLite (dev) / Postgres (prod), port 8000
- **Dashboard** — Next.js (App Router) + Tailwind + Framer Motion, port 3000

See `FLOW.md` for a detailed walkthrough of the dashboard UI, the prompt-to-response flow, and the
default model routing table — read it before touching `app/api/route.py`, the agent pipeline, or the
dashboard page. `README.md` tracks the phased build plan (Phases 1-5) with checkboxes.

## Commands

Backend (run from repo root, needs `venv` activated):
```bash
python3 -m uvicorn app.main:app --port 8000 --reload
```

Dashboard:
```bash
cd dashboard && npm run dev      # http://localhost:3000
npm run build
npm run lint
```

Tests (pytest + pytest-asyncio, async SQLite in-memory DB via `tests/conftest.py`):
```bash
pytest                                    # full suite
pytest tests/test_router.py               # single file
pytest tests/test_router.py::test_name -v # single test
```

On backend startup (`app/main.py` -> `init_db`), it auto-creates tables, seeds a default admin user
(`admin@admin.com` / `admin`), and seeds default model configs (low/medium/high → OpenRouter models).
Provider keys and secrets come from `.env` (see `app/core/config.py` for all settings fields).

## Architecture

### Request pipeline (LangGraph state machine)

`POST /route` (`app/api/route.py`) resolves the user from JWT or API key, checks budget, then runs a
LangGraph pipeline (`app/services/agent/graph.py`, nodes in `app/services/agent/nodes.py`) over a
shared `AgentState` (`app/services/agent/state.py`):

```
analyze -> retrieve -> [tool -> approval] -> route -> generate -> critic -> error_recovery
```

- **analyze** — hybrid complexity scoring (`app/services/router.py::score_complexity_hybrid`: heuristic,
  or LLM-as-judge when `use_llm_complexity` is set) — computed once here and reused by `route` so the
  two never disagree on a single request
- **retrieve** — RAG: keyword-triggered; embeds query, searches the configured vector store
  (`app/services/vector_store/{chroma,pinecone,weaviate}.py`), injects context + citations
- **tool** — MCP: keyword/LLM decision to call user-registered tools (`app/services/mcp_tool.py` +
  `tool_calling.py`/`tool_execution.py`). A tool with `MCPToolConfig.requires_approval=True` sets
  `approval_required` and pauses the run *before* executing instead of calling it
- **approval** — only entered when `tool` set `approval_required`; the run ends here (still paused)
  until `POST /route/approve {session_id, approved}` calls `resume_agent()`, which re-enters the graph
  with `approval_granted` set — granted resumes into `route`, denied ends with an error
- **route** — picks the model config for the complexity tier; budget-aware (80% spend → downgrade one
  step, 95% → cheapest model) via `app/services/router.py` + `app/services/budget.py`
- **generate** — checks the Redis response cache (`app/services/cache.py`, skipped on a critic-triggered
  regeneration so a bad response can't just replay itself) before calling the resolved provider adapter
  (`app/services/providers/*.py`: openai, anthropic, deepseek, nvidia, mistral, gemini, ollama, openrouter — common interface in
  `providers/base.py`), wrapped in `app/services/retry.py::retry_with_backoff`. On a 402 from a cloud
  provider it does one hardcoded fallback to local Ollama.
- **critic** — optionally scores response quality; regenerates (bounded by `max_regenerations`) with the
  same model if low; local/Ollama responses skip scoring
- **error_recovery** — retries with adjusted params (e.g. disables RAG, lowers temperature) on failure,
  bounded by `max_errors`

Every completed run writes an `ExecutionLog` row and updates the user's `current_spend` — a run still
paused on approval is not logged/billed. A live SSE trace is exposed at `GET /route/trace/<session_id>`,
fed by an in-memory trace buffer on `AgentState`, and rendered by the dashboard's terminal panel.
`POST /route` accepts an optional `session_id` in the body to continue a prior conversation (the graph's
`MemorySaver` checkpoint for that thread is reused); omit it to start a new one. `POST /route/stream`
is a token-streaming variant built on the same routing/RAG/tool-calling helpers as the graph nodes
(so it doesn't drift from `/route`), but it skips the critic loop and approval-gated tools since both
need a complete response before they can act — incompatible with token-by-token delivery.

**Known gotcha:** `AgentState` is a dataclass but gets converted to/from plain dicts at multiple
boundaries (nodes, trace serialization, dashboard reads, LangGraph checkpoint deserialization — a
checkpoint may hand back either real `Message`/`AgentState` objects or plain dicts depending on the
code path, so don't assume one shape without checking). Always normalize before attribute/key access —
mismatches here have caused multiple `AttributeError` regressions (see `[FIX]` commits in git log).

### Auth model

Two parallel auth mechanisms, both accepted by `/route`:
- **Dashboard JWT** — `python-jose`; the JWT `sub` claim must be stored as a *string* (an integer
  subject is rejected and silently breaks dashboard login/loading).
- **Luminal API keys** (`lum_...`) — hashed and looked up per-request for external API clients; created
  via `app/api/auth.py` (`api_key_router`) and `app/services/api_key.py`.

Passwords are hashed with the `bcrypt` library directly (`app/services/auth.py`), not `passlib` —
`passlib==1.7.4`'s bcrypt backend crashes against `bcrypt>=4.1` (it probes a `bcrypt.__about__`
attribute that no longer exists), so don't reintroduce `passlib.context.CryptContext` here. Old
SHA256-hashed passwords from before this migration still verify via a legacy fallback path.

Provider keys (OpenAI/Anthropic/DeepSeek/etc.) are stored per-user, masked in dashboard responses, and
used internally by the provider adapters — never exposed to the calling app.

### Dashboard data flow

`dashboard/src/app/page.tsx` fetches all dashboard state in parallel on load (`/dashboard/stats`,
`/logs`, `/budget`, `/cost-breakdown`, `/model-performance`, `/rag-stats`, `/api-keys` — see
`app/api/dashboard.py`) and polls every 45s. `dashboard/src/lib/api.ts` holds API helpers,
`lib/types.ts` the shared TS types mirroring backend schemas. When changing a backend response shape,
update both `app/schemas/*.py` and `dashboard/src/lib/types.ts` together.

### Runtime-configurable settings

`app/services/runtime_settings.py` loads DB-backed settings (overriding `.env` defaults) at startup and
on save from the dashboard Settings panel — check here before assuming a config value comes only from
`app/core/config.py`.

## Notes

- `venv/`, `luminal.db`, `chroma/`, `*.log` are local artifacts — don't treat them as source of truth
  or commit changes to them (already gitignored except `venv/`, which is currently untracked).
- Commit messages in this repo follow `[ADD] added <what>` / `[FIX] fixed <what>` in plain English, no
  file paths or endpoint names.
