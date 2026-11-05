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
- **Google Calendar, Meet & Zoom Integrations** — Official Google Calendar API sync plus real **Google Meet** and **Zoom** meeting creation through connected provider accounts. OAuth credentials are stored locally in Windows Credential Manager; no DayOS account or cloud database is required.
- **Multimodal Local AI Assistant** — Voice & text productivity agent supporting on-demand local models (**Ollama**) and cloud APIs with **Kokoro & Piper** local neural voices.
- **Themes & Customization** — Dark, Light, and System appearance modes with four distinct accent palettes.
- **Windows Integration** — Optional auto-start on Windows boot, minimized startup, and native notifications.

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
