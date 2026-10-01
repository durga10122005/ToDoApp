# Tasks & Focus (ToDoApp.V2)

A responsive, keyboard-first, distraction-free To-Do & Task Management web application inspired by the utilitarian elegance of Notion, Linear, and Things 3.

Designed with clean human craftsmanship—strictly avoiding generic AI templates, heavy neon gradients, or bloated framework abstractions.

---

## Features

### 1. Aesthetic, Typography & Design System
- **Typography**: Clean system font stacks with tight geometric tracking on headings and monospace for dates, hotkeys, and badges.
- **Dual Themes**:
  - **Dark Mode**: Linear-style deep graphite (`#121214` canvas, `#18181B` subtle, `#1E1E22` surface).
  - **Light Mode**: Notion-style warm neutral (`#FFFFFF` canvas, `#FBFBFA` subtle, `#F7F7F5` sidebar).
- **Restrained Accents**: Functional priority colors:
  - `P1` Urgent: `#EF4444`
  - `P2` High: `#F59E0B`
  - `P3` Medium: `#3B82F6`
  - `P4` Low: `#9CA3AF`
- **Minimal Checkbox**: Custom rounded-square checkbox with SVG check-path draw animation and smooth strikethrough transition.
- **Crisp 1px Borders**: Ultra-subtle borders with compact, low-friction spacing.

### 2. Quick Capture & Smart Input
- **Global Quick Add Modal**: Triggered instantly via `Q` or `C`.
- **Natural Language Parsing**:
  - Automatically parses dates, times, priority, projects, and tags (e.g. `"Meeting with team tomorrow 3pm !p1 #Work @design"` extracts title, due date, priority, project, and tags with real-time interactive preview chips).
- **Inline Task Creation**: Hit `Enter` in the list to spawn a blank task item directly below.

### 3. Task Hierarchy & Rich Content
- **Nested Subtasks**: Multi-level subtasks with progress indicators (e.g., `2/3 completed`) and progress bar.
- **Rich Task Detail Drawer**:
  - Notion-style property grid: Status, Priority, Due Date, Project selector, and Tag pills manager.
  - Markdown-supported description with **Edit** and **Preview** tabs.
  - **Slash Commands Menu**: Type `/` to insert `/todo`, `/bullet`, `/h2`, `/code`, `/quote`.
  - Links & Attachments preview with click-to-open and delete.
  - **Activity Log / Audit Trail**: Timestamps for task creation, status changes, priority shifts, and completion.

### 4. Smart Views & Layout Switchers
- **Sidebar Smart Views**:
  - **Inbox**: Unsorted capture bucket.
  - **Today**: Overdue tasks + tasks scheduled for today.
  - **Upcoming**: Chronological horizon.
  - **Completed**: Searchable archive of finished items with one-click restore.
  - **Custom Projects**: Workspaces with custom emojis, colors, and task counts.
- **Switchable Layouts**:
  - **List View**: Dense list with HTML5 drag-and-drop reordering.
  - **Board (Kanban) View**: `To Do`, `In Progress`, and `Done` columns with card drag-and-drop.
  - **Calendar View**: Monthly interactive agenda with task pills and click-to-add for specific dates.

### 5. Filtering, Sorting & Search
- **Priority Filter**: Instant filter chips (`All`, `P1`, `P2`, `P3`, `P4`).
- **Sorting Options**: Manual (drag-and-drop), Due Date, Priority, or Alphabetical.
- **Command Palette (`Cmd/Ctrl + K`)**: Instant fuzzy search across tasks, navigation to views/projects, theme toggle, and shortcuts.

---

## Keyboard-First Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>J</kbd> / <kbd>K</kbd> or <kbd>↓</kbd> / <kbd>↑</kbd> | Navigate tasks with focus highlight |
| <kbd>Space</kbd> or <kbd>X</kbd> | Toggle task completion |
| <kbd>Enter</kbd> or <kbd>E</kbd> | Open task detail drawer / Edit |
| <kbd>P</kbd> | Cycle priority (`P1` → `P2` → `P3` → `P4`) |
| <kbd>Backspace</kbd> / <kbd>Delete</kbd> | Delete task (with 5-second Undo notification) |
| <kbd>Q</kbd> or <kbd>C</kbd> | Open Global Quick Add modal |
| <kbd>Cmd</kbd> + <kbd>K</kbd> / <kbd>Ctrl</kbd> + <kbd>K</kbd> | Open Command Palette |
| <kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd> | Switch to List / Board / Calendar view |
| <kbd>T</kbd> | Toggle Dark / Light theme |
| <kbd>[</kbd> | Toggle sidebar collapse |
| <kbd>?</kbd> | Open Keyboard Shortcuts cheat sheet |
| <kbd>Esc</kbd> | Close any open drawer or modal |

---

## Getting Started

### Prerequisites
- Node.js (v18+)

### Running Locally
```bash
# Clone the repository
git clone https://github.com/<your-username>/<your-repo-name>.git

# Navigate into project directory
cd ToDoApp.V2

# Start the local server
npm run dev
# or
node server.js
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Tech Stack
- **Structure**: Semantic HTML5 with accessible ARIA roles and keyboard traps.
- **Styles**: Vanilla CSS with strict design tokens and CSS custom properties.
- **Logic**: Modern Modular Vanilla JavaScript (ES modules).
- **Storage**: Offline `localStorage` persistence with JSON backup export/import.
