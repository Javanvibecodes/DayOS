# DayOS

**The Local-First Productivity Companion for Windows**

DayOS keeps your tasks, goals, projects, meetings, routines, notes, and timetable in one place — stored 100% locally on your machine. No accounts, no subscriptions, and zero cloud tracking.

---

## 💾 Download DayOS for Windows

Official releases are compiled, signed, and published exclusively by **Javanvibecodes**.

| Platform | Installer | Architecture | Version |
| :--- | :--- | :--- | :--- |
| **Windows 10 / 11** | [**⬇️ Download DayOS-Setup.exe**](releases/DayOS-Setup.exe?raw=true) | x64 (64-bit) | `v0.1.0 (Latest)` |

> **Alternative Download Links:**
> - [Direct Raw Download (`releases/DayOS-Setup.exe`)](https://github.com/Javanvibecodes/DayOS/raw/master/releases/DayOS-Setup.exe)
> - [GitHub Releases Page](https://github.com/Javanvibecodes/DayOS/releases)

---

## 🚀 Installation & First Launch

1. **Download** [DayOS-Setup.exe](releases/DayOS-Setup.exe?raw=true).
2. **Run the installer**: Double-click `DayOS-Setup.exe`.
   - *Windows SmartScreen Note:* Because this is an independent desktop application, Windows SmartScreen may show an alert on first launch. Click **More info** $\rightarrow$ **Run anyway** to proceed with installation.
3. **Launch DayOS**: Once installed, DayOS will launch with its custom frameless desktop interface.

---

## ✨ Features

- **Today Dashboard** — A focused daily view of your tasks, upcoming meetings, routines, and daily progress.
- **Tasks & Subtasks** — Priority levels, custom scheduling, recurrence rules, desktop reminders, task timers, and a detailed drawer.
- **Timetable** — Hourly schedule grid and reusable day templates to plan your day with intention.
- **Goals** — Daily, weekly, and monthly targets with category tagging and automatic progress tracking.
- **Projects** — Group and organize work under high-level goals with custom color coding and task completion rollups.
- **Meetings** — Schedule meetings with native Windows notification reminders and one-click video link joining.
- **Guided Routines** — Morning, evening, or workout routine sequences with a step-by-step checklist player.
- **Pomodoro Timer** — Fully configurable session, focus, and break intervals with customizable synthesized ringtones (Bell, Chime, Digital, Zen, Cosmic, Minimal).
- **Notes** — Multi-folder markdown notes with instantaneous auto-saving and full-text search.
- **Command Palette (`Ctrl+K`)** — Global keyboard-driven search and quick actions without taking your hands off the keyboard.
- **Built-in Keyboard Shortcuts** — Intuitive navigation shortcuts (press `?` anywhere to view).
- **Local Collaboration & Lock-in** — Host or join synchronized Pomodoro sessions with nearby peers over your local network using Device Identifiers (zero cloud accounts).
- **Google Calendar, Meet & Zoom Integrations** — Official Google Calendar API sync with sync tokens, plus provider adapters for Google Meet and Zoom meeting creation. OAuth credentials are stored locally with Windows DPAPI; no DayOS account or cloud database is required.
- **Multimodal Local AI Assistant** — Voice & text productivity agent supporting on-demand local models (**Ollama**) and cloud APIs with **Kokoro & Piper** local neural voices.
- **Themes & Customization** — Dark, Light, and System appearance modes with four distinct accent palettes.
- **Windows Integration** — Optional auto-start on Windows boot, minimized startup, and native notifications.

---

## 🔗 Google Calendar, Meet & Zoom Setup

DayOS calls provider APIs directly from the desktop backend. OAuth client configuration is read from environment variables when you start a connection. OAuth tokens are encrypted with Windows DPAPI and never written to SQLite, DayOS settings, logs, or renderer state.

### Google Calendar & Google Meet

1. In the [Google Cloud Console](https://console.cloud.google.com/), enable the **Google Calendar API** and **Google Meet API**.
2. Create an OAuth client of type **Desktop app**.
3. Set these environment variables and restart DayOS:

   ```powershell
   setx DAYOS_GOOGLE_CLIENT_ID "your-client-id.apps.googleusercontent.com"
   setx DAYOS_GOOGLE_CLIENT_SECRET "your-client-secret"   # optional for desktop clients
   ```

4. Open **Settings → Connectors** and click **Connect** next to Google Calendar or Google Meet.

The flow uses the Authorization Code grant with PKCE, the system browser, and a loopback callback on `127.0.0.1`. Google desktop clients require the redirect URI to be `http://127.0.0.1:port` with no path. Set `DAYOS_GOOGLE_REDIRECT_PORT` to a fixed port if you need one; the default `0` uses an ephemeral port.

Google scopes requested: `openid`, `email`, `profile`, `calendar.events`, and `meetings.space.created`. Both feature scopes are requested on every Google connection because Google desktop clients do not support incremental authorization.

### Google Calendar sync

Calendar sync is a one-way import from Google Calendar into the local DayOS meeting list. The first sync imports events from 90 days in the past through 12 months in the future. DayOS then stores Google's `nextSyncToken` and uses it for incremental syncs, so later runs only fetch changes and cancellations.

- Events modified or moved in Google Calendar update the matching local meeting.
- Events cancelled in Google Calendar are removed from DayOS during incremental sync.
- A full sync only inserts or updates events; it never clears unrelated local meetings.
- If Google expires the sync token, DayOS automatically performs a full bounded resync.
- Run a sync from **Settings → Connectors → Sync now** after connecting Google Calendar.

The sync is read-only with respect to Google Calendar: DayOS does not push local meeting edits back to Google in this version.

### Zoom

1. Create a **user-managed OAuth app** in the [Zoom App Marketplace](https://marketplace.zoom.us/).
2. For a native/desktop loopback flow, enable **Use Public Client OAuth** (PKCE) in the app credentials. Register a loopback redirect URL, for example `http://127.0.0.1:53682/callback`; Zoom matches loopback URIs while ignoring only the port.
3. Set these environment variables and restart DayOS:

   ```powershell
   setx DAYOS_ZOOM_CLIENT_ID "your-zoom-client-id"
   setx DAYOS_ZOOM_REDIRECT_PORT "53682"
   setx DAYOS_ZOOM_REDIRECT_PATH "/callback"
   # Optional for confidential clients:
   # setx DAYOS_ZOOM_CLIENT_SECRET "your-zoom-client-secret"
   ```

4. Open **Settings → Connectors** and click **Connect** next to Zoom.

Zoom defaults to the granular scopes `user:read:user`, `meeting:read:meeting`, `meeting:write:meeting`, `meeting:update:meeting`, and `meeting:delete:meeting`. Override them with a space- or comma-separated `DAYOS_ZOOM_SCOPES` value if your app uses classic or different scopes. If `DAYOS_ZOOM_CLIENT_SECRET` is omitted, DayOS uses Zoom's public-client PKCE exchange without an Authorization header.

### Token storage

Access and refresh tokens are stored as DPAPI-encrypted files under `%APPDATA%\com.dayos.app\credentials\`. They are bound to the current Windows user and are never exposed to the webview. Disconnecting a provider revokes the token when possible and removes the encrypted local copy.

---

## 🤖 Local AI Assistant & Ollama Setup

DayOS includes a local multimodal AI productivity assistant that runs directly on your machine without sending your data to the cloud.

### 1. Install Ollama
Download and install the official Windows installer from:
👉 **[https://ollama.com/download](https://ollama.com/download)**

### 2. Download a Recommended Model
Open Command Prompt or PowerShell and run your preferred model:

| Model | Tag | Download Size | Minimum RAM | Best For | Terminal Command |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Llama 3.2 (3B)** *(Recommended)* | `llama3.2` | 2.0 GB | 4 GB | Ultra-fast responses on any modern laptop | `ollama run llama3.2` |
| **Phi-3.5 Mini** | `phi3.5` | 2.2 GB | 4 GB | High-efficiency planning & task drafting | `ollama run phi3.5` |
| **Qwen 2.5 (7B)** | `qwen2.5` | 4.7 GB | 8 GB | High accuracy & detailed scheduling | `ollama run qwen2.5` |
| **Mistral (7B)** | `mistral` | 4.1 GB | 8 GB | Rich reasoning & polite conversational tone | `ollama run mistral` |

### 3. Automatic On-Demand Lifecycle
* You do **not** need to keep Ollama running in the background. 
* The first time you click the **✨ Ask AI** button in DayOS, DayOS automatically starts the Ollama server silently in the background.
* When you exit DayOS, the background Ollama server is automatically terminated.
* DayOS will also inspect your machine's CPU cores and RAM to provide real-time recommendations for the best model to run smoothly.

### 4. Natural Local Voices (Kokoro & Piper)
Under **Settings $\rightarrow$ AI Agent**, you can select from ultra-natural offline neural voices (including *Kokoro Heart*, *Kokoro Adam*, *Piper Lessac*, and *Piper Ryan*) with a built-in voice audition preview button.

---

## 🔒 Privacy & Architecture

- **Local-First & Offline**: All your data lives exclusively in an embedded SQLite database (`dayos.db`) located in your Windows AppData folder (`%LOCALAPPDATA%\com.dayos.app\`).
- **No Cloud Dependency**: Works completely offline. No servers, no tracking, and no external data telemetry.
- **Portable Backups**: Full one-click JSON export and import available in **Settings $\rightarrow$ Data & Storage** to move your data between machines easily.

---

## 📦 System Requirements

- **Operating System:** Windows 10 (version 1809 or higher) or Windows 11 (64-bit)
- **Runtime:** Microsoft Edge WebView2 (included by default on modern Windows 10 & 11)
- **RAM:** Minimum 2 GB (DayOS is lightweight, consuming < 150 MB of RAM)
- **Disk Space:** ~20 MB of free storage

---

## ⚖️ Proprietary License & Maintenance Policy

**Copyright © 2026 Javanvibecodes. All Rights Reserved.**

- **Controlled Releases:** DayOS is developed, maintained, and released exclusively by **Javanvibecodes**. Official releases are published through this repository's `releases/` directory and GitHub Releases.
- **Closed Source Policy:** This repository does **not** accept external pull requests, code contributions, or modifications. Any submitted pull requests will be automatically closed.
- **Redistribution & Forks:** Unauthorized redistribution, re-packaging, commercial use, or creation of derivative forks is strictly prohibited without prior written consent.
