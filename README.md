# Disaster Roll Call System

A real-time personnel roll call web application designed for disaster response in offline LAN environments. Team leaders submit status reports via structured form or voice input, and headquarters sees live aggregated data.

Built for the **Gemma 4 Good Hackathon 2026** — Global Resilience track.

---

## Features

- **Offline-first** — runs entirely on a local LAN; no internet connection required
- **Gemma 4 E2B** — on-device LLM via Ollama for natural-language report parsing
- **Structured form input** — bypasses the LLM for fast, reliable structured reporting
- **Voice input** — Web Speech API with per-field press-and-hold mic buttons
- **Real-time sync** — Server-Sent Events (SSE) push updates to all connected screens
- **Bilingual UI** — Japanese / English toggle (JP/EN)
- **Report history** — every edit is recorded with a timestamp
- **Member registry** — register team members; names are prioritized in voice recognition grammar

---

## Setup

### 1. Install Ollama

Download and install Ollama from [ollama.com](https://ollama.com), then pull the model:

```bash
ollama pull gemma4:e2b
```

### 2. Backend (Flask)

```bash
pip install -r requirements.txt
python app.py
```

The API server starts on `http://0.0.0.0:5000`.

### 3. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

The dev server starts on `http://0.0.0.0:3000` and proxies `/api/*` to Flask.

Open `http://<server-ip>:3000` from any device on the same LAN.

---

## Usage

| Screen | Path | Description |
|---|---|---|
| Team Report | `/` (default) | Team leaders submit headcount and status |
| Headquarters | nav → HQ | Real-time aggregated view for command staff |
| Team Setup | nav → Setup | Register teams and member names |

### Workflow

1. **Setup** — Register team names (and optionally member names) in the Setup screen.
2. **Report** — Each team leader opens the Team Report screen, selects their team, fills in headcount and status, and submits.
3. **Monitor** — HQ screen shows live totals, unreported teams, and injury details.
4. **Edit** — HQ can push a report back to the Team Report form for correction; history is preserved.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python · Flask · Flask-CORS |
| Frontend | React 18 · Vite · vanilla CSS |
| AI / NLP | Ollama · Gemma 4 E2B (`gemma4:e2b`) |
| Real-time | Server-Sent Events (SSE) |
| Voice | Web Speech API (`SpeechRecognition`, `SpeechGrammarList`) |
| Persistence | JSON files (teams, reports, members) |

---

## Architecture

```
[Browser :3000]
     │  /api/* proxy
     ▼
[Vite dev server]
     │
     ▼
[Flask :5000] ──── POST /api/report ──▶ [Ollama :11434]
                                              (gemma4:e2b)
```

Data is stored in-memory during a session and persisted to JSON files on disk. A reset clears reports but preserves team and member registrations.

---

## Demo Video

https://www.youtube.com/watch?v=PFGMG3xP6_I

---

## Hackathon

Gemma 4 Good Hackathon 2026
Track: Global Resilience
https://www.kaggle.com/competitions/gemma-4-good-hackathon

---

## License

Apache License 2.0
