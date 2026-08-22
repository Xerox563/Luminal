"use client";

import * as React from "react";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import {
  BookOpen,
  Terminal,
  Zap,
  Server,
  Folder,
  Layout,
  List,
  Clock,
  AlertCircle,
  BarChart2,
  Settings,
  LogIn,
  ArrowRight,
  ChevronRight,
  Hash,
} from "lucide-react";

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

const colors = {
  bg: "#0a0a0b",
  card: "#111114",
  cardHover: "#17171b",
  primary: "#818cf8",
  secondary: "#c084fc",
  accent: "#f472b6",
  muted: "#8b8b96",
  text: "#fafafa",
  textSecondary: "#a1a1aa",
  border: "#1f1f24",
  borderLight: "#27272a",
  codeBg: "#0d0d10",
};

const sections = [
  {
    id: 1,
    title: "What Luminal Is",
    shortTitle: "Overview",
    icon: BookOpen,
    content: [
      { type: "p", text: "Luminal sits between your app and the AI companies (OpenAI, Anthropic, Mistral, etc). Instead of your app calling those companies directly, it calls Luminal. Luminal then:" },
      { type: "list", items: [
        "Looks at how hard your question is (simple vs. complex).",
        "Picks the cheapest model that can actually handle it.",
        "Optionally pulls in extra info from documents you've uploaded (RAG).",
        "Optionally calls an outside tool (like a weather API) if the prompt needs one.",
        "Sends the final prompt to the real AI model and gets an answer back.",
        "Logs everything — cost, tokens used, which model answered, how long it took — so you can see it all on the dashboard.",
      ]},
      { type: "p", text: "Two parts run at the same time:" },
      { type: "list", items: [
        "The BACKEND (the actual gateway/API) — runs on port 8000.",
        "The DASHBOARD (the web UI you look at in a browser) — runs on port 3000.",
      ]},
    ],
  },
  {
    id: 2,
    title: "How to Run It",
    shortTitle: "Installation",
    icon: Terminal,
    content: [
      { type: "p", text: "You need TWO terminals open at the same time, both running." },
      { type: "p", text: "Terminal 1 — start the backend (run this from the Luminal folder root):" },
      { type: "code", lang: "bash", code: "source venv/bin/activate\npython3 -m uvicorn app.main:app --port 8000 --reload" },
      { type: "p", text: "The --reload flag matters — without it, the backend will NOT pick up any code changes automatically, and you'll have to manually stop and restart it every time something is fixed or changed." },
      { type: "p", text: "Terminal 2 — start the dashboard:" },
      { type: "code", lang: "bash", code: "cd dashboard\nnpm run dev" },
      { type: "p", text: "Then open http://localhost:3000 in your browser." },
      { type: "p", text: "Before either will work properly, you need a .env file in the Luminal root folder with at least one provider's API key in it (see section 6)." },
    ],
  },
  {
    id: 3,
    title: "Logging In",
    shortTitle: "Auth",
    icon: LogIn,
    content: [
      { type: "p", text: "The backend automatically creates a default admin account the first time it starts:" },
      { type: "code", lang: "text", code: "email:    admin@admin.com\npassword: admin" },
      { type: "p", text: "Use this to log into the dashboard at http://localhost:3000. You can create more accounts too — the dashboard's sign-up flow handles that." },
      { type: "p", text: "Under the hood this login gives your browser a JWT (a signed login token). That's what the dashboard uses to talk to the backend on your behalf. You don't need to think about this — it's handled automatically once you're logged in." },
    ],
  },
  {
    id: 4,
    title: "Getting a Luminal API Key",
    shortTitle: "API Keys",
    icon: Settings,
    content: [
      { type: "p", text: "The JWT from logging in only works for the dashboard itself. If you want some OTHER app (a script, a curl command, another service) to send prompts to Luminal, you need a Luminal API key instead. These always start with lum_." },
      { type: "p", text: "How to get one:" },
      { type: "list", ordered: true, items: [
        "Log into the dashboard.",
        "Go to the API Keys section.",
        "Click \"Create key\", give it a name.",
        "Copy the key immediately — it's shown once, in full, and never again (only a masked version is shown after that).",
      ]},
      { type: "p", text: "Once you have a key, any app can use it like this:" },
      { type: "code", lang: "bash", code: 'curl -X POST http://localhost:8000/route \\\n  -H "Authorization: Bearer lum_YOUR_KEY_HERE" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"prompt": "What is the capital of France?"}\'' },
      { type: "p", text: "That's it — no SDK needed, just plain HTTP with your key as a Bearer token. Works from Python, JavaScript, curl, Postman, anything that can make an HTTP request." },
    ],
  },
  {
    id: 5,
    title: "Sending a Prompt — The Main Endpoint",
    shortTitle: "POST /route",
    icon: Zap,
    content: [
      { type: "endpoint", method: "POST", path: "/route" },
      { type: "p", text: "Request body (JSON):" },
      { type: "code", lang: "json", code: '{\n  "prompt": "your question here",\n  "session_id": null\n}' },
      { type: "list", items: [
        { label: "prompt", required: true, desc: "the thing you're asking." },
        { label: "session_id", required: false, desc: "leave it out / null to start a fresh conversation. To CONTINUE a previous conversation (multi-turn, so the model remembers earlier messages), pass back the session_id you got in an earlier response." },
      ]},
      { type: "p", text: "Response body (JSON):" },
      { type: "code", lang: "json", code: '{\n  "content": "the model\'s answer",\n  "model": "mistral-small-latest",\n  "complexity": "low",\n  "tokens_used": 169,\n  "cost": 0.000034,\n  "latency_ms": 1720,\n  "session_id": "user_2_8d69624f9f15",\n  "citations": []\n}' },
      { type: "list", items: [
        { label: "content", desc: "the actual answer text (comes back as Markdown — bold, lists, tables, etc. The dashboard renders this properly; if you're building your own UI on top of Luminal, render it as Markdown too instead of showing the raw ** and ### symbols as plain text)." },
        { label: "model / complexity", desc: "which model Luminal picked and why (based on how complex your prompt looked)." },
        { label: "cost / tokens_used / latency_ms", desc: "what that one request cost you." },
        { label: "session_id", desc: "save this if you want to continue the conversation next time." },
        { label: "citations", desc: "filled in only when RAG (document search) was used to help answer your question." },
      ]},
      { type: "callout", variant: "warning", text: "If your monthly budget is used up, you'll get back an HTTP 402 error instead of an answer." },
    ],
  },
  {
    id: 6,
    title: "Providers — Where the Actual AI Comes From",
    shortTitle: "Providers",
    icon: Server,
    content: [
      { type: "p", text: "Luminal doesn't have its own AI — it calls out to real providers. It currently supports 8:" },
      { type: "code", lang: "text", code: "OpenAI, Anthropic, DeepSeek, NVIDIA, Mistral, Gemini, OpenRouter, Ollama" },
      { type: "p", text: "Ollama is special — it runs completely on your own computer for free (no API key, no internet, no cost), using whatever local models you've pulled with ollama pull <model>. All the others are cloud providers and need an API key from that company." },
      { type: "p", text: "To add a provider's key:" },
      { type: "list", ordered: true, items: [
        "Dashboard → Settings.",
        "Paste the key into that provider's box.",
        "Click \"Update Settings\" (this applies immediately, no restart needed — as long as the backend is already running the latest code; see the TROUBLESHOOTING section if a change doesn't seem to take effect).",
      ]},
      { type: "p", text: "Choosing which provider Luminal actually uses:" },
      { type: "list", items: [
        "In the \"Route a Prompt\" playground, there's a Model Source toggle (Local/Ollama, Cloud/OpenRouter, NVIDIA, Mistral, Gemini) — clicking one switches which provider ALL your requests go through by default.",
        "The same choice is also in Settings under \"Default Provider\" — same setting, just reachable two ways.",
        "Whichever provider is selected, Luminal still picks a cheap/medium/expensive MODEL from that provider depending on how complex your prompt looked (three tiers: low/medium/high complexity).",
      ]},
      { type: "callout", variant: "info", text: "Selecting a provider in the toggle does NOT save its API key for you — you still have to paste the actual key into Settings separately. The toggle only decides where requests get routed to; Settings is where you authenticate with that provider." },
    ],
  },
  {
    id: 7,
    title: "RAG — Asking Questions About Your Own Documents",
    shortTitle: "RAG",
    icon: Folder,
    content: [
      { type: "p", text: "RAG means: Luminal can read documents you upload and use them to answer your questions more accurately, with citations back to the source." },
      { type: "p", text: "How to use it:" },
      { type: "list", ordered: true, items: [
        "Dashboard → Documents.",
        "Upload a PDF, Markdown, or text file.",
        "Luminal automatically splits it into chunks, turns those chunks into searchable embeddings, and stores them (Chroma by default; Pinecone or Weaviate are also supported if configured).",
      ]},
      { type: "p", text: "RAG doesn't run on every single prompt — it only kicks in when your prompt sounds like a knowledge/lookup question (contains words like \"what is\", \"explain\", \"according to\", \"document\", \"summary of\", etc.). A prompt like \"hi\" won't trigger it; a prompt like \"what is our refund policy\" will." },
      { type: "p", text: "When RAG does trigger, the response's \"citations\" field will be filled in with which document chunks were used." },
    ],
  },
  {
    id: 8,
    title: "MCP Tools — Letting Luminal Call Your Own APIs",
    shortTitle: "MCP Tools",
    icon: Layout,
    content: [
      { type: "p", text: "MCP tools are external APIs you register with Luminal so the model can call them when it needs real, live data (weather, order status, a calculator — anything you can put behind an HTTP endpoint)." },
      { type: "p", text: "How to register one:" },
      { type: "list", ordered: true, items: [
        "Dashboard → MCP Tools → Add Tool.",
        "Fill in the fields below.",
        "Save. From then on, any prompt containing one of your trigger keywords will make Luminal call that tool automatically and feed the result back into the model's answer.",
      ]},
      { type: "p", text: "Fields to fill in:" },
      { type: "list", items: [
        { label: "Tool Name", desc: "a short label." },
        { label: "Endpoint URL", desc: "the full URL of your API (e.g. http://localhost:8008/tools/weather)." },
        { label: "Description", desc: "helps you remember what it does." },
        { label: "Trigger Keywords", desc: "comma-separated words that, if they appear in a prompt, tell Luminal \"this prompt probably needs this tool\" (e.g. weather, temperature, forecast)." },
        { label: "Auth Type", desc: "how your endpoint expects to be authenticated." },
      ]},
      { type: "code", lang: "text", code: "none    — no auth header sent.\napi_key — sends your key in an \"X-API-Key\" header.\nbearer  — sends your key as \"Authorization: Bearer <token>\".\nbasic   — sends username/password as HTTP Basic auth." },
      { type: "callout", variant: "info", text: "Requires approval before execution — if checked, Luminal will PAUSE the request and wait for you to manually approve it in the dashboard before it actually calls your tool. Useful for anything risky (sending an email, charging a card, etc)." },
      { type: "callout", variant: "info", text: "Technical note: Luminal tries POSTing your arguments as JSON first; if your endpoint replies \"405 Method Not Allowed\" (meaning it only accepts GET), Luminal automatically retries as a GET request with the arguments as query parameters instead. So both GET-style and POST-style tool APIs work without any extra configuration." },
    ],
  },
  {
    id: 9,
    title: "Budgets — Controlling Spend",
    shortTitle: "Budgets",
    icon: BarChart2,
    content: [
      { type: "p", text: "Every account has a monthly budget (in dollars)." },
      { type: "list", items: [
        "Dashboard → Monthly Budget panel → Edit → type a number → Save.",
        "At 80% of your budget spent, Luminal automatically starts downgrading to a cheaper model tier for new requests.",
        "At 95% spent, it pins everything to the cheapest available model.",
        "At 100% (budget fully used), new requests are rejected outright (HTTP 402 Payment Required) until the budget resets.",
        "The budget automatically resets back to 0 spent at the start of each calendar month.",
      ]},
      { type: "callout", variant: "info", text: "Local Ollama requests are always free ($0 cost) since nothing is being paid to a cloud provider — they don't count against your budget in a meaningful way, though they're still logged." },
    ],
  },
  {
    id: 10,
    title: "Watching a Live Trace",
    shortTitle: "Live Trace",
    icon: Clock,
    content: [
      { type: "p", text: "Every request runs through several stages: analyze → retrieve (RAG) → tool (MCP) → route → generate → critic. You can watch these happen live, step by step, instead of just waiting for the final answer." },
      { type: "list", items: [
        "If you send a prompt from the dashboard's own \"Route a Prompt\" playground, the trace terminal on the right shows it automatically — nothing extra to do.",
        "If a request came from SOMEWHERE ELSE (curl, another app, using a lum_ API key), the dashboard doesn't automatically know about it. To watch it anyway: every /route response includes a \"session_id\" — copy that value, paste it into the \"Watch another session_id…\" box in the trace terminal, and click Watch. You'll see that request's trace live (or its full trace immediately, if it already finished by the time you paste it in).",
      ]},
    ],
  },
  {
    id: 11,
    title: "The Dashboard, Panel by Panel",
    shortTitle: "Dashboard",
    icon: Layout,
    content: [
      { type: "p", text: "Quick tour of what each dashboard section does:" },
      { type: "list", items: [
        { label: "Top stat cards", desc: "requests/cost/tokens today, this month, and how much budget is left." },
        { label: "Cost & Usage Trend", desc: "a chart of cost and request count per day, over the last 30 days." },
        { label: "Monthly Budget", desc: "the circular gauge showing % of budget used, and where you edit your budget limit." },
        { label: "RAG & Tool Usage", desc: "what % of your requests actually used document retrieval vs. tool calls, and their average cost/latency." },
        { label: "Model Performance", desc: "cost, tokens, latency, and quality score broken down per model you've actually used." },
        { label: "Route a Prompt", desc: "the playground where you type a prompt, pick a provider, and see the live trace + answer." },
        { label: "Documents", desc: "upload/manage files for RAG." },
        { label: "MCP Tools", desc: "register/manage external tool APIs." },
        { label: "API Keys", desc: "create/revoke lum_ keys for external apps." },
        { label: "Logs", desc: "a table of every request ever made, with full details." },
        { label: "Settings", desc: "provider API keys, default provider, and whether to use an LLM (instead of simple keyword heuristics) to judge prompt complexity." },
      ]},
    ],
  },
  {
    id: 12,
    title: "Quick Endpoint Reference",
    shortTitle: "API Reference",
    icon: List,
    content: [
      { type: "endpointGroup", title: "Auth", endpoints: [
        { method: "POST", path: "/auth/register", desc: "create an account" },
        { method: "POST", path: "/auth/login", desc: "log in, get a JWT (used by the dashboard)" },
        { method: "GET", path: "/auth/me", desc: "get the logged-in user's info" },
      ]},
      { type: "endpointGroup", title: "API keys", endpoints: [
        { method: "POST", path: "/api-keys", desc: "create a new lum_ key" },
        { method: "GET", path: "/api-keys", desc: "list your keys (masked)" },
        { method: "DELETE", path: "/api-keys/{id}", desc: "revoke a key" },
      ]},
      { type: "endpointGroup", title: "Routing", endpoints: [
        { method: "POST", path: "/route", desc: "send a prompt, get an answer" },
        { method: "POST", path: "/route/stream", desc: "same, but streamed token-by-token" },
        { method: "POST", path: "/route/approve", desc: "approve/deny a tool call that's paused waiting for your OK" },
        { method: "GET", path: "/route/trace/{session_id}", desc: "live trace of one request (SSE)" },
      ]},
      { type: "endpointGroup", title: "Documents / RAG", endpoints: [
        { method: "POST", path: "/documents/upload", desc: "upload a file to be searchable" },
        { method: "GET", path: "/documents", desc: "list uploaded documents" },
        { method: "DELETE", path: "/documents/{id}", desc: "remove one" },
      ]},
      { type: "endpointGroup", title: "Dashboard data", endpoints: [
        { method: "GET", path: "/dashboard/stats", desc: "today/month totals" },
        { method: "GET", path: "/dashboard/budget", desc: "current budget status" },
        { method: "GET", path: "/dashboard/cost-breakdown", desc: "daily cost/request trend" },
        { method: "GET", path: "/dashboard/model-performance", desc: "per-model stats" },
        { method: "GET", path: "/dashboard/rag-stats", desc: "RAG/tool usage stats" },
        { method: "GET", path: "/dashboard/logs", desc: "full request history" },
      ]},
      { type: "endpointGroup", title: "Settings", endpoints: [
        { method: "GET", path: "/dashboard/settings", desc: "current provider keys (masked) + config" },
        { method: "PUT", path: "/dashboard/settings", desc: "update provider keys / default provider" },
      ]},
      { type: "endpointGroup", title: "MCP tools", endpoints: [
        { method: "GET", path: "/dashboard/mcp-tools", desc: "list your registered tools" },
        { method: "POST", path: "/dashboard/mcp-tools", desc: "register a new one" },
        { method: "PATCH", path: "/dashboard/mcp-tools/{id}", desc: "edit one" },
        { method: "DELETE", path: "/dashboard/mcp-tools/{id}", desc: "remove one" },
      ]},
    ],
  },
  {
    id: 13,
    title: "Troubleshooting",
    shortTitle: "Troubleshooting",
    icon: AlertCircle,
    content: [
      { type: "qa", q: "I changed a setting / added an API key and nothing changed.", a: "Make sure the backend was started WITH --reload. If it wasn't, it will never pick up code changes on its own — you have to manually stop it (Ctrl+C) and run the start command again. Settings saved to the database (API keys, default provider, budget) apply instantly without a restart; only actual CODE changes need a restart." },
      { type: "qa", q: "I get a 402 error.", a: "Your monthly budget is used up, or a cloud provider rejected the request for billing reasons (e.g. no credits on that provider's account). Check Settings → provider keys, or switch to Ollama (free/local) temporarily." },
      { type: "qa", q: "I get a 405 error calling my own MCP tool.", a: "Luminal automatically retries as GET if POST gets a 405, so this should self-resolve. If it still fails, double check your endpoint's auth header expectations match the Auth Type you picked when registering the tool." },
      { type: "qa", q: "The trace panel is empty / stuck on IDLE.", a: "It only auto-connects for prompts sent from the dashboard's own playground. For external requests, paste that request's session_id into the \"Watch another session_id…\" box (see section 10)." },
      { type: "qa", q: "Ollama error: All connection attempts failed.", a: "Ollama isn't running locally. Run `ollama serve` in a terminal, and make sure you've pulled the model it's asking for, e.g. `ollama pull mistral`." },
    ],
  },
];

