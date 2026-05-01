# Disaster Roll Call System
## Offline-first personnel accountability for industrial disaster response

---

## The Problem

In the aftermath of the Great East Japan Earthquake of March 11, 2011, something that most people take for granted completely failed: mobile phones stopped working.

At manufacturing facilities across the country, safety managers faced a nightmare scenario. Employees were scattered across large factory floors, outdoor yards, and parking lots. The standard emergency procedure — call everyone on their mobile phone, check Teams, confirm headcount — was simply impossible. Networks were saturated or down entirely. For hours, no one knew who was safe.

That experience changed how many Japanese manufacturers approach emergency drills. At our facility, we transitioned to walkie-talkie-based roll call: each team leader radios in a headcount report to a central HQ coordinator. It works without any network infrastructure and is now a core part of our disaster preparedness.

But after running these drills for several years, a new problem became clear. **Walkie-talkies leave no record.** The HQ coordinator scribbles numbers on paper while trying to listen, aggregate totals, and manage multiple incoming calls simultaneously. If a team leader calls back with a correction — "sorry, I miscounted, it's 12 not 11" — there is no audit trail. After the drill, reconciling the final numbers takes another 30 minutes. In a real disaster, that delay is unacceptable.

We needed a system that preserved the offline resilience of radio communication while adding the accountability and real-time visibility that paper simply cannot provide.

---

## Solution Overview

The Disaster Roll Call System is a web application that runs entirely on a local area network — no internet connection required. During a disaster drill or real emergency, team leaders connect their phones or laptops to the facility's Wi-Fi and open a browser. They submit structured headcount reports through a form with optional voice input. A headquarters screen, visible on any screen on the same network, shows live aggregated totals: how many teams have reported, how many people are confirmed safe, how many are unaccounted for, and who is injured.

The system is designed around three core principles:

1. **Offline-first** — if the internet is down, the system still works. All processing runs on a local server.
2. **Speed over perfection** — a team leader under stress needs to submit a report in under 30 seconds.
3. **Accountability** — every report is timestamped, every correction is recorded in history.

---

## Architecture

```
[Smartphones / PCs on LAN]
          │
          │ HTTP / SSE
          ▼
   [Vite + React :3000]    ← Team Report screen
          │                ← HQ Aggregation screen
          │ /api/* proxy   ← Team Setup screen
          ▼
    [Flask :5000]
          │
          ├── POST /api/report        → Ollama (natural language)
          ├── POST /api/report/structured → direct JSON (form input)
          ├── GET  /api/reports/stream → Server-Sent Events
          ├── /api/teams              → team registry
          └── /api/members            → member registry
          │
          ▼
   [Ollama :11434]
   (gemma4:e2b, local)
```

The backend is a Python Flask application. The frontend is React with Vite, served from the same machine. Real-time updates flow from server to all connected browsers via Server-Sent Events — a lightweight alternative to WebSockets that requires no special infrastructure.

All persistent state is stored in JSON files on the local server: `teams.json`, `members.json`, and `reports.json`. A server restart after a drill can clear reports while preserving team configuration for the next exercise.

---

## How Gemma 4 is Used

Gemma 4 E2B runs locally via Ollama and handles the natural-language path for report submission.

When a team leader submits a free-text report such as:

> "第三班です。総員15名、安全確認済み13名、負傷者1名、田中さんが足首を捻挫しています。体育館前に集合しています。"

Flask sends this to Ollama with a structured prompt and a JSON schema. Gemma 4 returns a fully structured object:

```json
{
  "班": "第3班",
  "人数": 15,
  "安全確認人数": 13,
  "未確認人数": 1,
  "負傷者": 1,
  "負傷者名": ["田中"],
  "状態": "要注意",
  "場所": "体育館前"
}
```

Several features of Gemma 4 E2B made it the right choice for this use case:

**Structured output enforcement.** Ollama's `format` parameter accepts a full JSON schema definition, which Gemma 4 uses to constrain its output to valid field types and enum values. The `状態` field is restricted to `["安全", "要注意", "危険"]` — the model cannot invent a fourth option.

**Japanese language capability.** Team leaders naturally speak and type in Japanese. Gemma 4 handles Japanese input fluently, including mixed kanji/kana/romaji input and colloquial phrasing.

**Edge inference efficiency.** E2B (2 billion parameters) runs acceptably fast on CPU-only hardware — important for deployments on existing facility servers without GPUs.

