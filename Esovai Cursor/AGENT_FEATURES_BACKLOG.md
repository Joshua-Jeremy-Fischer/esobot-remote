# ESO Bot — Feature Backlog

Gesammelte Feature-Ideen vom Agenten selbst vorgeschlagen.
Noch NICHT implementiert — hier zum späteren Einbauen.

---

## 🤖 Autonomes Verhalten

### Autonomes Monitoring
- Alle X Minuten prüfen ob neue GitHub-Issues, E-Mails oder Server-Logs vorliegen
- Nur bei relevanten Events benachrichtigen (kein Spam)
- Konfigurierbar: Intervall, Quellen, Filter

### Proaktive Berichte (Morning Briefing)
- Morgens automatisch Statusbericht an Joshua schicken
- Inhalt: Server-Health, neue Tickets/Issues, offene Jobs, ggf. Wetter
- Per E-Mail oder als Postfach-Eintrag

### Skill-Library (Vordefinierte Workflows)
- Joshua sagt ein Stichwort → Agent führt festen Workflow aus
- Beispiel: "analysiere Logs" → `tail -f /var/log/syslog | grep -i error`
- Beispiel: "Server-Status" → CPU/RAM/Disk + laufende Container
- Skills können in einer Datei `/data/skills.json` gespeichert und erweitert werden

### Workflow-Automatisierung
- Beispiel: "Räum Downloads auf" → alles älter als 7 Tage → Archiv-Ordner
- Beispiel: "Check meine Bewerbungen" → offene Bewerbungen aus Postfach zusammenfassen
- Frei definierbare Makros per Spracheingabe

---

## 🧠 Gedächtnis & Konfiguration

### Persistentes Gedächtnis / Config-Store
- Agent speichert Einstellungen dauerhaft in `/data/eso-bot-config.json`
- Dinge die er sich merken soll: bevorzugte Tools, SSH-Keys (verschlüsselt), API-Tokens, persönliche Vorlieben
- Nie zweimal dieselbe Info abfragen müssen

### Lernfähigkeit (Skills beibringen)
- Joshua kann dem Agenten direkt neue Skills/Wissen beibringen per Chat
- Agent speichert das in seine Config und wendet es künftig an
- Beispiel: "Merke dir: Wenn ich sage X, mach immer Y"

---

## 🔒 Security Tools Integration

### Wazuh Integration
- Shell-Zugriff auf Wazuh-Server (via SSH oder lokale API)
- Wazuh REST API abfragen (aktuelle Alerts, Agent-Status)
- Custom Detection Rules schreiben und deployen
- `alerts.json` parsen und zusammenfassen
- Active Response konfigurieren (z.B. IP bei Brute-Force sperren)
- Wazuh-Agents deployen und verwalten

### Microsoft Sentinel (Azure SIEM)
- KQL-Queries ausführen über Azure CLI / REST API
- Data Connectors konfigurieren (Cloudflare → Sentinel, Wazuh → Sentinel)
- Analytics Rules erstellen (Scheduled Detection Queries)
- Incident-Automatisierung: bei Alert → automatisch IP in NSG blocken
- Service Principal Auth: `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`

### HashiCorp Sentinel (Policy as Code)
- Sentinel-Policies für Terraform schreiben
- Beispiel: Public S3 Buckets verbieten, Mindest-Tags erzwingen

---

## 📲 Benachrichtigungen / Kommunikation

### Telegram Bot Integration
- Agent sendet Benachrichtigungen per Telegram
- Bidirektional: Joshua kann auch per Telegram Aufgaben schicken
- Bot-Token als Env-Variable

### Signal Integration
- Alternativ zu Telegram: Signal-Benachrichtigungen

---

## 🕒 Scheduling / Cron

### Cron-Jobs für den Agenten
- Agent kann selbst Cron-Jobs anlegen und verwalten
- Beispiel: "Prüfe jeden Morgen um 8:00 neue Jobs"
- Jobs persistent speichern (überleben Container-Neustart)

---

## Priorisierung (Vorschlag)

| Prio | Feature | Aufwand |
|------|---------|---------|
| 🔥 Hoch | Skill-Library (vordefinierte Workflows) | Mittel |
| 🔥 Hoch | Persistentes Gedächtnis / Config-Store | Klein |
| 🔥 Hoch | Telegram-Benachrichtigungen | Klein |
| 🟡 Mittel | Autonomes Monitoring | Mittel |
| 🟡 Mittel | Wazuh REST API Integration | Mittel |
| 🟡 Mittel | Morning Briefing Cron | Klein |
| 🟢 Später | Microsoft Sentinel | Groß |
| 🟢 Später | Lernfähigkeit / Skills beibringen | Groß |