function highlightCode(code: string, lang: string): React.ReactNode {
  if (lang === "json") {
    return code.split("\n").map((line, i) => {
      const parts: React.ReactNode[] = [];
      let rest = line;
      let key = 0;
      const regex = /("(?:\\.|[^"\\])*")(\s*:)|("(?:\\.|[^"\\])*")|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?)/g;
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(rest)) !== null) {
        if (match.index > lastIndex) {
          parts.push(<span key={key++}>{rest.slice(lastIndex, match.index)}</span>);
        }
        if (match[1]) {
          parts.push(<span key={key++} style={{ color: "#a5d6ff" }}>{match[1]}</span>);
        } else if (match[3]) {
          parts.push(<span key={key++} style={{ color: "#a5d6ff" }}>{match[3]}</span>);
        } else if (match[4]) {
          parts.push(<span key={key++} style={{ color: "#ff7b72" }}>{match[4]}</span>);
        } else if (match[5]) {
          parts.push(<span key={key++} style={{ color: "#79c0ff" }}>{match[5]}</span>);
        }
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < rest.length) {
        parts.push(<span key={key++}>{rest.slice(lastIndex)}</span>);
      }
      return <div key={i}>{parts.length ? parts : line}</div>;
    });
  }
  if (lang === "bash") {
    return code.split("\n").map((line, i) => {
      if (line.trim().startsWith("#")) {
        return <div key={i} style={{ color: "#8b949e", fontStyle: "italic" }}>{line}</div>;
      }
      const commentIdx = line.indexOf("#");
      const beforeComment = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
      const comment = commentIdx >= 0 ? line.slice(commentIdx) : "";
      const parts: React.ReactNode[] = [];
      const regex = /("(?:\\.|[^"\\])*")|('[^']*')|(\$\{[^}]+\})|(\$\w+)|(\b(?:curl|source|cd|npm|python3|ollama|export|echo|true|false)\b)/g;
      let lastIndex = 0;
      let match;
      let key = 0;
      while ((match = regex.exec(beforeComment)) !== null) {
        if (match.index > lastIndex) {
          parts.push(<span key={key++}>{beforeComment.slice(lastIndex, match.index)}</span>);
        }
        if (match[1] || match[2]) {
          parts.push(<span key={key++} style={{ color: "#a5d6ff" }}>{match[1] || match[2]}</span>);
        } else if (match[3] || match[4]) {
          parts.push(<span key={key++} style={{ color: "#ff7b72" }}>{match[3] || match[4]}</span>);
        } else if (match[5]) {
          parts.push(<span key={key++} style={{ color: "#d2a8ff", fontWeight: 600 }}>{match[5]}</span>);
        }
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < beforeComment.length) {
        parts.push(<span key={key++}>{beforeComment.slice(lastIndex)}</span>);
      }
      return (
        <div key={i}>
          {parts}
          {comment && <span style={{ color: "#8b949e", fontStyle: "italic" }}>{comment}</span>}
       </div>
      );
    });
  }
  return code.split("\n").map((line, i) => <div key={i}>{line}</div>);
}