**Honoric stripping.** The prompt instructs Gemma to remove honorifics (さん, くん, 先生) from injured names. This prevents "田中さん" and "田中" from appearing as two different people in the database.

The system also includes a four-stage JSON extraction fallback (`extract_json()`) for cases where the model output contains markdown fences, is truncated at the token limit, or has mismatched brackets. This makes the pipeline robust to imperfect model output without requiring a larger model.

For users who prefer the structured form, the `/api/report/structured` endpoint bypasses Gemma entirely, running only normalization logic. This path is faster and more reliable for operators who are comfortable with the form UI.

---

## Key Features

**Real-time HQ dashboard.** Server-Sent Events push updates to all connected screens within one second of a new report. The HQ screen shows per-team status with color coding (green / orange / red), unreported team badges with pulse animation, and running totals for safe, unconfirmed, and injured personnel.

**Voice input with grammar hints.** Each form field has a press-and-hold microphone button using the Web Speech API. For the injured names field, the current team's registered members are loaded into a `SpeechGrammarList`, nudging the recognizer toward known names rather than phonetically similar alternatives.

**Team name normalization.** Japanese team names have many equivalent representations: "第三班", "第3班", "3班", "三班". The `normalize_team_name()` function converts all variants to a canonical form, preventing duplicate rows in the HQ table for the same team.

**Edit history.** Every time a report is overwritten, the previous version is appended to a `history` list before being replaced. HQ operators can view the full correction timeline for any team in a modal dialog.

**Bilingual UI.** A JP/EN toggle switches all interface text between Japanese and English, supporting international facilities and non-Japanese-speaking observers.

**Member registry.** Teams can pre-register member names in the Setup screen. These names appear as tap-to-select chips in the injured names field and are loaded into voice recognition grammar, reducing input time under stress.

---

## Challenges & Solutions

**Challenge: Gemma output instability.** Early testing showed that Gemma occasionally produced truncated JSON when the response was long, or wrapped JSON in markdown code fences. We implemented a four-stage extraction pipeline: direct parse → strip markdown → bracket-depth tracking to find the outermost `{}` block → repair truncated fragments by counting unclosed brackets and appending them.

**Challenge: Same team, multiple reports.** In radio drills, a team leader might radio in a preliminary count and then call back with a correction. The system handles this by detecting existing reports for the same normalized team name and invoking a merge prompt: Gemma receives both the existing JSON and the new text, and produces a unified updated report. The original submission timestamp is preserved; an `updated_at` field is added.

**Challenge: Stress-induced input errors.** Under simulated disaster conditions, users make mistakes: they tap the wrong number, select the wrong team, or speak over background noise. The structured form provides immediate visual feedback — a consistency check shows whether `safe + unconfirmed + injured = total` in real time, before submission.

**Challenge: Deployment on facility hardware.** The application starts with two commands (`python app.py`, `npm run dev`) on standard Windows servers; no containerization required. Ollama manages model download and serving independently.

---

## Impact & Future Work

In actual disaster drills at our facility, the complete roll call process — from first radio report to final confirmed headcount — took approximately 20 minutes using walkie-talkies and paper-based recording.

With this system, the time for individual team reporting remains similar, as team leaders still need to count and verify their personnel. However, HQ aggregation becomes nearly instantaneous: the dashboard updates in real time as each report is submitted, eliminating the manual tallying that previously consumed the final 5-10 minutes of every drill.

More significantly, the system addresses two failure modes that time alone cannot capture: aggregation errors from simultaneous radio calls, and inconsistent reporting formats between teams. The structured form guides team leaders through the same fields every time — total personnel, confirmed safe, unaccounted for, injured — making omissions visible rather than silent.

Planned extensions include PDF export for post-incident records, roster import from existing HR systems, and configurable alert thresholds for teams that have not reported within a set time window.

The ultimate deployment target is true on-device inference: running Gemma 4 E2B directly on team leaders' smartphones via LiteRT or Google AI Edge Gallery, eliminating the dependency on a local server entirely. This would make the system operational even when facility Wi-Fi is unavailable — requiring only Bluetooth or direct device-to-device communication to synchronize reports to HQ.

The core insight from the 2011 earthquake — that any system dependent on public infrastructure will fail exactly when it is needed most — remains the guiding design constraint. This system is built to work when nothing else does.

---

*Built for the Gemma 4 Good Hackathon 2026 — Global Resilience track.*
*Stack: Python · Flask · React · Vite · Ollama · Gemma 4 E2B · Web Speech API*
*Repository: https://github.com/forthvalleyst/disaster-rollcall*
