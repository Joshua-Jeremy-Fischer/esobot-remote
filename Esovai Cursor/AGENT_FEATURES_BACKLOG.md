# ESO Bot — Feature Backlog

---

## Use Case 1 — SOC-ähnliches Monitoring (Hetzner Stack)
**Priorität: 🔥 Hoch — baut direkt auf vorhandener Infra auf**

- Agent checkt regelmäßig Logs/Health der Docker-Services (nginx, kimi-frontend, backend, ollama)
- Einfache Heuristiken: Container down? Disk voll? Error-Rate hoch?
- Alerts per Telegram (oder Postfach als Fallback)
- Bei bekannten Patterns direkt Aktionen: Container neu starten, Disk-Report, Config-Diff
- Incident-Reports als Markdown → Git-Repo oder Notion

**Benötigt:** Telegram Bot Token, Cron-Job im Agent, Shell-Zugriff (bereits vorhanden)

---

## Use Case 2 — EsoVAI Security Briefing & Threat Intel
**Priorität: 🟡 Mittel**

- Täglicher Agent sammelt CVEs, Security-News, Reddit/Feeds, ggf. Wazuh-/Syslogs
- Filtert nach Relevanz für deinen Stack (Ubuntu, Docker, NGINX, Ollama, NVIDIA-API)
- Gibt Digest aus (Postfach oder E-Mail)
- OpenClaw-Layer: Scraping + Aggregation + erste Bewertung
- ESO-Layer: Kontextierung, Priorisierung, DSGVO-taugliche Darstellung

**Benötigt:** Feed-Quellen konfigurieren, CVE-API (NVD), Wazuh-API optional

---

## Use Case 3 — CI/CD + QA Pipeline (GitHub Actions + OpenClaw Review)
**Priorität: 🟡 Mittel**

### Pipeline-Stufen (Node/Frontend + Backend + Docker)
1. **Lint & Format** — ESLint/Prettier (Frontend), ShellCheck (Bash)
2. **Unit Tests** — Vitest/Jest (Frontend), schnelle App-Tests
3. **Integration Tests** — Docker Compose Services, API + Worker real zusammen
4. **E2E/UI Tests** — Playwright gegen Frontend oder Staging-Instanz
5. **Security QA** — Trivy (Container-Scan), Gitleaks (Secrets), Semgrep/SAST, Dependabot
6. **Docker Build** — Multi-Stage, Image mit Commit-SHA taggen, nur auf main pushen
7. **OpenClaw Review Step (optional)** — Agent liest Diff, prüft: keine Secrets, klare Fehlerbehandlung, Tests vorhanden, kein ungeprüfter Shell-Exec

### Trigger
- PR auf `develop` oder `main` → CI läuft
- Artefakte + Test-Reports pro PR gespeichert

### Guardrails (wichtig bei AI-Agents)
- Coding-Agent darf nur in Feature-Branches schreiben
- Reviewer-Agent gibt Feedback, merged **nicht** selbst
- Deploy nur nach menschlicher Freigabe oder nur aus `main`
- Secrets nur über GitHub Secrets/Environments — nie in Prompt, Repo oder Logs

**Benötigt:** GitHub Actions YAML, GitHub Token, Trivy, Playwright CI-Setup

---

## Use Case 4 — Job/Karriere-Automation (mit Approval-Gate)
**Priorität: 🔥 Hoch — bereits teilweise implementiert**

- Agent sammelt Stellen, extrahiert Anforderungen, mappt gegen Profil
- Priorisierte Targets + individuelle Talking Points vorschlagen
- Bewerbungsunterlagen vorbereiten (Anschreiben-Draft, CV-Anpassungen, LinkedIn-Nachrichten)
- **Approval-Gate vor jedem Versand** — du bestätigst, Agent sendet
- OWASP-konform: minimaler Tool-Scope, kein Blind-Versand

**Benötigt:** Schon weitgehend fertig — E-Mail-Approval-Flow fehlt noch im Frontend

---

