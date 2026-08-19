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

## Phases and Subtasks

### Phase 1: Core Gateway & Basic Routing

**Goal:** Working MVP – user can register, configure models, send a request, get a response, and see basic logs.

#### Subtasks

1. **Project Scaffold** – Initialize repo with FastAPI, Docker, environment config, and folder structure. ✅
2. **Database Models** – Define SQLAlchemy models for `User`, `APIKey`, `ModelConfig`, and `ExecutionLog`. ✅
3. **User & API Key Management** – Implement registration, login, and CRUD endpoints for API keys.
4. **POST /route Endpoint** – Accept user prompt and API key; validate key.
5. **Basic Complexity Scorer** – Use heuristic scoring (prompt length, keywords, question type) to classify low/medium/high.
6. **Router Logic** – Read user’s model mapping (complexity → model name) from DB and choose model.
7. **OpenRouter Client** – Integrate HTTP client to call OpenRouter with selected model; parse response.
8. **Logging** – Save every request to `ExecutionLog` with prompt, model, tokens, cost, latency, timestamp.
9. **Simple Dashboard** – Backend APIs for today’s cost/requests and a minimal Next.js page to display them.
10. **Tests** – Unit tests for complexity scorer, router, and logging.

---

### Phase 2: Multi-Provider, Budget & Caching

**Goal:** Support multiple providers, enforce budgets, add caching and resilience.

#### Subtasks

1. **Provider Abstraction** – Create adapter interface for LLM providers; implement for OpenAI, Anthropic, DeepSeek, Ollama.
2. **Enhanced Complexity Detection** – Replace heuristics with a small ML model or LLM‑as‑judge.
3. **Budget Management** – Add user fields: monthly budget, current spend, projected spend; implement monthly reset.
4. **Budget‑Aware Routing** – Modify router to check budget before selection; force cheaper model if threshold exceeded.
5. **Redis Caching** – Cache responses for identical prompts (hash) and optionally similar prompts using embeddings.
6. **Retry & Fallback** – On failure, retry with exponential backoff; if still fails, try a fallback model.
7. **Streaming Support** – Add Server‑Sent Events (SSE) endpoint for streaming token responses.
8. **Rate Limiting** – Implement Redis‑based rate limiting per API key.
9. **Dashboard Expansion** – Show cost breakdown by model, budget status, and monthly trends.
10. **Integration Tests** – Test multi‑provider routing, budget enforcement, and caching.

---

### Phase 3: RAG Integration & Tool Use (MCP)

**Goal:** Enable retrieval‑augmented generation and external tool calling.

#### Subtasks

1. **Vector Database Setup** – Integrate Chroma (dev) and configurable Pinecone/Weaviate (prod) with embedding model.
2. **Document Ingestion** – Create endpoints/scripts to upload files, chunk text, embed, and store vectors.
3. **Retrieval Module** – Build function that takes a query and returns top‑k relevant chunks with scores.
4. **Context Injection** – In `/route`, detect if query needs external knowledge; if yes, retrieve and prepend to prompt.
5. **MCP Client/Server** – Implement MCP server that can register tools (e.g., weather API, database query).
6. **Tool‑Calling Logic** – Add a decision step (heuristic or LLM) to determine if a tool should be called.
7. **Tool Execution** – Call the selected tool via MCP, capture result, and merge into prompt.
8. **Source Citations** – When RAG is used, append citations to the response and log them.
9. **Logging & Dashboard** – Extend `ExecutionLog` to include retrieval and tool metadata; update dashboard.
10. **Unit Tests** – Test retrieval, tool calling, and context injection.

---

### Phase 4: Agentic Orchestration with LangGraph

**Goal:** Replace linear flow with a stateful agent graph, add self‑reflection and human‑in‑the‑loop.

#### Subtasks

1. **LangGraph State Machine** – Refactor routing pipeline into LangGraph nodes: `analyze` → `retrieve` → `tool` → `route` → `generate`.
2. **Conversation State** – Persist conversation history and context across multiple turns (session management).
3. **Critic Agent** – Add a node that reviews the generated response and scores quality; if low, re‑generate with stronger model.
4. **Human‑in‑the‑Loop** – For high‑risk tool actions (e.g., refund, email), pause and ask for user approval via callback.
5. **Error Recovery** – On tool failure or low confidence, loop back to previous nodes with different parameters.
6. **Tracing** – Integrate LangSmith or OpenTelemetry to log agent decisions and state transitions.
7. **Router Integration** – Make routing decision consider agent state (e.g., previous failures, quality history).
8. **Integration Tests** – Test multi‑step agent workflows, critic loops, and approval flows.
9. **Dashboard Update** – Show agent decision trace and loop counts.
10. **Performance Optimisation** – Cache intermediate agent results to reduce latency.

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
