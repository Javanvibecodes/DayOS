# DayOS

A local-first desktop productivity system for Windows. DayOS keeps your tasks, goals, projects, meetings, routines, notes, and daily plans in one place — entirely on your machine, with no account and no internet required.

Built with **Tauri 2**, **React 19**, **TypeScript**, **Tailwind CSS v4**, and **SQLite**.

## Features

- **Today** — a focused daily view of your tasks, meetings, and progress
- **Tasks** — priorities, scheduling, recurrence, reminders, categories, timers, and a detail drawer
- **Timetable** — hourly and plan-based day layouts with reusable day templates
- **Goals** — daily/weekly/monthly targets with recurrence, categories, and progress tracking
- **Projects** — group work under goals with color coding and task rollups
- **Meetings** — scheduling with desktop reminders and one-click link joining
- **Routines** — multi-block routines with a guided run mode and progress rules
- **Pomodoro** — configurable session/focus/break timers with notification sounds
- **Notes** — folder-based notes with auto-save, search, and quick switching
- **Command palette** (`Ctrl+K`) — jump anywhere and trigger actions without the mouse
- **Customizable shortcuts** — rebind any action from Settings → Shortcuts
- **Themes** — light/dark/system modes with four color themes
- **Windows integration** — optional startup launch, minimized start, and desktop notifications

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 20+
- [Rust](https://rustup.rs) (stable)
- Visual Studio 2022 Build Tools with the C++ workload (Windows)

### Development

```bash
npm install
npm run dev
```

In a second terminal, launch the Tauri window:

```bash
npm run tauri dev
```

### Production build

```bash
npm run tauri build
```

Installers are written to `src-tauri/target/release/bundle/` (NSIS `.exe` and `.msi`).

### Scripts

| Command            | Description                          |
| ------------------ | ------------------------------------ |
| `npm run dev`      | Start the Vite dev server            |
| `npm run build`    | Type-check and build the web bundle  |
| `npm run lint`     | Run oxlint                           |
| `npm run tauri`    | Run the Tauri CLI                    |

## Project Structure

```
src/
  components/       UI components (layout, modals, ToastHost)
  pages/            One file per screen
  stores/           Zustand stores (tasks, goals, notes, toast, ...)
  services/         Alarm and notification sound playback
  lib/db/           Typed API layer over Tauri IPC commands
src-tauri/
  src/commands/     Tauri command handlers
  src/database/     SQLite schema, queries, and models
```

All data lives in a local SQLite database. Settings persist to the `settings` table through `settingsApi`; everything else follows the same pattern.

## Notifications

User-facing feedback goes through a single toast system (`src/stores/toastStore.ts` + `src/components/ToastHost.tsx`):

```ts
import { toast } from '@/stores/toastStore';

toast.success('Task created');
toast.error('Could not save the task');
toast.info('Timer started');
```

Toasts render bottom-right, auto-dismiss after ~3 seconds, and can be dismissed on click.

## License

MIT