## Use Case 5 — AI Engineering Team für Projekte
**Priorität: 🟢 Später — komplex**

- Mehrere spezialisierte Agents: Dev, Infra, Security, Docs
- Einer schreibt Code, einer Tests/Dockerfiles, einer dokumentiert, einer macht Security-Review
- OWASP LLMA Top 10 als Security-Checkliste
- Gesteuert über STATE-Datei / Projekt-YAML (versioniert)
- Zentrales "Engineering-Log" für alle Agent-Aktionen

**Benötigt:** Multi-Agent-Orchestrierung, State-Management — größeres Projekt

---

## Use Case 6 — Personal Knowledge & Lab-Automation
**Priorität: 🟢 Später**

- Agent indexiert Notes, Runbooks, Wazuh/Shuffle-Playbooks, Lab-Dokus
- Natürlichsprachlicher Zugriff: "zeige letzte Änderung am Wazuh-Cluster"
- Brücke Home-Lab ↔ Alltag: Backups checken, Lab-Reminders, To-Dos aus Logs extrahieren

**Benötigt:** Embedding/Vector-Store, Indexer — aufwändig

---

## Use Case 7 — UI-Redesign: Ein Chat, viele Modi
**Priorität: 🟡 Mittel — verbessert Nutzbarkeit stark**

### Sidebar-Umbau (aktuell: ESO Bot / Chat / Agent / Einstellungen)
Neu:
- **Chats** — Hauptarbeitsfläche, ein einziger ESO-Bot-Chat
- **Workflows** — gespeicherte Abläufe / Pipelines
- **Runs** — Verlauf von Coding-, QA-, Monitoring-Tasks
- **Einstellungen** — Modell, API-Keys, Themes, Datenschutz, Prompt-Profile

### Mode-Switcher über dem Input
Chips/Tabs direkt über dem Eingabefeld:
`Ask` · `Build` · `QA` · `Research` · `Monitor`

Je nach Modus reagiert der Agent anders:
- **Build** → Code-Änderungen / Pläne erstellen
- **QA** → Diff analysieren, Tests prüfen, Freigabe/Blocker
- **Monitor** → Logs, Alerts, Health zusammenfassen
- **Research** → Web-Suche, CVEs, Threat Intel

### Run-Panel (rechte Seite / Drawer)
Wenn Agent einen Task ausführt:
- Steps sichtbar: Lint → Test → Build → QA Review
- Ergebnis landet als Zusammenfassung im selben Chat

### Prinzip
„Ein Hauptchat, interne Spezialisierung" — kein Kontextverlust durch Wechsel zwischen getrennten Bots.
Agent-Seite nur noch als Konfiguration (Rollen, Tools, Permissions), nicht als zweiter Chat.

**Benötigt:** Frontend-Umbau (Sidebar, Mode-Switcher, Run-Panel)

---

## Empfehlung: Reihenfolge

| # | Use Case | Warum jetzt |
|---|----------|-------------|
| 1 | **SOC Monitoring + Telegram** | Sofort nützlich, Infra vorhanden, klein anfangen |
| 2 | **Job-Automation Approval-Gate** | Schon halb fertig, hoher Alltagswert |
| 3 | **Security Briefing / Threat Intel** | Täglicher Nutzen, baut auf UC1 auf |
| 4 | **DevOps SRE Assistent** | GitHub-Integration bereits teilweise da |
| 5 | **Knowledge Base** | Solide Basis nötig, später |
| 6 | **AI Engineering Team** | Langfristiges Ziel |

---

## Bereits implementiert

- [x] Job Crawler (Stepstone, Indeed, Bundesagentur) mit Standortfilter
- [x] Bewerbungs-Workflow (Stelle analysieren → Anschreiben → E-Mail senden)
- [x] Agent mit Shell, Web, Browser, E-Mail, Filesystem Tools
- [x] Joshua-Profil + Anschreiben-Stil vollständig im System-Prompt
- [x] Postfach (Cron-Notifications)