function EndpointBadge({ method }: { method: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    GET: { bg: "rgba(59, 130, 246, 0.12)", text: "#60a5fa", border: "rgba(59, 130, 246, 0.3)" },
    POST: { bg: "rgba(34, 197, 94, 0.12)", text: "#4ade80", border: "rgba(34, 197, 94, 0.3)" },
    PUT: { bg: "rgba(234, 179, 8, 0.12)", text: "#facc15", border: "rgba(234, 179, 8, 0.3)" },
    PATCH: { bg: "rgba(168, 85, 247, 0.12)", text: "#c084fc", border: "rgba(168, 85, 247, 0.3)" },
    DELETE: { bg: "rgba(239, 68, 68, 0.12)", text: "#f87171", border: "rgba(239, 68, 68, 0.3)" },
  };
  const c = colors[method] || colors.GET;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.04em",
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        borderRadius: 5,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        minWidth: 56,
        textAlign: "center",
      }}
    >
      {method}
   </span>
  );
}

function ContentRenderer({ blocks }: { blocks: any[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === "p") {
          return (
            <p
              key={i}
              style={{
                fontSize: 15,
                lineHeight: 1.75,
                color: colors.textSecondary,
                margin: "0 0 18px",
              }}
            >
              {block.text}
           </p>
          );
        }
        if (block.type === "code") {
          return (
            <div
              key={i}
              style={{
                position: "relative",
                margin: "0 0 22px",
                borderRadius: 12,
                background: colors.codeBg,
                border: `1px solid ${colors.border}`,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 16px",
                  borderBottom: `1px solid ${colors.border}`,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
                 </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: colors.muted,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    }}
                  >
                    {block.lang}
                 </span>
               </div>
                <button
                  onClick={() => {
                    if (typeof navigator !== "undefined" && navigator.clipboard) {
                      navigator.clipboard.writeText(block.code);
                    }
                  }}
                  style={{
                    background: "transparent",
                    border: `1px solid ${colors.border}`,
                    borderRadius: 5,
                    padding: "3px 8px",
                    fontSize: 10.5,
                    color: colors.muted,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: 500,
                    letterSpacing: "0.02em",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = colors.text;
                    e.currentTarget.style.borderColor = colors.borderLight;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = colors.muted;
                    e.currentTarget.style.borderColor = colors.border;
                  }}
                >
                  Copy
               </button>
             </div>
              <pre
                style={{
                  margin: 0,
                  padding: "16px 18px",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 13,
                  lineHeight: 1.65,
                  color: "#e6edf3",
                  overflowX: "auto",
                  whiteSpace: "pre",
                }}
              >
                <code>{highlightCode(block.code, block.lang)}</code>
             </pre>
           </div>
          );
        }
        if (block.type === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return (
            <Tag
              key={i}
              style={{
                margin: "0 0 22px",
                paddingLeft: 22,
                color: colors.textSecondary,
                fontSize: 15,
                lineHeight: 1.75,
              }}
            >
              {block.items.map((item: any, j: number) => {
                const isObj = typeof item === "object" && item !== null;
                return (
                  <li
                    key={j}
                    style={{
                      marginBottom: isObj ? 10 : 6,
                      paddingLeft: 4,
                    }}
                  >
                    {isObj ? (
                      <>
                        <code
                          style={{
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                            fontSize: 13,
                            color: colors.primary,
                            background: "rgba(129, 140, 248, 0.08)",
                            padding: "1px 6px",
                            borderRadius: 4,
                            fontWeight: 500,
                          }}
                        >
                          {item.label}
                       </code>
                        {item.required !== undefined && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: 10,
                              fontWeight: 700,
                              color: item.required ? "#f87171" : "#71717a",
                              background: item.required ? "rgba(239, 68, 68, 0.08)" : "rgba(113, 113, 122, 0.08)",
                              padding: "1px 5px",
                              borderRadius: 3,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                            }}
                          >
                            {item.required ? "required" : "optional"}
                         </span>
                        )}
                        {" "}
                        <span style={{ color: colors.textSecondary }}>— {item.desc}</span>
                      </>
                    ) : (
                      <span style={{ color: colors.textSecondary }}>{item}</span>
                    )}
                 </li>
                );
              })}
           </Tag>
          );
        }
        if (block.type === "callout") {
          const variants: Record<string, { bg: string; border: string; icon: any; iconColor: string }> = {
            warning: {
              bg: "rgba(234, 179, 8, 0.06)",
              border: "rgba(234, 179, 8, 0.25)",
              icon: AlertCircle,
              iconColor: "#facc15",
            },
            info: {
              bg: "rgba(99, 102, 241, 0.06)",
              border: "rgba(99, 102, 241, 0.25)",
              icon: BookOpen,
              iconColor: "#818cf8",
            },
          };
          const v = variants[block.variant || "info"];
          const Icon = v.icon;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 12,
                padding: "14px 16px",
                margin: "0 0 22px",
                background: v.bg,
                border: `1px solid ${v.border}`,
                borderRadius: 10,
                alignItems: "flex-start",
              }}
            >
              <Icon size={16} color={v.iconColor} style={{ flexShrink: 0, marginTop: 2 }} />
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  lineHeight: 1.65,
                  color: colors.textSecondary,
                }}
              >
                {block.text}
             </p>
           </div>
          );
        }
        if (block.type === "endpoint") {
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 18px",
                margin: "0 0 22px",
                background: colors.card,
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
              }}
            >
              <EndpointBadge method={block.method} />
              <code
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 14,
                  color: colors.text,
                  fontWeight: 500,
                }}
              >
                {block.path}
             </code>
           </div>
          );
        }
        if (block.type === "endpointGroup") {
          return (
            <div key={i} style={{ margin: "0 0 28px" }}>
              <h4
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: colors.muted,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  margin: "0 0 12px",
                }}
              >
                {block.title}
             </h4>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {block.endpoints.map((ep: any, j: number) => (
                  <div
                    key={j}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      background: colors.card,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 8,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.borderLight;
                      e.currentTarget.style.background = colors.cardHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = colors.border;
                      e.currentTarget.style.background = colors.card;
                    }}
                  >
                    <EndpointBadge method={ep.method} />
                    <code
                      style={{
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: 13,
                        color: colors.text,
                        fontWeight: 500,
                        flexShrink: 0,
                      }}
                    >
                      {ep.path}
                   </code>
                    <span
                      style={{
                        fontSize: 13,
                        color: colors.muted,
                        marginLeft: "auto",
                      }}
                    >
                      {ep.desc}
                   </span>
                 </div>
                ))}
             </div>
           </div>
          );
        }
        if (block.type === "qa") {
          return (
            <div
              key={i}
              style={{
                margin: "0 0 16px",
                padding: "16px 18px",
                background: colors.card,
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
              }}
            >
              <h4
                style={{
                  margin: "0 0 8px",
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: colors.text,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    color: colors.accent,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 13,
                    marginTop: 1,
                  }}
                >
                  Q.
               </span>
                <span>{block.q}</span>
             </h4>
              <p
                style={{
                  margin: 0,
                  paddingLeft: 24,
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: colors.textSecondary,
                }}
              >
                {block.a}
             </p>
           </div>
          );
        }
        return null;
      })}
    </>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = React.useState(1);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = Number(entry.target.getAttribute("data-section-id"));
            if (id) setActiveSection(id);
          }
        });
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    document.querySelectorAll("[data-section-id]").forEach((el) => {
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: number) => {
    const el = document.querySelector(`[data-section-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.bg,
        color: colors.text,
        position: "relative",
      }}
    >
      <motion.div
        style={{
          scaleX,
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary}, ${colors.accent})`,
          transformOrigin: "0%",
          zIndex: 100,
        }}
      />

      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0 32px",
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          gap: 64,
        }}
        className="docs-layout"
      >
        <aside
          style={{
            position: "sticky",
            top: 32,
            height: "calc(100vh - 64px)",
            padding: "32px 0",
            overflowY: "auto",
          }}
          className="docs-sidebar"
        >
          <a
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 28,
              padding: "8px 12px",
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              textDecoration: "none",
              color: colors.textSecondary,
              fontSize: 13,
              fontWeight: 500,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = colors.borderLight;
              e.currentTarget.style.color = colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colors.border;
              e.currentTarget.style.color = colors.textSecondary;
            }}
          >
            <ArrowRight size={13} style={{ transform: "rotate(180deg)" }} />
            Back to home
         </a>

          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: colors.muted,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 14,
              paddingLeft: 12,
            }}
          >
            Documentation
         </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    background: isActive ? "rgba(129, 140, 248, 0.08)" : "transparent",
                    border: "none",
                    borderLeft: `2px solid ${isActive ? colors.primary : "transparent"}`,
                    color: isActive ? colors.text : colors.textSecondary,
                    fontSize: 13.5,
                    fontWeight: isActive ? 600 : 500,
                    cursor: "pointer",
                    borderRadius: 6,
                    textAlign: "left",
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                      e.currentTarget.style.color = colors.text;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = colors.textSecondary;
                    }
                  }}
                >
                  <Icon size={14} color={isActive ? colors.primary : colors.muted} />
                  <span>{section.shortTitle}</span>
               </button>
              );
            })}
         </nav>
       </aside>

        <main style={{ padding: "48px 0 96px", maxWidth: 820 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeOutExpo }}
            style={{ marginBottom: 64 }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: 999,
                background: "rgba(129, 140, 248, 0.08)",
                border: "1px solid rgba(129, 140, 248, 0.25)",
                fontSize: 11.5,
                fontWeight: 600,
                color: colors.primary,
                letterSpacing: "0.05em",
                marginBottom: 18,
              }}
            >
              <Hash size={11} />
              DOCUMENTATION
           </div>
            <h1
              style={{
                fontSize: "clamp(36px, 5vw, 56px)",
                lineHeight: 1.05,
                fontWeight: 800,
                letterSpacing: "-0.035em",
                color: colors.text,
                margin: "0 0 16px",
              }}
            >
              Luminal Docs
           </h1>
            <p
              style={{
                fontSize: 17,
                lineHeight: 1.6,
                color: colors.textSecondary,
                margin: 0,
                maxWidth: 620,
              }}
            >
              Everything you need to install, configure, and use Luminal — the self-hosted LLM routing gateway.
           </p>
         </motion.div>

          {sections.map((section, idx) => {
            const Icon = section.icon;
            return (
              <motion.section
                key={section.id}
                data-section-id={section.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: 0.05, ease: easeOutExpo }}
                style={{
                  marginBottom: 80,
                  scrollMarginTop: 32,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    marginBottom: 24,
                    paddingBottom: 16,
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: `linear-gradient(135deg, ${colors.primary}20, ${colors.primary}08)`,
                      border: `1px solid ${colors.primary}30`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={16} color={colors.primary} />
                 </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: colors.muted,
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      }}
                    >
                      {String(idx + 1).padStart(2, "0")}
                   </span>
                    <h2
                      style={{
                        fontSize: "clamp(24px, 3vw, 32px)",
                        fontWeight: 700,
                        letterSpacing: "-0.02em",
                        color: colors.text,
                        margin: 0,
                      }}
                    >
                      {section.title}
                   </h2>
                 </div>
               </div>

                <ContentRenderer blocks={section.content} />

                {section.id < sections.length && (
                  <div
                    style={{
                      marginTop: 40,
                      paddingTop: 24,
                      borderTop: `1px dashed ${colors.border}`,
                      display: "flex",
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      onClick={() => scrollToSection(section.id + 1)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: "transparent",
                        border: `1px solid ${colors.border}`,
                        borderRadius: 8,
                        padding: "8px 14px",
                        color: colors.textSecondary,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = colors.primary;
                        e.currentTarget.style.color = colors.primary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = colors.border;
                        e.currentTarget.style.color = colors.textSecondary;
                      }}
                    >
                      Next: {sections[idx + 1].shortTitle}
                      <ChevronRight size={13} />
                    </button>
                  </div>
                )}
              </motion.section>
            );
          })}

          <div
            style={{
              marginTop: 64,
              padding: "32px",
              background: `linear-gradient(135deg, rgba(129, 140, 248, 0.06), rgba(192, 132, 252, 0.04))`,
              border: `1px solid ${colors.border}`,
              borderRadius: 16,
              textAlign: "center",
            }}
          >
            <h3
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: colors.text,
                margin: "0 0 8px",
              }}
            >
              Ready to start?
           </h3>
            <p
              style={{
                fontSize: 14,
                color: colors.textSecondary,
                margin: "0 0 20px",
              }}
            >
              Spin up the backend and dashboard, drop in your provider keys, and start routing.
           </p>
            <div
              style={{
                display: "inline-flex",
                gap: 10,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <a
                href="/dashboard"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "11px 20px",
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                  color: "#0a0a0b",
                  fontWeight: 600,
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                Open Dashboard
                <ArrowRight size={14} />
             </a>
              <a
                href="/"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "11px 20px",
                  borderRadius: 10,
                  background: "transparent",
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                  fontWeight: 500,
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                Back to home
             </a>
           </div>
         </div>
       </main>
     </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media (max-width: 900px) {
          .docs-layout { grid-template-columns: 1fr !important; gap: 0 !important; }
          .docs-sidebar { position: static !important; height: auto !important; padding: 24px 0 !important; border-bottom: 1px solid ${colors.border}; margin-bottom: 24px; }
          .docs-sidebar nav { flex-direction: row !important; flex-wrap: wrap !important; }
        }
      `,
        }}
      />
   </div>
  );
}
