import React from 'react';

export function HelpPage() {
  const scrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-6 sm:px-10 text-on-surface leading-relaxed select-text" id="top">
      {/* Document Header */}
      <header className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-on-surface">
          DayOS User Manual & Documentation
        </h1>
        <p className="text-base text-on-surface-variant leading-relaxed">
          DayOS is a desktop productivity system designed around local-first principles. This manual explains the features, workflows, and purpose of each section in the application. Use the links below to jump directly to any topic.
        </p>
      </header>

      {/* Table of Contents */}
      <nav aria-label="Table of contents" className="my-8 p-6 bg-surface-container-low rounded-xl border border-outline-variant/20">
        <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">
          Table of Contents
        </h2>
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-6 text-sm">
          <li>
            <a href="#overview" onClick={(e) => scrollTo(e, 'overview')} className="text-primary hover:underline">
              1. System Overview & Core Philosophy
            </a>
          </li>
          <li>
            <a href="#today" onClick={(e) => scrollTo(e, 'today')} className="text-primary hover:underline">
              2. Today Dashboard
            </a>
          </li>
          <li>
            <a href="#tasks" onClick={(e) => scrollTo(e, 'tasks')} className="text-primary hover:underline">
              3. Tasks Management
            </a>
          </li>
          <li>
            <a href="#goals" onClick={(e) => scrollTo(e, 'goals')} className="text-primary hover:underline">
              4. Goal Tracking
            </a>
          </li>
          <li>
            <a href="#projects" onClick={(e) => scrollTo(e, 'projects')} className="text-primary hover:underline">
              5. Projects
            </a>
          </li>
          <li>
            <a href="#meetings" onClick={(e) => scrollTo(e, 'meetings')} className="text-primary hover:underline">
              6. Meetings & Reminder Alerts
            </a>
          </li>
          <li>
            <a href="#timetable" onClick={(e) => scrollTo(e, 'timetable')} className="text-primary hover:underline">
              7. Timetable & Day Templates
            </a>
          </li>
          <li>
            <a href="#routines" onClick={(e) => scrollTo(e, 'routines')} className="text-primary hover:underline">
              8. Routines & Guided Mode
            </a>
          </li>
          <li>
            <a href="#notes" onClick={(e) => scrollTo(e, 'notes')} className="text-primary hover:underline">
              9. Notes & Documentation
            </a>
          </li>
          <li>
            <a href="#pomodoro" onClick={(e) => scrollTo(e, 'pomodoro')} className="text-primary hover:underline">
              10. Pomodoro & Focus Timer
            </a>
          </li>
          <li>
            <a href="#settings" onClick={(e) => scrollTo(e, 'settings')} className="text-primary hover:underline">
              11. Settings & Audio Ringtones
            </a>
          </li>
          <li>
            <a href="#shortcuts" onClick={(e) => scrollTo(e, 'shortcuts')} className="text-primary hover:underline">
              12. Keyboard Shortcuts Reference
            </a>
          </li>
          <li>
            <a href="#data" onClick={(e) => scrollTo(e, 'data')} className="text-primary hover:underline">
              13. Data Storage & Privacy
            </a>
          </li>
          <li>
            <a href="#ai-assistant" onClick={(e) => scrollTo(e, 'ai-assistant')} className="text-primary hover:underline">
              14. Local AI Assistant & Ollama Guide
            </a>
          </li>
          <li>
            <a href="#collaborate" onClick={(e) => scrollTo(e, 'collaborate')} className="text-primary hover:underline">
              15. Local Collaboration & Lock-in Rooms
            </a>
          </li>
          <li>
            <a href="#connectors" onClick={(e) => scrollTo(e, 'connectors')} className="text-primary hover:underline">
              16. Google Calendar, Meet & Zoom Connectors
            </a>
          </li>
        </ol>
      </nav>

      <hr className="border-outline-variant/20 my-10" />

      {/* 1. System Overview */}
      <section id="overview" className="mb-12 scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight mb-3 text-on-surface">
          1. System Overview & Core Philosophy
        </h2>
        <p className="text-on-surface-variant mb-4">
          DayOS is built to streamline personal productivity by bringing daily scheduling, task execution, long-term goals, meeting agendas, and personal notes into a single cohesive desktop environment. Unlike traditional cloud services, DayOS operates entirely offline on your local computer.
        </p>
        <p className="text-on-surface-variant mb-4">
          All data is saved immediately into an embedded SQLite database. There are no user accounts, no subscriptions, no tracking telemetry, and no synchronization lag.
        </p>

      </section>

      <hr className="border-outline-variant/15 my-8" />

      {/* 2. Today Dashboard */}
      <section id="today" className="mb-12 scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight mb-3 text-on-surface">
          2. Today Dashboard
        </h2>
        <p className="text-on-surface-variant mb-4">
          The Today page is your operational focal point for the current day. It is designed to be opened first thing every morning to review current commitments and launch focus sessions without navigating between multiple screens.
        </p>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-on-surface">Header & Live Metrics</h3>
        <p className="text-on-surface-variant mb-3">
          At the top left of the Today page, you will find the full current date and a contextual greeting. Below the greeting is a real-time summary showing the number of tasks scheduled for today, scheduled meetings, active goals, and any overdue tasks requiring resolution.
        </p>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-on-surface">Key Sections</h3>
        <ul className="list-disc list-inside space-y-1.5 text-on-surface-variant mb-4">
          <li><strong>Overdue Alert Banner:</strong> Automatically surfaces when tasks scheduled for previous dates remain incomplete. Allows one-click completion or rescheduling.</li>
          <li><strong>Quick Focus Timer:</strong> An integrated timer widget on the right sidebar of the Today page for initiating 15-minute work blocks.</li>
          <li><strong>Daily Goals List:</strong> Surfaces active daily goals so daily habits and milestones stay clearly in view.</li>
          <li><strong>Today's Task Checklist:</strong> Lists every task assigned to today's date, grouped and sorted with instant checkbox completion.</li>
        </ul>

      </section>

      <hr className="border-outline-variant/15 my-8" />

      {/* 3. Tasks */}
      <section id="tasks" className="mb-12 scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight mb-3 text-on-surface">
          3. Tasks Management
        </h2>
        <p className="text-on-surface-variant mb-4">
          The Tasks page provides a complete workflow for creating, prioritizing, scheduling, and executing action items. Tasks can exist as standalone to-dos or be attached to parent projects and categories.
        </p>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-on-surface">Priority Levels</h3>
        <p className="text-on-surface-variant mb-3">
          Every task can be assigned one of four priority tiers:
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-on-surface-variant mb-4">
          <li><strong>Critical:</strong> Highest urgency. Highlighted prominently and triggers persistent alarms when overdue.</li>
          <li><strong>High:</strong> Important objectives slated for completion during the current work sprint.</li>
          <li><strong>Medium:</strong> Standard day-to-day items that need completion within the current week.</li>
          <li><strong>Low:</strong> Backlog items, ideas, and low-urgency tasks.</li>
        </ul>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-on-surface">Scheduling & Alarms</h3>
        <p className="text-on-surface-variant mb-3">
          Tasks support both a scheduled date and start/end time windows. When a task reaches its specified end time, DayOS automatically triggers an audible reminder tune that rings until manually silenced or acknowledged.
        </p>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-on-surface">Recurrence Rules</h3>
        <p className="text-on-surface-variant mb-4">
          Tasks can recur automatically on a Daily, Weekly, Monthly, or Weekday schedule. When a recurring task is checked off as complete, the next occurrence is automatically scheduled.
        </p>

      </section>

      <hr className="border-outline-variant/15 my-8" />

      {/* 4. Goals */}
      <section id="goals" className="mb-12 scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight mb-3 text-on-surface">
          4. Goal Tracking
        </h2>
        <p className="text-on-surface-variant mb-4">
          The Goals page allows you to formulate higher-level targets and monitor cumulative progress over time. Goals establish strategic intention for what tasks and projects should accomplish.
        </p>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-on-surface">Goal Horizons</h3>
        <ul className="list-disc list-inside space-y-1.5 text-on-surface-variant mb-4">
          <li><strong>Daily Goals:</strong> Habitual targets or daily commitments that reset each day.</li>
          <li><strong>Weekly Goals:</strong> Milestone achievements targeted for completion by the end of the week.</li>
          <li><strong>Monthly Goals:</strong> Broad objectives spanning multiple weeks or quarters.</li>
        </ul>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-on-surface">Goal Statuses</h3>
        <p className="text-on-surface-variant mb-4">
          Goals can be toggled between Active, Paused, and Achieved. When linked to projects, progress percentages automatically update based on completed deliverables.
        </p>

      </section>

      <hr className="border-outline-variant/15 my-8" />

      {/* 5. Projects */}
      <section id="projects" className="mb-12 scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight mb-3 text-on-surface">
          5. Projects
        </h2>
        <p className="text-on-surface-variant mb-4">
          Projects serve as containers for grouping related tasks together. Whether working on client deliverables, study roadmaps, or home improvement initiatives, projects organize multi-step work under a single banner.
        </p>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-on-surface">Features & Organization</h3>
        <ul className="list-disc list-inside space-y-1.5 text-on-surface-variant mb-4">
          <li><strong>Goal Attachment:</strong> Direct linkage to parent goals to ensure every project supports a recognized objective.</li>
          <li><strong>Color Theming:</strong> Distinct color choices per project for visual clarity across tasks and schedule views.</li>
          <li><strong>Progress Rollups:</strong> Automatic tracking of total tasks, completed tasks, and remaining work.</li>
          <li><strong>Due Dates:</strong> Project deadlines with visual countdown indicators.</li>
        </ul>

      </section>

      <hr className="border-outline-variant/15 my-8" />

      {/* 6. Meetings */}
      <section id="meetings" className="mb-12 scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight mb-3 text-on-surface">
          6. Meetings & Reminder Alerts
        </h2>
        <p className="text-on-surface-variant mb-4">
          The Meetings page provides calendar scheduling for professional appointments, calls, and virtual meetups.
        </p>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-on-surface">Conferencing Links</h3>
        <p className="text-on-surface-variant mb-4">
          When creating a meeting, include the video call URL (such as Google Meet, Zoom, or Microsoft Teams). DayOS detects the link and provides an instant one-click launch button directly on the meeting card.
        </p>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-on-surface">Advance Audio Reminders</h3>
        <p className="text-on-surface-variant mb-4">
          You can configure meeting reminders to chime 5, 10, or 15 minutes prior to the start time. The reminder tune played can be chosen independently from task alerts in Settings.
        </p>

      </section>

      <hr className="border-outline-variant/15 my-8" />

      {/* 7. Timetable */}
      <section id="timetable" className="mb-12 scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight mb-3 text-on-surface">
          7. Timetable & Day Templates
        </h2>
        <p className="text-on-surface-variant mb-4">
          The Timetable page provides visual time-blocking across an hourly schedule. Time-blocking prevents multitasking and ensures realistic allocation of working hours.
        </p>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-on-surface">Day Templates</h3>
        <p className="text-on-surface-variant mb-4">
          Instead of recreating your ideal daily routine manually every day, Timetable allows you to construct and save reusable Day Templates (such as "Deep Work Day", "Meeting Sprint", or "Weekend Routine"). Any template can be stamped onto any date on the calendar with a single click.
        </p>

      </section>

      <hr className="border-outline-variant/15 my-8" />

      {/* 8. Routines */}
      <section id="routines" className="mb-12 scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight mb-3 text-on-surface">
          8. Routines & Guided Mode
        </h2>
        <p className="text-on-surface-variant mb-4">
          The Routines page turns recurring series of actions into structured sequences. Morning prep, evening shutdowns, workout circuits, and study protocols can all be saved as multi-step routines.
        </p>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-on-surface">Guided Execution Mode</h3>
        <p className="text-on-surface-variant mb-4">
          Clicking "Run Routine" enters a distraction-free, guided full-window mode. A countdown timer runs for each step, and gentle audio cues sound when transitioning from one step to the next, keeping your morning or evening momentum effortless.
        </p>

      </section>

      <hr className="border-outline-variant/15 my-8" />

      {/* 9. Notes */}
      <section id="notes" className="mb-12 scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight mb-3 text-on-surface">
          9. Notes & Documentation
        </h2>
        <p className="text-on-surface-variant mb-4">
          The Notes page serves as your local digital notebook. It provides folder-based organization, instant full-text search, and real-time auto-saving.
        </p>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-on-surface">Folder Organization & Instant Auto-Save</h3>
        <p className="text-on-surface-variant mb-4">
          Create custom folders for projects, reference materials, or personal logs. Every keystroke is saved immediately to the local database as you type, eliminating the risk of lost drafts or needing to manually hit a save button.
        </p>

      </section>

      <hr className="border-outline-variant/15 my-8" />

      {/* 10. Pomodoro */}
      <section id="pomodoro" className="mb-12 scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight mb-3 text-on-surface">
          10. Pomodoro & Focus Timer
        </h2>
        <p className="text-on-surface-variant mb-4">
          The Pomodoro page implements structured interval training for deep cognitive work. Work periods alternate with scheduled short and long breaks to maintain mental endurance.
        </p>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-on-surface">Session Intervals & Alarms</h3>
        <p className="text-on-surface-variant mb-4">
          Interval lengths can be adjusted in Settings (defaults: 25 minutes of work, 5 minutes for short breaks, and 15 minutes for long breaks). When a session finishes, a distinct completion chime rings. You can silence any active alarm with the keyboard shortcut <code className="font-mono text-xs bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant/30">Ctrl+Shift+A</code>.
        </p>

      </section>

      <hr className="border-outline-variant/15 my-8" />

      {/* 11. Settings */}
      <section id="settings" className="mb-12 scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight mb-3 text-on-surface">
          11. Settings & Audio Ringtones
        </h2>
        <p className="text-on-surface-variant mb-4">
          The Settings page houses all system configurations, theme modes, category definitions, audio tune selections, and database backup controls.
        </p>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-on-surface">Reminder Tune Dropdowns</h3>
        <p className="text-on-surface-variant mb-4">
          DayOS includes a library of built-in synthesized chimes (Chime, Bell, Digital, Marimba, Alert, Soft, Urgent, and Success). Under Settings → Notifications, each reminder type (Tasks, Meetings, Pomodoro) has its own dropdown menu. Selecting an option immediately previews the sound without closing the dropdown, allowing rapid auditioning.
        </p>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-on-surface">Interface Modes & Themes</h3>
        <p className="text-on-surface-variant mb-4">
          Choose between Light, Dark, or System mode, alongside four curated color palettes: Midnight, Paper, Forest, and Aurora.
        </p>

      </section>

      <hr className="border-outline-variant/15 my-8" />

      {/* 12. Keyboard Shortcuts */}
      <section id="shortcuts" className="mb-12 scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight mb-3 text-on-surface">
          12. Keyboard Shortcuts Reference
        </h2>
        <p className="text-on-surface-variant mb-4">
          DayOS features built-in global keyboard shortcuts that enable immediate navigation and task capture without touching the mouse. Shortcuts are standardized and built directly into the operating core:
        </p>
        <div className="overflow-x-auto my-4">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 text-on-surface font-semibold">
                <th className="py-2.5 pr-6">Action</th>
                <th className="py-2.5 pr-6">Shortcut Key</th>
                <th className="py-2.5">Scope</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/15 text-on-surface-variant">
              <tr>
                <td className="py-2.5 pr-6 font-medium text-on-surface">Command Palette</td>
                <td className="py-2.5 pr-6 font-mono font-bold text-xs"><code className="bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant/30">Ctrl+K</code></td>
                <td className="py-2.5">Global</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-6 font-medium text-on-surface">Create New Task</td>
                <td className="py-2.5 pr-6 font-mono font-bold text-xs"><code className="bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant/30">Ctrl+N</code></td>
                <td className="py-2.5">Global</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-6 font-medium text-on-surface">Create New Goal</td>
                <td className="py-2.5 pr-6 font-mono font-bold text-xs"><code className="bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant/30">Ctrl+Shift+G</code></td>
                <td className="py-2.5">Global</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-6 font-medium text-on-surface">Create New Project</td>
                <td className="py-2.5 pr-6 font-mono font-bold text-xs"><code className="bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant/30">Ctrl+Shift+P</code></td>
                <td className="py-2.5">Global</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-6 font-medium text-on-surface">Schedule Meeting</td>
                <td className="py-2.5 pr-6 font-mono font-bold text-xs"><code className="bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant/30">Ctrl+Shift+M</code></td>
                <td className="py-2.5">Global</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-6 font-medium text-on-surface">Toggle Sidebar</td>
                <td className="py-2.5 pr-6 font-mono font-bold text-xs"><code className="bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant/30">Ctrl+\</code></td>
                <td className="py-2.5">Global</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-6 font-medium text-on-surface">Open Pomodoro Timer</td>
                <td className="py-2.5 pr-6 font-mono font-bold text-xs"><code className="bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant/30">Ctrl+P</code></td>
                <td className="py-2.5">Global</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-6 font-medium text-on-surface">Turn Off Ringing Alarm</td>
                <td className="py-2.5 pr-6 font-mono font-bold text-xs"><code className="bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant/30">Ctrl+Shift+A</code></td>
                <td className="py-2.5">Global</td>
              </tr>
            </tbody>
          </table>
        </div>

      </section>

      <hr className="border-outline-variant/15 my-8" />

      {/* 13. Data Storage & Privacy */}
      <section id="data" className="mb-12 scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight mb-3 text-on-surface">
          13. Data Storage & Privacy
        </h2>
        <p className="text-on-surface-variant mb-4">
          DayOS stores all user records in an embedded SQLite database situated in your Windows local application directory. You maintain 100% custody of your information.
        </p>
        <p className="text-on-surface-variant mb-4">
          To create an off-site backup, navigate to <strong>Settings → Data</strong> and click "Export Backup". This produces a complete, open-standard JSON file containing all tasks, goals, projects, routines, meetings, and categories, which can be restored at any time.
        </p>
      </section>

      <hr className="border-outline-variant/15 my-8" />

      {/* 14. Local AI Assistant & Ollama Guide */}
      <section id="ai-assistant" className="mb-12 scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight mb-3 text-on-surface">
          14. Local AI Assistant & Ollama Guide
        </h2>
        <p className="text-on-surface-variant mb-4">
          DayOS includes a local multimodal AI assistant capable of voice and text interaction, agenda summarization, task creation, and note querying without transmitting information across the internet.
        </p>
        <h3 className="text-lg font-semibold mb-2 text-on-surface">Setting Up Ollama</h3>
        <p className="text-on-surface-variant mb-4">
          To run local open-weights language models entirely on your hardware:
        </p>
        <ol className="list-decimal pl-6 space-y-2 mb-4 text-on-surface-variant text-sm">
          <li>
            Download and install the official Windows distribution from{' '}
            <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="text-primary hover:underline">
              ollama.com/download
            </a>.
          </li>
          <li>
            Open PowerShell and download a model suited to your hardware:
            <ul className="list-disc pl-5 mt-2 space-y-1 font-mono text-xs">
              <li>ollama run llama3.2 (3B parameters, ~2.0 GB — Recommended for all PCs)</li>
              <li>ollama run phi3.5 (3.8B parameters, ~2.2 GB — Fast task planning)</li>
              <li>ollama run qwen2.5 (7B parameters, ~4.7 GB — High precision for 8GB+ RAM)</li>
              <li>ollama run mistral (7B parameters, ~4.1 GB — Rich reasoning for 8GB+ RAM)</li>
            </ul>
          </li>
          <li>
            Launch the DayOS AI Assistant via the sparkle icon in the header or the floating action button. DayOS launches the Ollama background process on demand and terminates it upon application exit to prevent memory leakage.
          </li>
        </ol>
        <h3 className="text-lg font-semibold mb-2 text-on-surface">Local Neural Voices (Kokoro & Piper)</h3>
        <p className="text-on-surface-variant mb-4">
          Under <strong>Settings → AI Agent</strong>, choose between Kokoro and Piper neural speech profiles for human-like conversational cadence and clear pronunciation. Audition each voice directly using the "Preview Voice" button.
        </p>
      </section>

      <hr className="border-outline-variant/15 my-8" />

      {/* 15. Local Collaboration & Lock-in Rooms */}
      <section id="collaborate" className="mb-12 scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight mb-3 text-on-surface">
          15. Local Collaboration & Lock-in Rooms
        </h2>
        <p className="text-on-surface-variant mb-4">
          DayOS facilitates real-time synchronization between peer devices over your local area network without requiring account creation or third-party servers.
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4 text-on-surface-variant text-sm">
          <li>
            <strong>Device Identifiers:</strong> Each device generates a persistent identifier on first launch (found in Collaborate or Settings). Share your Device ID with collaborators to delegate tasks and coordinate shared goals.
          </li>
          <li>
            <strong>Lock-in Sessions:</strong> Host a synchronized focus room and share the 4-digit session code. Timer starts, pauses, and phase intervals (Work / Rest) broadcast synchronously to all participants with audible transition signals.
          </li>
          <li>
            <strong>Peer Presence:</strong> View whether team members are currently focusing or resting, along with the specific task each person is working on.
          </li>
        </ul>
      </section>

      <hr className="border-outline-variant/15 my-8" />

      {/* 16. Google Calendar, Meet & Zoom Connectors */}
      <section id="connectors" className="mb-12 scroll-mt-6">
        <h2 className="text-2xl font-bold tracking-tight mb-3 text-on-surface">
          16. Google Calendar, Meet & Zoom Connectors
        </h2>
        <p className="text-on-surface-variant mb-4">
          Connect real provider accounts in <strong>Settings → Connectors</strong>. DayOS performs all provider API
          calls from its desktop backend; the interface never receives OAuth tokens.
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4 text-on-surface-variant text-sm">
          <li>
            <strong>Google Calendar:</strong> Uses the official Google Calendar API with OAuth 2.0 and incremental
            sync tokens. Private iCal (.ics) feeds are not imported and are not treated as a connection.
          </li>
          <li>
            <strong>Google Meet &amp; Zoom:</strong> When a provider account is connected, DayOS creates real meetings
            through the provider API and stores the returned join URL. It never invents meeting links.
          </li>
          <li>
            <strong>Local-first credentials:</strong> OAuth credentials are kept in Windows Credential Manager. No
            DayOS account, cloud database, or remote DayOS service is required.
          </li>
          <li>
            <strong>One-Click Launching:</strong> Any scheduled meeting with a saved join link includes a "Join
            Meeting" button that opens the provider directly.
          </li>
        </ul>
        <p className="text-on-surface-variant text-sm">
          Provider connection requires a Google and/or Zoom OAuth client to be configured for DayOS. Until then, the
          Connectors screen reports the real status and will not display a fake "Connected" state.
        </p>
      </section>
    </div>
  );
}
