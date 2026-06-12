# Sector

**Sector** is a local-first, Markdown-backed Kanban board built intentionally for human-machine workflows. 

If you run local AI agents, automation scripts, or simply prefer plain-text data ownership, Sector bridges the gap between visual project management and machine-readable files. Create tasks in a seamless Kanban interface, and let your background agents read, execute, and update the raw `.md` files.

---

## 🎯 The Agentic Workflow

- **Plain Text Truth:** Tasks are just `.md` files residing in the `data/` folder. The frontmatter dictates board state, the body holds the work. 
- **Agent Handoffs:** Drag a card to "In Progress," and your locally running script can instantly parse the new `status` and begin work. 
- **Reactive Sync:** When your agent finishes the task and rewrites the Markdown file, Sector's file watchers instantly snap the UI state updated using Server-Sent Events.
- **Collaborative Conflict Resolution:** If you and an agent edit a card at the exact same time, Sector presents an inline `diff` UI, letting you accept or discard the machine's changes gracefully.

## 🚀 Features

- **Visual Kanban Board:** Heavily-styled UI with drag-and-drop mechanics.
- **Markdown Native Editor:** Write task descriptions and prompts in pure Markdown.
- **Zero Lock-In:** No databases, no proprietary cloud backends. You own the files.
- **Auto-Theming:** Extracts Material You palettes for aesthetic Light/Dark modes seamlessly adapting to your OS preferences.

## 🛠 Architecture & Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Zustand, `@base-ui`, and framer-motion.
- **Backend Coordinator:** Express running a lightweight filesystem controller over standard POST and SSE (`/api/events`).
- **File System:** `chokidar` tracks `data/` while `gray-matter` structures the metadata.
- **Diff Engine:** `diff` ensures local changes aren't blindly overwritten by your agents.

## 📦 Getting Started

### Prerequisites
- Node.js (v18+)

### Installation

Clone the repository and install the dependencies:

```bash
npm install
```

### Development

Run the Vite frontend and Express filesystem middleware concurrently:

```bash
npm run dev
```

Sector runs securely at `http://localhost:3000`.

### Production Build

```bash
npm run build
npm start
```

## 📝 Data Structure

Sector serializes all data dynamically. Every task created on the board becomes a file like this in `data/`:

```yaml
---
id: task-1234
status: todo
title: "Scrape reference architecture"
---

Hey Agent, please follow the links below and summarize the architectural constraints.
```
Your agent reads this, updates `status` to `done`, and inserts its findings directly into the file. Sector's board updates automatically.

## 🤝 Contributing

We welcome issues and PRs! If you are hacking on cool local agent workflows with Sector, let us know.
